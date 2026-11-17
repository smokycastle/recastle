//! What Palace left, brought over as Recastle starts. Palace became Recastle, with a
//! new app ID, and so new folders for its saved data and its cache: the saved settings,
//! recent repositories and the like (see store.rs), the windows to reopen (see
//! reopen.rs) and the authors' pictures found (see avatars.rs) are copied from Palace's
//! as Recastle first starts without its own. Copied, not moved, so Palace's are there
//! still, as they were, should it be opened again.
//!
//! It goes by what's there, not by which version came before, so it's the same for
//! someone coming from any version of Palace, however many releases they skipped.
//! Kept for at least a year after the rename (2026-11), for those slow to update.

use std::path::Path;
use tauri::{AppHandle, Manager};

/// Palace's app ID, which named its folders.
const PALACE_ID: &str = "com.timmcleod.palace";

/// Copies over what Palace saved, where Recastle has nothing of its own yet; and as it
/// first does, its GitHub sign-in too.
pub fn bring_over(app: &AppHandle) {
    if let Ok(data) = app.path().app_data_dir()
        && copy_over(&palace_folder(&data), &data, &[crate::store::FILE, crate::reopen::FILE])
    {
        crate::github::bring_over_palace_sign_in();
    }
    if let Ok(cache) = app.path().app_cache_dir() {
        copy_over(&palace_folder(&cache), &cache, &[crate::avatars::CACHE_FILE]);
    }
}

/// On macOS, the app's own bundle, renamed from Palace.app to Recastle.app, and Recastle
/// started again from there. Palace updated itself into Recastle in place, keeping its
/// file's name, which the Dock and Finder go by. Done as it starts, before anything's
/// noted where it is: Tauri notes its path once, to install updates and to give git as
/// the credential helper (see github.rs), so it can't move while it runs. Where it can't
/// be renamed, as without permission, or run from its disk image, it's left as it is.
#[cfg(target_os = "macos")]
pub fn rename_app_bundle() {
    let Ok(exe) = std::env::current_exe() else { return };
    let Some(moved) = move_bundle(&exe) else { return };
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if std::process::Command::new(&moved).args(args).spawn().is_ok() {
        std::process::exit(0);
    }
    // Not to be started from there: put back, to go on as it was.
    if let (Some(from), Some(to)) = (exe.ancestors().nth(3), moved.ancestors().nth(3)) {
        let _ = std::fs::rename(to, from);
    }
}

/// Renames the app bundle the program at `exe` is in, …/Palace.app/Contents/MacOS/…, to
/// Recastle.app beside it, unless there's one already. The program's path once it has,
/// or None, where it isn't in Palace.app or couldn't be renamed.
#[cfg(any(target_os = "macos", test))]
fn move_bundle(exe: &Path) -> Option<std::path::PathBuf> {
    let bundle = exe.ancestors().nth(3)?;
    if bundle.file_name()? != "Palace.app" {
        return None;
    }
    let to = bundle.with_file_name("Recastle.app");
    if to.exists() || std::fs::rename(bundle, &to).is_err() {
        return None;
    }
    Some(to.join(exe.strip_prefix(bundle).ok()?))
}

/// The folder beside `folder`, one of Recastle's, that Palace had for the same: named
/// after its app ID, as Recastle's after its own.
fn palace_folder(folder: &Path) -> std::path::PathBuf {
    folder.with_file_name(PALACE_ID)
}

/// Copies `files` from the folder `from` into `to`, once: only while `to` hasn't the
/// first of them, the one that says whether anything's been saved there, and `from`
/// has it. So nothing of Recastle's own is replaced, nor Palace's brought back once
/// Recastle's has been used up, as the windows to reopen are once they've reopened.
/// Best effort: what can't be copied is left, and Recastle starts without it. Says
/// whether it copied them.
fn copy_over(from: &Path, to: &Path, files: &[&str]) -> bool {
    let Some(first) = files.first() else { return false };
    if from == to || to.join(first).exists() || !from.join(first).is_file() {
        return false;
    }
    let _ = std::fs::create_dir_all(to);
    for file in files {
        if from.join(file).is_file() {
            let _ = std::fs::copy(from.join(file), to.join(file));
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    // An empty folder of its own for each test.
    fn folder(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("recastle-migrate-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn palace_s_saved_data_is_copied_into_recastle_s_once_and_left_where_it_was() {
        let root = folder("once");
        let (palace, recastle) = (root.join(PALACE_ID), root.join("com.smokycastle.recastle"));
        std::fs::create_dir_all(&palace).unwrap();
        std::fs::write(palace.join("saved.json"), "{\"palace.settings\":{}}").unwrap();
        std::fs::write(palace.join("reopen.json"), "{\"windows\":[]}").unwrap();
        assert_eq!(palace_folder(&recastle), palace);

        assert!(copy_over(&palace, &recastle, &["saved.json", "reopen.json"]));
        assert_eq!(std::fs::read_to_string(recastle.join("saved.json")).unwrap(), "{\"palace.settings\":{}}");
        assert!(recastle.join("reopen.json").exists());
        assert!(palace.join("saved.json").exists());

        // The windows reopened, their note's gone: Palace's isn't brought back for it.
        std::fs::remove_file(recastle.join("reopen.json")).unwrap();
        std::fs::write(recastle.join("saved.json"), "{\"recastle.settings\":{}}").unwrap();
        assert!(!copy_over(&palace, &recastle, &["saved.json", "reopen.json"]));
        assert!(!recastle.join("reopen.json").exists());
        assert_eq!(std::fs::read_to_string(recastle.join("saved.json")).unwrap(), "{\"recastle.settings\":{}}");
        std::fs::remove_dir_all(&root).unwrap();
    }

    // A bundle at `name` in `root`, with its program in it, and that program's path.
    fn bundle(root: &Path, name: &str) -> std::path::PathBuf {
        let exe = root.join(name).join("Contents/MacOS/recastle");
        std::fs::create_dir_all(exe.parent().unwrap()).unwrap();
        std::fs::write(&exe, "").unwrap();
        exe
    }

    #[test]
    fn palace_app_is_renamed_recastle_app_unless_there_s_one() {
        let root = folder("bundle");
        let exe = bundle(&root, "Palace.app");
        assert_eq!(move_bundle(&exe), Some(root.join("Recastle.app/Contents/MacOS/recastle")));
        assert!(!root.join("Palace.app").exists());
        assert!(root.join("Recastle.app/Contents/MacOS/recastle").exists());

        // Already Recastle.app, or with one beside it, or not in a bundle: as it is.
        assert_eq!(move_bundle(&root.join("Recastle.app/Contents/MacOS/recastle")), None);
        let other = bundle(&root, "Palace.app");
        assert_eq!(move_bundle(&other), None);
        assert!(other.exists());
        assert_eq!(move_bundle(&root.join("target/debug/recastle")), None);
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn nothing_s_copied_without_palace_s_or_when_they_re_one_folder() {
        let root = folder("none");
        let (palace, recastle) = (root.join(PALACE_ID), root.join("com.smokycastle.recastle"));
        copy_over(&palace, &recastle, &["saved.json"]);
        assert!(!recastle.exists());
        // Before the app ID changes, its folder is Palace's: there's nothing to copy.
        std::fs::create_dir_all(&palace).unwrap();
        std::fs::write(palace.join("saved.json"), "{}").unwrap();
        copy_over(&palace, &palace, &["saved.json"]);
        assert_eq!(std::fs::read_dir(&palace).unwrap().count(), 1);
        std::fs::remove_dir_all(&root).unwrap();
    }
}
