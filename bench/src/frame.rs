use memchr::memmem::Finder;

pub const MAGIC: [u8; 4] = [0x52, 0x46, 0x54, 0xB7];
const HEADER_SIZE: usize = 24;
const TAIL_SIZE: usize = 8;

pub struct Decoded {
    pub sequence: u64,
    pub timestamp: u64,
}

pub fn encode(buffer: &mut [u8], sequence: u64, timestamp: u64) {
    let size = buffer.len();
    buffer[0..4].copy_from_slice(&MAGIC);
    buffer[4..8].copy_from_slice(&(size as u32).to_le_bytes());
    buffer[8..16].copy_from_slice(&sequence.to_le_bytes());
    buffer[16..24].copy_from_slice(&timestamp.to_le_bytes());
    buffer[HEADER_SIZE..size - TAIL_SIZE].fill(sequence as u8);
    buffer[size - TAIL_SIZE..].copy_from_slice(&sequence.to_le_bytes());
}

fn read_u64(bytes: &[u8]) -> u64 {
    u64::from_le_bytes(bytes.try_into().unwrap())
}

fn decode(candidate: &[u8]) -> Option<Decoded> {
    let size = candidate.len();
    let declared = u32::from_le_bytes(candidate[4..8].try_into().unwrap()) as usize;
    let sequence = read_u64(&candidate[8..16]);
    let filler = sequence as u8;
    let intact = declared == size
        && read_u64(&candidate[size - TAIL_SIZE..]) == sequence
        && candidate[HEADER_SIZE..size - TAIL_SIZE]
            .iter()
            .all(|&byte| byte == filler);
    intact.then(|| Decoded {
        sequence,
        timestamp: read_u64(&candidate[16..24]),
    })
}

pub struct Scanner {
    frame_size: usize,
    pending: Vec<u8>,
    finder: Finder<'static>,
    pub garbage_bytes: u64,
    pub corrupt_frames: u64,
}

impl Scanner {
    pub fn new(frame_size: usize) -> Self {
        Self {
            frame_size,
            pending: Vec::with_capacity(1 << 20),
            finder: Finder::new(&MAGIC).into_owned(),
            garbage_bytes: 0,
            corrupt_frames: 0,
        }
    }

    pub fn feed(&mut self, data: &[u8], frames: &mut Vec<Decoded>) {
        self.pending.extend_from_slice(data);
        let mut position = 0;
        loop {
            let rest = &self.pending[position..];
            if rest.len() < MAGIC.len() {
                break;
            }
            if rest[..MAGIC.len()] != MAGIC {
                match self.finder.find(rest) {
                    Some(offset) => {
                        self.garbage_bytes += offset as u64;
                        position += offset;
                        continue;
                    }
                    None => {
                        let skipped = rest.len() - (MAGIC.len() - 1);
                        self.garbage_bytes += skipped as u64;
                        position += skipped;
                        break;
                    }
                }
            }
            if rest.len() < self.frame_size {
                break;
            }
            match decode(&rest[..self.frame_size]) {
                Some(frame) => {
                    frames.push(frame);
                    position += self.frame_size;
                }
                None => {
                    self.corrupt_frames += 1;
                    position += 1;
                }
            }
        }
        self.pending.drain(..position);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovers_frames_around_torn_and_garbage_bytes() {
        let mut first = vec![0u8; 64];
        let mut second = vec![0u8; 64];
        encode(&mut first, 7, 1);
        encode(&mut second, 8, 2);
        let mut stream = b"hello".to_vec();
        stream.extend_from_slice(&first[..40]);
        stream.extend_from_slice(&second);
        let mut scanner = Scanner::new(64);
        let mut frames = Vec::new();
        for chunk in stream.chunks(13) {
            scanner.feed(chunk, &mut frames);
        }
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].sequence, 8);
        assert_eq!(scanner.corrupt_frames, 1);
    }
}
