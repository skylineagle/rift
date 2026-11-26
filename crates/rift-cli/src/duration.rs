use std::time::Duration;

pub fn parse_duration(input: &str) -> Result<Duration, String> {
    let unit_start = input
        .find(|character: char| character.is_ascii_alphabetic())
        .ok_or_else(|| invalid(input))?;
    let (amount, unit) = input.split_at(unit_start);
    let millis_per_unit = match unit {
        "ms" => 1.0,
        "s" => 1_000.0,
        "m" => 60_000.0,
        _ => return Err(invalid(input)),
    };
    let amount: f64 = amount.parse().map_err(|_| invalid(input))?;
    let millis = (amount * millis_per_unit).round();
    if !millis.is_finite() || millis < 1.0 || millis > u64::MAX as f64 {
        return Err(invalid(input));
    }
    Ok(Duration::from_millis(millis as u64))
}

fn invalid(input: &str) -> String {
    format!("invalid duration `{input}`, expected at least 1ms, such as 250ms, 1.5s or 2m")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_every_unit_and_fractions() {
        for (input, millis) in [
            ("250ms", 250),
            ("1s", 1_000),
            ("1.5s", 1_500),
            ("2m", 120_000),
        ] {
            assert_eq!(parse_duration(input), Ok(Duration::from_millis(millis)));
        }
    }

    #[test]
    fn rejects_missing_unknown_zero_and_negative_values() {
        for input in ["", "10", "ms", "1h", "0s", "0.4ms", "-1s", "1.2.3s", "1 s"] {
            assert!(parse_duration(input).is_err(), "{input}");
        }
    }
}
