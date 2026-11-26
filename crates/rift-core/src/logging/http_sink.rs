use std::collections::VecDeque;
use std::io::Write;
use std::sync::mpsc::Sender;
use std::thread;
use std::time::{Duration, Instant};

use super::config::{HttpFormat, HttpSinkConfig};
use super::queue::{self, dropped_record, Inbox, Outbox, Received};
use super::record::LogRecord;

const BUFFER_CAPACITY: usize = 10_000;
const FLUSH_DELIVERY_TIMEOUT: Duration = Duration::from_secs(1);

enum Command {
    Record(String),
    Flush(Sender<()>),
}

pub(super) struct HttpSink {
    commands: Outbox<Command>,
}

impl HttpSink {
    pub fn new(config: &HttpSinkConfig) -> Self {
        let (commands, received) = queue::bounded(BUFFER_CAPACITY);
        let worker = Worker::new(config.clone());
        thread::spawn(move || worker.run(received));
        Self { commands }
    }

    pub fn write(&mut self, record: &LogRecord) {
        self.commands.offer(Command::Record(record.to_json()));
    }

    pub fn flush(&mut self, done: Sender<()>) {
        self.commands
            .deliver(Command::Flush(done), FLUSH_DELIVERY_TIMEOUT);
    }
}

#[derive(Default)]
struct Buffer {
    records: VecDeque<String>,
}

impl Buffer {
    fn push(&mut self, record: String) {
        if self.records.len() == BUFFER_CAPACITY {
            self.records.pop_front();
        }
        self.records.push_back(record);
    }

    fn batch(&self, size: usize) -> Vec<&str> {
        self.records.iter().take(size).map(String::as_str).collect()
    }

    fn remove(&mut self, count: usize) {
        self.records.drain(..count);
    }

    fn len(&self) -> usize {
        self.records.len()
    }
}

fn content_type(format: HttpFormat) -> &'static str {
    match format {
        HttpFormat::Ndjson => "application/x-ndjson",
        HttpFormat::JsonArray => "application/json",
    }
}

fn body(format: HttpFormat, records: &[&str]) -> String {
    match format {
        HttpFormat::Ndjson => records.iter().map(|record| format!("{record}\n")).collect(),
        HttpFormat::JsonArray => format!("[{}]", records.join(",")),
    }
}

struct Worker {
    config: HttpSinkConfig,
    agent: ureq::Agent,
    buffer: Buffer,
    failing: bool,
}

impl Worker {
    fn new(config: HttpSinkConfig) -> Self {
        let agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(config.timeout_secs.max(1))))
            .build()
            .new_agent();
        Self {
            config,
            agent,
            buffer: Buffer::default(),
            failing: false,
        }
    }

    fn run(mut self, commands: Inbox<Command>) {
        let interval = Duration::from_secs(self.config.flush_interval_secs.max(1));
        let mut deadline = Instant::now() + interval;
        loop {
            match commands.receive(deadline.saturating_duration_since(Instant::now())) {
                Received::Item(Command::Record(record)) => self.accept(record),
                Received::Item(Command::Flush(done)) => {
                    if let Some(count) = commands.take_dropped() {
                        self.accept(dropped_record(count).to_json());
                    }
                    self.send_all();
                    let _ = done.send(());
                }
                Received::Dropped(count) => self.accept(dropped_record(count).to_json()),
                Received::TimedOut => {}
                Received::Closed => break,
            }
            if Instant::now() >= deadline {
                self.send_all();
                deadline = Instant::now() + interval;
            }
        }
        self.send_all();
    }

    fn accept(&mut self, record: String) {
        self.buffer.push(record);
        if !self.failing && self.buffer.len() >= self.batch_size() {
            self.send_batch();
        }
    }

    fn batch_size(&self) -> usize {
        self.config.batch_size.max(1)
    }

    fn send_all(&mut self) {
        while self.buffer.len() > 0 && self.send_batch() {}
    }

    fn send_batch(&mut self) -> bool {
        let batch = self.buffer.batch(self.batch_size());
        let count = batch.len();
        let outcome = self.post(&body(self.config.format, &batch));
        if let Err(error) = &outcome {
            if !self.failing {
                let _ = writeln!(std::io::stderr(), "rift: cannot send logs: {error}");
            }
        }
        self.failing = outcome.is_err();
        if outcome.is_ok() {
            self.buffer.remove(count);
        }
        !self.failing
    }

    fn post(&self, body: &str) -> Result<(), ureq::Error> {
        let mut request = self
            .agent
            .post(&self.config.url)
            .header("Content-Type", content_type(self.config.format));
        for (name, value) in &self.config.headers {
            request = request.header(name, value);
        }
        request.send(body)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::io::{BufRead, BufReader, Read};
    use std::net::TcpListener;
    use std::sync::mpsc;

    use super::*;

    #[test]
    fn bodies_match_their_format() {
        let records = [r#"{"a":1}"#, r#"{"a":2}"#];
        assert_eq!(body(HttpFormat::Ndjson, &records), "{\"a\":1}\n{\"a\":2}\n");
        assert_eq!(
            body(HttpFormat::JsonArray, &records),
            r#"[{"a":1},{"a":2}]"#
        );
        assert_eq!(content_type(HttpFormat::Ndjson), "application/x-ndjson");
        assert_eq!(content_type(HttpFormat::JsonArray), "application/json");
    }

    #[test]
    fn buffer_drops_the_oldest_records_when_full() {
        let mut buffer = Buffer::default();
        for index in 0..BUFFER_CAPACITY + 2 {
            buffer.push(index.to_string());
        }
        assert_eq!(buffer.len(), BUFFER_CAPACITY);
        assert_eq!(buffer.batch(2), ["2", "3"]);
        buffer.remove(2);
        assert_eq!(buffer.batch(1), ["4"]);
    }

    #[test]
    fn failed_sends_keep_the_records() {
        let mut worker = Worker::new(HttpSinkConfig {
            url: "not a url".into(),
            ..HttpSinkConfig::default()
        });
        worker.buffer.push("{}".into());
        worker.send_all();
        assert_eq!(worker.buffer.len(), 1);
    }

    #[test]
    fn flush_posts_the_batch_with_headers() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let server = thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut reader = BufReader::new(stream);
            let mut head = String::new();
            while !head.ends_with("\r\n\r\n") {
                reader.read_line(&mut head).unwrap();
            }
            let head = head.to_ascii_lowercase();
            let length: usize = head
                .lines()
                .find_map(|line| line.strip_prefix("content-length: "))
                .unwrap()
                .parse()
                .unwrap();
            let mut received = vec![0; length];
            reader.read_exact(&mut received).unwrap();
            reader
                .get_mut()
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                .unwrap();
            (head, String::from_utf8(received).unwrap())
        });
        let mut sink = HttpSink::new(&HttpSinkConfig {
            url,
            flush_interval_secs: 60,
            headers: [("Authorization".to_string(), "ApiKey xyz".to_string())].into(),
            ..HttpSinkConfig::default()
        });
        sink.write(&LogRecord::info("test.event", "message"));
        let (done, flushed) = mpsc::channel();
        sink.flush(done);
        flushed.recv_timeout(Duration::from_secs(5)).unwrap();
        let (head, received) = server.join().unwrap();
        assert!(head.contains("content-type: application/x-ndjson"));
        assert!(head.contains("authorization: apikey xyz"));
        assert!(received.contains("\"event\":\"test.event\""));
        assert!(received.ends_with('\n'));
    }
}
