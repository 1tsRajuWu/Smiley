//! File logger — timestamps via Rust clock (no `date` spawn).

use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn log_dir() -> Option<PathBuf> {
    let base = dirs::data_dir()?.join("Smiley").join("logs");
    create_dir_all(&base).ok()?;
    Some(base)
}

fn stamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let tod = secs % 86_400;
    let h = tod / 3600;
    let m = (tod % 3600) / 60;
    let s = tod % 60;
    format!("{h:02}:{m:02}:{s:02}Z")
}

pub fn path() -> Option<PathBuf> {
    Some(log_dir()?.join("smiley.log"))
}

pub fn append(message: &str) {
    let Some(p) = path() else {
        return;
    };
    let line = format!("[{}] {}\n", stamp(), message.replace('\n', " "));
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(p) {
        let _ = f.write_all(line.as_bytes());
    }
}
