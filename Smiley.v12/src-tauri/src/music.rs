//! Light now-playing probe — Spotify / Apple Music / system media.
//! macOS: MediaRemote stream (instant, like Music Presence) with osascript fallback.
//! Linux: MPRIS D-Bus. Windows: stub (future SMTC).

use crate::error::{AppError, AppResult};
use crate::log_file;
use serde::Serialize;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

#[cfg(target_os = "macos")]
use crate::music_mediaremote::{
    probe_once, resolve_adapter_paths, test_adapter, MediaRemoteStream, StreamEvent,
    STREAM_HEARTBEAT, STREAM_RESTART_DELAY,
};

const OSASCRIPT_TIMEOUT: Duration = Duration::from_millis(2200);
const IDLE_SLEEP: Duration = Duration::from_secs(2);
const FALLBACK_POLL: Duration = Duration::from_secs(5);
#[cfg(target_os = "linux")]
const LINUX_POLL: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackHit {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub app: String,
    pub playing: bool,
}

/// Returns the first playing track, if any (one-shot probe).
pub fn probe_now_playing(resource_dir: Option<&std::path::Path>) -> AppResult<Option<TrackHit>> {
    #[cfg(target_os = "macos")]
    {
        if let Some(paths) = resolve_adapter_paths(resource_dir) {
            if test_adapter(&paths) {
                if let Some(track) = probe_once(&paths).filter(|t| t.playing) {
                    return Ok(Some(track));
                }
            }
        }
        return probe_macos_osascript();
    }
    #[cfg(target_os = "linux")]
    {
        return Ok(crate::music_linux::probe_mpris());
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        Ok(None)
    }
}

/// Event-driven music sync loop — runs on a dedicated background thread.
pub fn run_sync_loop<F, G>(resource_dir: Option<PathBuf>, is_active: F, mut on_track: G)
where
    F: Fn() -> bool,
    G: FnMut(Option<TrackHit>),
{
    #[cfg(target_os = "macos")]
    {
        run_macos_loop(resource_dir, is_active, on_track);
        return;
    }
    #[cfg(target_os = "linux")]
    {
        run_linux_loop(is_active, on_track);
        return;
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = resource_dir;
        loop {
            if !is_active() {
                thread::sleep(IDLE_SLEEP);
                continue;
            }
            on_track(probe_now_playing(None).ok().flatten());
            thread::sleep(FALLBACK_POLL);
        }
    }
}

#[cfg(target_os = "macos")]
fn run_macos_loop<F, G>(resource_dir: Option<PathBuf>, is_active: F, mut on_track: G)
where
    F: Fn() -> bool,
    G: FnMut(Option<TrackHit>),
{
    let mut stream: Option<MediaRemoteStream> = None;
    let mut fallback = false;
    let mut last_fallback = Instant::now() - FALLBACK_POLL;
    let mut was_active = false;

    loop {
        let active = is_active();
        if !active {
            if was_active {
                if let Some(mut s) = stream.take() {
                    s.stop();
                }
                fallback = false;
            }
            was_active = false;
            thread::sleep(IDLE_SLEEP);
            continue;
        }

        if !was_active {
            was_active = true;
            self_nudge_probe(resource_dir.as_deref(), &mut on_track);
        }

        if stream.is_none() && !fallback {
            if let Some(paths) = resolve_adapter_paths(resource_dir.as_deref()) {
                if test_adapter(&paths) {
                    match MediaRemoteStream::start(&paths) {
                        Ok(s) => {
                            stream = Some(s);
                            if let Some(track) = probe_once(&paths) {
                                on_track(Some(track));
                            }
                        }
                        Err(e) => {
                            log_file::append(&format!("music: stream start failed: {e}"));
                            fallback = true;
                        }
                    }
                } else {
                    log_file::append("music: adapter test failed — osascript fallback");
                    fallback = true;
                }
            } else {
                fallback = true;
            }
        }

        if let Some(ref mut s) = stream {
            match s.wait_event(STREAM_HEARTBEAT) {
                StreamEvent::Track(track) => on_track(track),
                StreamEvent::NoChange => {}
                StreamEvent::Timeout => {}
                StreamEvent::Disconnected => {
                    log_file::append("music: MediaRemote stream disconnected — restarting");
                    s.stop();
                    stream = None;
                    thread::sleep(STREAM_RESTART_DELAY);
                }
            }
            continue;
        }

        if fallback && last_fallback.elapsed() >= FALLBACK_POLL {
            last_fallback = Instant::now();
            let track = probe_macos_osascript().ok().flatten();
            on_track(track);
        }
        thread::sleep(Duration::from_millis(300));
    }
}

#[cfg(target_os = "macos")]
fn self_nudge_probe<F>(resource_dir: Option<&std::path::Path>, on_track: &mut F)
where
    F: FnMut(Option<TrackHit>),
{
    if let Some(paths) = resolve_adapter_paths(resource_dir) {
        if test_adapter(&paths) {
            if let Some(track) = probe_once(&paths) {
                on_track(Some(track));
                return;
            }
        }
    }
    if let Ok(track) = probe_macos_osascript() {
        on_track(track);
    }
}

#[cfg(target_os = "linux")]
fn run_linux_loop<F, G>(is_active: F, mut on_track: G)
where
    F: Fn() -> bool,
    G: FnMut(Option<TrackHit>),
{
    let mut last_poll = Instant::now() - LINUX_POLL;
    loop {
        if !is_active() {
            thread::sleep(IDLE_SLEEP);
            continue;
        }
        if last_poll.elapsed() >= LINUX_POLL {
            last_poll = Instant::now();
            on_track(crate::music_linux::probe_mpris());
        }
        thread::sleep(Duration::from_millis(250));
    }
}

#[cfg(target_os = "macos")]
fn probe_macos_osascript() -> AppResult<Option<TrackHit>> {
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
    while started.elapsed() < OSASCRIPT_TIMEOUT {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => break,
            Ok(Some(_)) => return Ok(None),
            Ok(None) => thread::sleep(Duration::from_millis(40)),
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

/// Background music → Discord sync loop wired to `App` state.
pub fn run_music_presence_loop(app: Arc<crate::app::App>, resource_dir: Option<PathBuf>) {
    run_sync_loop(resource_dir, || app.music_listening_active(), |track| {
        if let Err(e) = app.music_apply_track(track) {
            log_file::append(&format!("music: apply failed: {e}"));
        }
    });
}

/// One-shot music probe for UI nudge / connect (uses bundled adapter when available).
/// Includes paused tracks — unlike `probe_now_playing` which prefers actively playing media.
pub fn nudge_now_playing(
    resource_dir: Option<&std::path::Path>,
) -> AppResult<Option<TrackHit>> {
    #[cfg(target_os = "macos")]
    {
        if let Some(paths) = resolve_adapter_paths(resource_dir) {
            if test_adapter(&paths) {
                if let Some(track) = probe_once(&paths) {
                    return Ok(Some(track));
                }
            }
        }
        return probe_macos_osascript();
    }
    #[cfg(target_os = "linux")]
    {
        return Ok(crate::music_linux::probe_mpris());
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = resource_dir;
        Ok(None)
    }
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
