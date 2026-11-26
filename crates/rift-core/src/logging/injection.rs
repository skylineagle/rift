use super::level::LogLevel;
use super::logger::Logger;
use super::record::LogRecord;
use crate::side::Side;

pub(crate) struct Injection<'a> {
    pub profile: &'a str,
    pub target: Side,
    pub bytes: usize,
    pub delivered: bool,
    pub undelivered_reason: Option<&'a str>,
}

impl Logger {
    pub(crate) fn log_injection(&self, injection: Injection<'_>) {
        if self.enabled(LogLevel::Debug) {
            self.log(injected_record(injection));
        }
    }
}

fn injected_record(injection: Injection<'_>) -> LogRecord {
    let Injection {
        profile,
        target,
        bytes,
        delivered,
        undelivered_reason,
    } = injection;
    let outcome = if delivered {
        "injected"
    } else {
        "could not inject"
    };
    let record = LogRecord::debug(
        "data.injected",
        format!("{profile} {target} {outcome} {bytes} bytes"),
    )
    .profile(profile)
    .side(target)
    .field("target", target)
    .field("bytes", bytes)
    .field("delivered", delivered);
    match undelivered_reason {
        Some(reason) => record.field("undelivered_reason", reason),
        None => record,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn describes_an_undelivered_injection() {
        let record = injected_record(Injection {
            profile: "gps",
            target: Side::B,
            bytes: 2,
            delivered: false,
            undelivered_reason: Some("paused"),
        });
        assert_eq!(record.event, "data.injected");
        assert_eq!(record.fields["bytes"], 2);
        assert_eq!(record.fields["target"], "B");
        assert_eq!(record.fields["delivered"], false);
        assert_eq!(record.fields["undelivered_reason"], "paused");
    }
}
