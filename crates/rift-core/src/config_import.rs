use std::collections::HashSet;

use crate::{Profile, ProfileStore};

pub const MAX_CONFIG_IMPORT_BYTES: usize = 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum ConfigImportError {
    #[error("Configuration exceeds the 1 MiB import limit")]
    TooLarge,
    #[error("Unsupported configuration format; Rift imports TOML profile files")]
    UnsupportedFormat,
    #[error("Invalid TOML syntax: {0}")]
    InvalidSyntax(String),
    #[error("Invalid Rift configuration: {0}")]
    InvalidSchema(String),
}

pub fn prepare_config_import(
    content: &str,
    filename: &str,
    existing_names: &[String],
) -> Result<Vec<Profile>, ConfigImportError> {
    if content.len() > MAX_CONFIG_IMPORT_BYTES {
        return Err(ConfigImportError::TooLarge);
    }
    let value: toml::Value = match toml::from_str(content) {
        Ok(value) => value,
        Err(error) => {
            if serde_json::from_str::<serde_json::Value>(content).is_ok()
                || (!filename.to_ascii_lowercase().ends_with(".toml")
                    && content.trim_start().starts_with('{'))
            {
                return Err(ConfigImportError::UnsupportedFormat);
            }
            return Err(ConfigImportError::InvalidSyntax(error.to_string()));
        }
    };
    if value.get("profile").is_none() {
        return Err(ConfigImportError::UnsupportedFormat);
    }
    let store: ProfileStore = value
        .try_into()
        .map_err(|error: toml::de::Error| ConfigImportError::InvalidSchema(error.to_string()))?;
    if store.list().is_empty() {
        return Err(ConfigImportError::InvalidSchema("No profiles found".into()));
    }
    if store
        .list()
        .iter()
        .any(|profile| profile.name.trim().is_empty())
    {
        return Err(ConfigImportError::InvalidSchema(
            "Profile names cannot be empty".into(),
        ));
    }

    let mut reserved: HashSet<String> = existing_names.iter().cloned().collect();
    reserved.extend(store.list().iter().map(|profile| profile.name.clone()));
    let mut used: HashSet<String> = existing_names.iter().cloned().collect();
    let mut profiles = store.list().to_vec();
    for profile in &mut profiles {
        if used.contains(&profile.name) {
            let base = &profile.name;
            let mut number = 2;
            let name = loop {
                let candidate = format!("{base} {number}");
                if !reserved.contains(&candidate) && !used.contains(&candidate) {
                    break candidate;
                }
                number += 1;
            };
            profile.name = name;
        }
        used.insert(profile.name.clone());
    }
    Ok(profiles)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROFILE: &str = "[[profile]]\nname = \"gps\"\na = { kind = \"tcp-client\", address = \"localhost:1\" }\nb = { kind = \"uart\", port = \"/dev/ttyUSB0\", baud_rate = 9600 }\n";

    #[test]
    fn accepts_canonical_toml_regardless_of_extension() {
        let profiles = prepare_config_import(PROFILE, "config.json", &[]).unwrap();
        assert_eq!(profiles[0].name, "gps");
        assert!(profiles[0].a.enabled);
        assert_eq!(
            prepare_config_import(
                include_str!("../../../examples/rift.toml"),
                "rift.toml",
                &[]
            )
            .unwrap()
            .len(),
            2
        );
    }

    #[test]
    fn rejects_invalid_and_unsupported_input() {
        assert!(matches!(
            prepare_config_import("{\"profile\": []}", "config.json", &[]),
            Err(ConfigImportError::UnsupportedFormat)
        ));
        assert!(matches!(
            prepare_config_import("[[profile", "config.toml", &[]),
            Err(ConfigImportError::InvalidSyntax(_))
        ));
        assert!(matches!(
            prepare_config_import("[[profile]]\nname = \"broken\"", "config.toml", &[]),
            Err(ConfigImportError::InvalidSchema(_))
        ));
        assert!(matches!(
            prepare_config_import("profile = []", "config.toml", &[]),
            Err(ConfigImportError::InvalidSchema(_))
        ));
        assert!(matches!(
            prepare_config_import(&"x".repeat(MAX_CONFIG_IMPORT_BYTES + 1), "config.toml", &[]),
            Err(ConfigImportError::TooLarge)
        ));
    }

    #[test]
    fn resolves_existing_and_incoming_collisions_without_stealing_names() {
        let input = format!("{PROFILE}{}{}", PROFILE, PROFILE.replace("gps", "gps 2"));
        let profiles = prepare_config_import(&input, "rift.toml", &["gps".into()]).unwrap();
        assert_eq!(
            profiles.iter().map(|p| p.name.as_str()).collect::<Vec<_>>(),
            ["gps 3", "gps 4", "gps 2"]
        );
    }

    #[test]
    fn invalid_later_profile_produces_no_prepared_import() {
        let input = format!("{PROFILE}[[profile]]\nname = \"bad\"\na = {{ kind = \"unknown\" }}\n");
        assert!(matches!(
            prepare_config_import(&input, "rift.toml", &[]),
            Err(ConfigImportError::InvalidSchema(_))
        ));
    }
}
