use anyhow::{anyhow, Result};
use rift_core::{parse_payload, PayloadFormat, Side, Target};

pub struct InjectCommand {
    pub target: Target,
    pub bytes: Vec<u8>,
}

pub struct SideSwitchCommand {
    pub side: Side,
    pub enabled: bool,
}

pub enum CommandAction {
    Inject(InjectCommand),
    SwitchSide(SideSwitchCommand),
}

pub struct Command {
    pub profile: Option<String>,
    pub action: CommandAction,
}

pub fn parse(line: &str) -> Result<Command> {
    let (destination, rest) = split_word(line.trim_start());
    let (word, payload) = split_word(rest);
    if destination.is_empty() || word.is_empty() {
        return Err(anyhow!(
            "expected `[profile:]<a|b|both> <text|hex|bin|file> <payload>` or `[profile:]<a|b> <on|off>`"
        ));
    }
    let (profile, target_word) = match destination.split_once(':') {
        Some((profile, target)) => (Some(profile.to_string()), target),
        None => (None, destination),
    };
    let target: Target = target_word.parse()?;
    let action = match parse_switch(word) {
        Some(enabled) => CommandAction::SwitchSide(SideSwitchCommand {
            side: single_side(target)?,
            enabled,
        }),
        None => {
            let format: PayloadFormat = word.parse()?;
            CommandAction::Inject(InjectCommand {
                target,
                bytes: parse_payload(format, payload)?,
            })
        }
    };
    Ok(Command { profile, action })
}

fn parse_switch(word: &str) -> Option<bool> {
    match word.to_ascii_lowercase().as_str() {
        "on" => Some(true),
        "off" => Some(false),
        _ => None,
    }
}

fn single_side(target: Target) -> Result<Side> {
    match target {
        Target::A => Ok(Side::A),
        Target::B => Ok(Side::B),
        Target::Both => Err(anyhow!("on/off needs a single side, a or b")),
    }
}

fn split_word(text: &str) -> (&str, &str) {
    match text.split_once(char::is_whitespace) {
        Some((word, rest)) => (word, rest.trim_start()),
        None => (text, ""),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inject(line: &str) -> (Option<String>, InjectCommand) {
        match parse(line).unwrap() {
            Command {
                profile,
                action: CommandAction::Inject(command),
            } => (profile, command),
            _ => panic!("expected an inject command"),
        }
    }

    fn switch(line: &str) -> (Option<String>, SideSwitchCommand) {
        match parse(line).unwrap() {
            Command {
                profile,
                action: CommandAction::SwitchSide(command),
            } => (profile, command),
            _ => panic!("expected a side switch"),
        }
    }

    #[test]
    fn parses_plain_command() {
        let (profile, command) = inject("a hex de ad be ef");
        assert_eq!(profile, None);
        assert_eq!(command.target, Target::A);
        assert_eq!(command.bytes, vec![0xde, 0xad, 0xbe, 0xef]);
    }

    #[test]
    fn parses_profile_prefix_and_escapes() {
        let (profile, command) = inject("gps:both text hello\\r\\n");
        assert_eq!(profile.as_deref(), Some("gps"));
        assert_eq!(command.target, Target::Both);
        assert_eq!(command.bytes, b"hello\r\n");
    }

    #[test]
    fn parses_side_switches() {
        let (profile, command) = switch("b off");
        assert_eq!(profile, None);
        assert_eq!(command.side, Side::B);
        assert!(!command.enabled);
        let (profile, command) = switch("gps:A ON");
        assert_eq!(profile.as_deref(), Some("gps"));
        assert_eq!(command.side, Side::A);
        assert!(command.enabled);
    }

    #[test]
    fn rejects_incomplete_commands() {
        assert!(parse("a").is_err());
        assert!(parse("x text hi").is_err());
        assert!(parse("a nope hi").is_err());
        assert!(parse("both off").is_err());
    }
}
