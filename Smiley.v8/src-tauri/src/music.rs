//! Light now-playing probe — Spotify / Apple Music via timed osascript only.
//! Hard kill after timeout. Never hangs the UI thread (call from worker only).

use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const TIMEOUT: Duration = Duration::from_millis(2200);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackHit {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub app: String,
    pub playing: bool,
}

/// Returns the first playing Spotify/Music track, if any.
pub fn probe_now_playing() -> AppResult<Option<TrackHit>> {
    #[cfg(target_os = "macos")]
    {
        return probe_macos();
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(None)
    }
}

#[cfg(target_os = "macos")]
fn probe_macos() -> AppResult<Option<TrackHit>> {
    // Prefer Spotify then Music — AppleScript only, timed.
    if let Some(t) = run_script(SPOTIFY_SCRIPT)? {
        if t.playing {
            return Ok(Some(t));
        }
    }
    if let Some(t) = run_script(MUSIC_SCRIPT)? {
        if t.playing {
            return Ok(Some(t));
        }
    }
    Ok(None)
}

#[cfg(target_os = "macos")]
const SPOTIFY_SCRIPT: &str = r#"
if application "Spotify" is running then
  tell application "Spotify"
    if player state is playing then
      set t to name of current track
      set a to artist of current track
      set al to album of current track
      return t & "|||" & a & "|||" & al & "|||Spotify|||1"
    end if
  end tell
end if
return ""
"#;

#[cfg(target_os = "macos")]
const MUSIC_SCRIPT: &str = r#"
if application "Music" is running then
  tell application "Music"
    if player state is playing then
      set t to name of current track
      set a to artist of current track
      set al to album of current track
      return t & "|||" & a & "|||" & al & "|||Music|||1"
    end if
  end tell
end if
return ""
"#;

#[cfg(target_os = "macos")]
fn run_script(script: &str) -> AppResult<Option<TrackHit>> {
    let mut child = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| AppError::Msg(format!("osascript: {e}")))?;

    let started = Instant::now();
    while started.elapsed() < TIMEOUT {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => break,
            Ok(Some(_)) => return Ok(None),
            Ok(None) => std::thread::sleep(Duration::from_millis(40)),
            Err(_) => {
                let _ = child.kill();
                return Ok(None);
            }
        }
    }
    if child.try_wait().ok().flatten().is_none() {
        let _ = child.kill();
        let _ = child.wait();
        return Err(AppError::Msg("music probe timed out".into()));
    }

    let mut out = String::new();
    if let Some(mut stdout) = child.stdout.take() {
        let _ = stdout.read_to_string(&mut out);
    }
    let _ = child.wait();
    let line = out.trim();
    if line.is_empty() {
        return Ok(None);
    }
    let parts: Vec<&str> = line.split("|||").collect();
    if parts.len() < 5 {
        return Ok(None);
    }
    Ok(Some(TrackHit {
        title: parts[0].trim().chars().take(120).collect(),
        artist: parts[1].trim().chars().take(120).collect(),
        album: parts[2].trim().chars().take(120).collect(),
        app: parts[3].trim().into(),
        playing: parts[4].trim() == "1",
    }))
}

/// Stable dedup key — title + artist + app + playing state (case-insensitive).
pub fn track_signature(track: &TrackHit) -> String {
    format!(
        "{}\0{}\0{}\0{}",
        track.title.trim().to_ascii_lowercase(),
        track.artist.trim().to_ascii_lowercase(),
        track.app.trim().to_ascii_lowercase(),
        if track.playing { "1" } else { "0" },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn track_signature_dedupes_same_song() {
        let a = TrackHit {
            title: "Song".into(),
            artist: "Artist".into(),
            album: "Album".into(),
            app: "Spotify".into(),
            playing: true,
        };
        let b = TrackHit {
            title: "song".into(),
            artist: "ARTIST".into(),
            album: "other".into(),
            app: "spotify".into(),
            playing: true,
        };
        assert_eq!(track_signature(&a), track_signature(&b));
    }

    #[test]
    fn track_signature_changes_on_new_track() {
        let a = TrackHit {
            title: "A".into(),
            artist: "B".into(),
            album: "".into(),
            app: "Music".into(),
            playing: true,
        };
        let b = TrackHit {
            title: "C".into(),
            artist: "B".into(),
            album: "".into(),
            app: "Music".into(),
            playing: true,
        };
        assert_ne!(track_signature(&a), track_signature(&b));
    }
}
