use std::path::{Path, PathBuf};

use rift_core::ProfileStore;

fn toml_files(dir: &Path) -> Vec<PathBuf> {
    std::fs::read_dir(dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .flat_map(|path| {
            if path.is_dir() {
                toml_files(&path)
            } else if path
                .extension()
                .is_some_and(|extension| extension == "toml")
            {
                vec![path]
            } else {
                vec![]
            }
        })
        .collect()
}

#[test]
fn every_example_config_loads() {
    let examples = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../examples");
    let files = toml_files(&examples);
    assert!(!files.is_empty());
    for file in files {
        let store =
            ProfileStore::load(&file).unwrap_or_else(|error| panic!("{}: {error}", file.display()));
        assert!(
            !store.list().is_empty(),
            "{} has no profiles",
            file.display()
        );
    }
}
