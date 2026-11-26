use std::io::{self, Read, Write};
use std::net::{SocketAddr, TcpStream, UdpSocket};
use std::os::fd::{AsRawFd, OwnedFd};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use crate::pty::wait_ready;

const POLL_TIMEOUT: Duration = Duration::from_millis(100);
const NO_BUFFER_SPACE: i32 = libc::ENOBUFS;

pub enum Channel {
    Stream(TcpStream),
    Datagram { socket: UdpSocket, peer: SocketAddr },
    Pty(Arc<OwnedFd>),
}

pub fn prepare_stream(stream: TcpStream) -> io::Result<Channel> {
    stream.set_nodelay(true)?;
    stream.set_read_timeout(Some(POLL_TIMEOUT))?;
    stream.set_write_timeout(Some(POLL_TIMEOUT))?;
    Ok(Channel::Stream(stream))
}

pub fn prepare_datagram(socket: UdpSocket, peer: SocketAddr) -> io::Result<Channel> {
    socket.set_read_timeout(Some(POLL_TIMEOUT))?;
    enlarge_buffers(&socket);
    Ok(Channel::Datagram { socket, peer })
}

fn enlarge_buffers(socket: &UdpSocket) {
    let size: libc::c_int = 7 * 1024 * 1024;
    for option in [libc::SO_RCVBUF, libc::SO_SNDBUF] {
        unsafe {
            libc::setsockopt(
                socket.as_raw_fd(),
                libc::SOL_SOCKET,
                option,
                &size as *const libc::c_int as *const libc::c_void,
                std::mem::size_of::<libc::c_int>() as libc::socklen_t,
            );
        }
    }
}

fn is_timeout(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut | io::ErrorKind::Interrupted
    )
}

pub struct Progress<'a> {
    pub stop: &'a AtomicBool,
    pub retries: &'a AtomicU64,
}

impl Progress<'_> {
    fn stopped(&self) -> bool {
        self.stop.load(Ordering::Relaxed)
    }

    fn retry(&self) {
        self.retries.fetch_add(1, Ordering::Relaxed);
    }
}

impl Channel {
    pub fn try_clone(&self) -> io::Result<Channel> {
        Ok(match self {
            Channel::Stream(stream) => Channel::Stream(stream.try_clone()?),
            Channel::Datagram { socket, peer } => Channel::Datagram {
                socket: socket.try_clone()?,
                peer: *peer,
            },
            Channel::Pty(master) => Channel::Pty(master.clone()),
        })
    }

    pub fn read(&mut self, buffer: &mut [u8]) -> io::Result<Option<usize>> {
        let result = match self {
            Channel::Stream(stream) => stream.read(buffer),
            Channel::Datagram { socket, .. } => socket.recv(buffer),
            Channel::Pty(master) => return read_pty(master, buffer),
        };
        match result {
            Ok(count) => Ok(Some(count)),
            Err(error) if is_timeout(&error) => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub fn is_stream(&self) -> bool {
        !matches!(self, Channel::Datagram { .. })
    }

    pub fn write_frames(
        &mut self,
        data: &[u8],
        frame_size: usize,
        progress: &Progress,
    ) -> io::Result<bool> {
        match self {
            Channel::Stream(stream) => write_stream(stream, data, progress),
            Channel::Datagram { socket, peer } => {
                write_datagrams(socket, *peer, data, frame_size, progress)
            }
            Channel::Pty(master) => write_pty(master, data, progress),
        }
    }
}

fn write_stream(stream: &mut TcpStream, data: &[u8], progress: &Progress) -> io::Result<bool> {
    let mut rest = data;
    while !rest.is_empty() {
        match stream.write(rest) {
            Ok(written) => rest = &rest[written..],
            Err(error) if is_timeout(&error) => {
                if progress.stopped() {
                    return Ok(false);
                }
            }
            Err(error) => return Err(error),
        }
    }
    Ok(true)
}

fn write_datagrams(
    socket: &UdpSocket,
    peer: SocketAddr,
    data: &[u8],
    frame_size: usize,
    progress: &Progress,
) -> io::Result<bool> {
    for frame in data.chunks(frame_size) {
        loop {
            match socket.send_to(frame, peer) {
                Ok(_) => break,
                Err(error)
                    if is_timeout(&error) || error.raw_os_error() == Some(NO_BUFFER_SPACE) =>
                {
                    progress.retry();
                    if progress.stopped() {
                        return Ok(false);
                    }
                    std::thread::sleep(Duration::from_micros(20));
                }
                Err(error) => return Err(error),
            }
        }
    }
    Ok(true)
}

fn write_pty(master: &OwnedFd, data: &[u8], progress: &Progress) -> io::Result<bool> {
    let mut rest = data;
    while !rest.is_empty() {
        let written = unsafe {
            libc::write(
                master.as_raw_fd(),
                rest.as_ptr() as *const libc::c_void,
                rest.len(),
            )
        };
        if written > 0 {
            rest = &rest[written as usize..];
            continue;
        }
        let error = io::Error::last_os_error();
        if !is_timeout(&error) {
            return Err(error);
        }
        if progress.stopped() {
            return Ok(false);
        }
        wait_ready(master.as_raw_fd(), libc::POLLOUT, 100)?;
    }
    Ok(true)
}

fn read_pty(master: &OwnedFd, buffer: &mut [u8]) -> io::Result<Option<usize>> {
    if !wait_ready(master.as_raw_fd(), libc::POLLIN, 100)? {
        return Ok(None);
    }
    let count = unsafe {
        libc::read(
            master.as_raw_fd(),
            buffer.as_mut_ptr() as *mut libc::c_void,
            buffer.len(),
        )
    };
    if count > 0 {
        return Ok(Some(count as usize));
    }
    let error = io::Error::last_os_error();
    if count == 0 || is_timeout(&error) || error.raw_os_error() == Some(libc::EIO) {
        std::thread::sleep(Duration::from_millis(5));
        return Ok(None);
    }
    Err(error)
}
