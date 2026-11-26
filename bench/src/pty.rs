use std::ffi::CStr;
use std::fs::File;
use std::io;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd, RawFd};
use std::os::unix::fs::OpenOptionsExt;
use std::sync::Arc;

pub struct Pty {
    pub master: Arc<OwnedFd>,
    pub path: String,
    _slave: OwnedFd,
}

fn check(result: libc::c_int) -> io::Result<libc::c_int> {
    if result < 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(result)
    }
}

impl Pty {
    pub fn open() -> io::Result<Self> {
        let master = unsafe { check(libc::posix_openpt(libc::O_RDWR | libc::O_NOCTTY))? };
        let master = unsafe { OwnedFd::from_raw_fd(master) };
        unsafe {
            check(libc::grantpt(master.as_raw_fd()))?;
            check(libc::unlockpt(master.as_raw_fd()))?;
        }
        let name = unsafe { libc::ptsname(master.as_raw_fd()) };
        if name.is_null() {
            return Err(io::Error::last_os_error());
        }
        let path = unsafe { CStr::from_ptr(name) }
            .to_string_lossy()
            .into_owned();
        let slave = File::options()
            .read(true)
            .write(true)
            .custom_flags(libc::O_NOCTTY)
            .open(&path)?;
        let slave = OwnedFd::from(slave);
        make_raw(master.as_raw_fd())?;
        make_raw(slave.as_raw_fd())?;
        unsafe {
            let flags = check(libc::fcntl(master.as_raw_fd(), libc::F_GETFL))?;
            check(libc::fcntl(
                master.as_raw_fd(),
                libc::F_SETFL,
                flags | libc::O_NONBLOCK,
            ))?;
        }
        Ok(Self {
            master: Arc::new(master),
            path,
            _slave: slave,
        })
    }
}

fn make_raw(fd: RawFd) -> io::Result<()> {
    unsafe {
        let mut settings: libc::termios = std::mem::zeroed();
        check(libc::tcgetattr(fd, &mut settings))?;
        libc::cfmakeraw(&mut settings);
        check(libc::tcsetattr(fd, libc::TCSANOW, &settings))?;
    }
    Ok(())
}

pub fn wait_ready(fd: RawFd, events: libc::c_short, timeout_ms: i32) -> io::Result<bool> {
    let mut poll = libc::pollfd {
        fd,
        events,
        revents: 0,
    };
    let ready = unsafe { libc::poll(&mut poll, 1, timeout_ms) };
    match ready {
        0 => Ok(false),
        count if count > 0 => Ok(true),
        _ => {
            let error = io::Error::last_os_error();
            if error.kind() == io::ErrorKind::Interrupted {
                Ok(false)
            } else {
                Err(error)
            }
        }
    }
}
