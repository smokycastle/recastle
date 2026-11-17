//! What earlier versions left, brought over as Recastle starts. The app ID has changed
//! twice, from Palace's to Recastle's first one as Palace became Recastle, then to
//! Recastle's own as the repository moved, and with it the folders for the saved data
//! and the cache: the saved settings, recent repositories and the like (see store.rs),
//! the windows to reopen (see reopen.rs) and the authors' pictures found (see
//! avatars.rs) are copied from the latest earlier folders as Recastle first starts
//! without its own. Copied, not moved, so the earlier ones are there still, as they
//! were, should an earlier version be opened again.
//!
//! It goes by what's there, not by which version came before, so it's the same for
//! someone coming from any version, however many releases they skipped. Kept for at
//! least a year after the last change (2026-11), for those slow to update.

use std::path::Path;
use tauri::{AppHandle, Manager};

/// Palace's app ID, which named its folders.
const PALACE_ID: &str = "com.timmcleod.palace";

/// The app IDs before this one, which named the folders, latest first: Recastle's first,
/// from before the repository moved, then Palace's.
const EARLIER_IDS: [&str; 2] = ["com.smokycastle.recastle", PALACE_ID];

/// Copies over what the latest earlier version saved, where Recastle has nothing of its
/// own yet; and from Palace, its GitHub sign-in too. Recastle's own sign-in is kept by
/// name, not in a folder, so it stays as it is.
pub fn bring_over(app: &AppHandle) {
    if let Ok(data) = app.path().app_data_dir()
        && copy_latest(&data, &[crate::store::FILE, crate::reopen::FILE]) == Some(PALACE_ID)
    {
        crate::github::bring_over_palace_sign_in();
    }
    if let Ok(cache) = app.path().app_cache_dir() {
        copy_latest(&cache, &[crate::avatars::CACHE_FILE]);
    }
}

/// Copies `files` into `folder`, one of Recastle's, from the folder beside it that the
/// latest earlier version had for the same, as copy_over does: so from Palace's only
/// where there's nothing of Recastle's first app ID. The app ID copied from, if any.
fn copy_latest(folder: &Path, files: &[&str]) -> Option<&'static str> {
    EARLIER_IDS.into_iter().find(|id| copy_over(&folder.with_file_name(id), folder, files))
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

/// Copies `files` from the folder `from` into `to`, once: only while `to` hasn't the
/// first of them, the one that says whether anything's been saved there, and `from`
/// has it. So nothing of Recastle's own is replaced, nor an earlier version's brought
/// back once Recastle's has been used up, as the windows to reopen are once they've
/// reopened.
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

    /// The app ID now, from tauri.conf.json.
    const RECASTLE_ID: &str = "com.timmcleod.recastle";

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
        let (palace, recastle) = (root.join(PALACE_ID), root.join(RECASTLE_ID));
        std::fs::create_dir_all(&palace).unwrap();
        std::fs::write(palace.join("saved.json"), "{\"palace.settings\":{}}").unwrap();
        std::fs::write(palace.join("reopen.json"), "{\"windows\":[]}").unwrap();

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
        let (palace, recastle) = (root.join(PALACE_ID), root.join(RECASTLE_ID));
        copy_over(&palace, &recastle, &["saved.json"]);
        assert!(!recastle.exists());
        // Before the app ID changes, its folder is Palace's: there's nothing to copy.
        std::fs::create_dir_all(&palace).unwrap();
        std::fs::write(palace.join("saved.json"), "{}").unwrap();
        copy_over(&palace, &palace, &["saved.json"]);
        assert_eq!(std::fs::read_dir(&palace).unwrap().count(), 1);
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn what_s_saved_is_copied_from_the_latest_earlier_folder() {
        let root = folder("latest");
        let recastle = root.join(RECASTLE_ID);
        let write = |id: &str, json: &str| {
            std::fs::create_dir_all(root.join(id)).unwrap();
            std::fs::write(root.join(id).join("saved.json"), json).unwrap();
        };
        write(PALACE_ID, "{\"from\":\"palace\"}");

        // From Palace's, without Recastle's first app ID's folder: the sign-in comes too.
        assert_eq!(copy_latest(&recastle, &["saved.json"]), Some(PALACE_ID));
        assert_eq!(std::fs::read_to_string(recastle.join("saved.json")).unwrap(), "{\"from\":\"palace\"}");

        // With both, from Recastle's first app ID's, though Palace's is there too.
        std::fs::remove_dir_all(&recastle).unwrap();
        write(EARLIER_IDS[0], "{\"from\":\"recastle\"}");
        assert_eq!(copy_latest(&recastle, &["saved.json"]), Some(EARLIER_IDS[0]));
        assert_eq!(std::fs::read_to_string(recastle.join("saved.json")).unwrap(), "{\"from\":\"recastle\"}");

        // Once Recastle has its own, nothing.
        assert_eq!(copy_latest(&recastle, &["saved.json"]), None);
        std::fs::remove_dir_all(&root).unwrap();
    }
}
