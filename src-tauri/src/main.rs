// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Git starts Recastle as its credential helper while Recastle is signed in to GitHub.
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("git-credential") {
        std::process::exit(recastle_lib::git_credential(args.get(2).map(String::as_str)));
    }
    recastle_lib::run()
}
