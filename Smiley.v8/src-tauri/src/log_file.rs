//! Append-only log file under the app data directory.
//! Never stores Discord tokens — Smiley does not use a bot token.

use crate::config::data_dir;
use std::fs::OpenOptions;
use std::io::Write;

pub fn append(line: &str) {
    let Ok(dir) = data_dir() else {
        return;
    };
    let path = dir.join("logs").join("smiley.log");
    let _ = std::fs::create_dir_all(path.parent().unwrap_or(dir.as_path()));
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let ts = chrono_stamp();
        let _ = writeln!(f, "[{ts}] {line}");
    }
}

fn chrono_stamp() -> String {
    // Local wall clock via `date` — avoids adding a chrono dependency
    use std::process::Command;
    if let Ok(out) = Command::new("date").arg("+%Y-%m-%d %H:%M:%S").output() {
        if out.status.success() {
            return String::from_utf8_lossy(&out.stdout).trim().to_string();
        }
    }
    "unknown".into()
}
