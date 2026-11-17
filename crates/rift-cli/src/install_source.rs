use std::env;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallSource {
    Archive,
    Cargo,
    DesktopApp,
    SystemPackage,
}

impl InstallSource {
    pub fn detect() -> Self {
        env::current_exe()
            .and_then(|path| path.canonicalize())
            .map_or(InstallSource::Archive, |path| Self::from_path(&path))
    }

    fn from_path(path: &Path) -> Self {
        let text = path.to_string_lossy().replace('\\', "/");
        let installed_by_windows_app = path
            .parent()
            .is_some_and(|directory| directory.join("uninstall.exe").is_file());
        if text.contains(".app/Contents/") || installed_by_windows_app {
            InstallSource::DesktopApp
        } else if text.starts_with("/usr/bin/") {
            InstallSource::SystemPackage
        } else if text.contains("/.cargo/bin/") {
            InstallSource::Cargo
        } else {
            InstallSource::Archive
        }
    }

    pub fn upgrade_hint(self) -> &'static str {
        match self {
            InstallSource::Archive => "run `rift update`",
            InstallSource::Cargo => "run `cargo install rift-cli --force`",
            InstallSource::DesktopApp => "update the Rift desktop app, it ships this CLI",
            InstallSource::SystemPackage => "install the new Rift package from the release page",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_source_follows_where_the_binary_lives() {
        let cases = [
            (
                "/Applications/Rift.app/Contents/MacOS/rift",
                InstallSource::DesktopApp,
            ),
            ("/usr/bin/rift", InstallSource::SystemPackage),
            ("/home/me/.cargo/bin/rift", InstallSource::Cargo),
            ("/usr/local/bin/rift", InstallSource::Archive),
        ];
        for (path, source) in cases {
            assert_eq!(InstallSource::from_path(Path::new(path)), source, "{path}");
        }
    }
}
