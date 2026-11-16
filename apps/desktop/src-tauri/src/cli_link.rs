use std::env;
use std::os::unix::fs::symlink;
use std::path::PathBuf;

pub fn link_bundled_cli() {
    let Some(bundled) = bundled_cli() else {
        return;
    };
    for directory in link_directories() {
        let link = directory.join("rift");
        if link.symlink_metadata().is_ok() {
            return;
        }
        if std::fs::create_dir_all(&directory).is_ok() && symlink(&bundled, &link).is_ok() {
            return;
        }
    }
}

fn bundled_cli() -> Option<PathBuf> {
    let cli = env::current_exe().ok()?.parent()?.join("rift");
    cli.is_file().then_some(cli)
}

fn link_directories() -> Vec<PathBuf> {
    let mut directories = vec![PathBuf::from("/usr/local/bin")];
    directories.extend(env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/bin")));
    directories
}
