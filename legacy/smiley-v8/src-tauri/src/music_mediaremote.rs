//! macOS MediaRemote stream — event-driven now playing (mediaremote-adapter).
//! Same technique as Music Presence / v7: `/usr/bin/perl` + entitled framework stream.

use crate::error::{AppError, AppResult};
use crate::music::TrackHit;
use serde_json::Value;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

const PERL_BIN: &str = "/usr/bin/perl";
const TEST_TIMEOUT: Duration = Duration::from_millis(8000);
const STREAM_RESTART: Duration = Duration::from_millis(1500);

pub struct AdapterPaths {
    pub framework: PathBuf,
    pub script: PathBuf,
}

const BUNDLE_APP_NAMES: &[(&str, &str)] = &[
    ("com.apple.Music", "Music"),
    ("com.spotify.client", "Spotify"),
    ("com.google.Chrome", "Chrome"),
    ("company.thebrowser.Browser", "Arc"),
    ("com.brave.Browser", "Brave"),
    ("com.microsoft.edgemac", "Edge"),
    ("com.apple.Safari", "Safari"),
    ("com.tidal.desktop", "TIDAL"),
    ("com.amazon.music", "Amazon Music"),
    ("com.deezer.Deezer", "Deezer"),
];

/// Resolve bundled or dev-tree mediaremote-adapter paths.
pub fn resolve_adapter_paths(resource_dir: Option<&Path>) -> Option<AdapterPaths> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(dir) = resource_dir {
        candidates.push(dir.join("mediaremote-adapter"));
    }
    if let Ok(env_dir) = std::env::var("SMILEY_MEDIAREMOTE_ADAPTER_DIR") {
        candidates.push(PathBuf::from(env_dir));
    }
    candidates.push(
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../electron/mediaremote-adapter"),
    );

    for dir in candidates {
        let framework = dir.join("MediaRemoteAdapter.framework");
        let script = dir.join("mediaremote-adapter.pl");
        if framework.is_dir() && script.is_file() {
            return Some(AdapterPaths {
                framework,
                script,
            });
        }
    }
    None
}

/// One-shot adapter health check (`get --no-artwork`).
pub fn test_adapter(paths: &AdapterPaths) -> bool {
    let mut child = match Command::new(PERL_BIN)
        .arg(&paths.script)
        .arg(&paths.framework)
        .args(["get", "--no-artwork"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let started = Instant::now();
    while started.elapsed() < TEST_TIMEOUT {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return false;
                }
                break;
            }
            Ok(None) => thread::sleep(Duration::from_millis(40)),
            Err(_) => {
                let _ = child.kill();
                return false;
            }
        }
    }
    if child.try_wait().ok().flatten().is_none() {
        let _ = child.kill();
        let _ = child.wait();
        return false;
    }

    let mut out = String::new();
    if let Some(mut stdout) = child.stdout.take() {
        let _ = stdout.read_to_string(&mut out);
    }
    let _ = child.wait();
    !out.trim().is_empty()
}

pub fn bundle_id_to_app_name(bundle_id: &str) -> String {
    let id = bundle_id.trim();
    if id.is_empty() {
        return String::new();
    }
    for (bid, name) in BUNDLE_APP_NAMES {
        if *bid == id {
            return (*name).into();
        }
    }
    id.rsplit('.')
        .next()
        .map(|tail| tail.replace(['_', '-'], " "))
        .unwrap_or_else(|| id.into())
}

fn apply_diff_payload(
    state: &mut serde_json::Map<String, Value>,
    payload: &serde_json::Map<String, Value>,
    diff: bool,
) {
    if !diff {
        *state = payload.clone();
        return;
    }
    for (key, value) in payload {
        if value.is_null() {
            state.remove(key);
        } else {
            state.insert(key.clone(), value.clone());
        }
    }
}

fn adapter_state_to_track(state: &serde_json::Map<String, Value>) -> Option<TrackHit> {
    let title = state
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if title.is_empty() {
        return None;
    }

    let playing = state
        .get("playing")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let artist = state
        .get("artist")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let album = state
        .get("album")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let app = state
        .get("bundleIdentifier")
        .and_then(Value::as_str)
        .map(bundle_id_to_app_name)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Media".into());

    Some(TrackHit {
        title: title.chars().take(120).collect(),
        artist: artist.chars().take(120).collect(),
        album: album.chars().take(120).collect(),
        app,
        playing,
    })
}

struct StreamReader {
    line_rx: Receiver<String>,
    child: Arc<Mutex<Option<Child>>>,
    join: Option<JoinHandle<()>>,
}

impl StreamReader {
    fn spawn(paths: &AdapterPaths) -> AppResult<Self> {
        let mut child = Command::new(PERL_BIN)
            .arg(&paths.script)
            .arg(&paths.framework)
            .args(["stream", "--no-artwork"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| AppError::Msg(format!("mediaremote stream: {e}")))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::Msg("mediaremote stream: no stdout".into()))?;
        let (line_tx, line_rx) = mpsc::channel();
        let child_slot = Arc::new(Mutex::new(Some(child)));
        let child_for_thread = child_slot.clone();

        let join = thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        if line_tx.send(l).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            if let Ok(mut guard) = child_for_thread.lock() {
                if let Some(mut c) = guard.take() {
                    let _ = c.wait();
                }
            }
        });

        Ok(Self {
            line_rx,
            child: child_slot,
            join: Some(join),
        })
    }

    fn stop(&mut self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        if let Some(join) = self.join.take() {
            let _ = join.join();
        }
    }
}

/// Event-driven MediaRemote watcher — instant track changes, near-zero CPU when idle on same track.
pub struct MediaRemoteStream {
    reader: StreamReader,
    state: serde_json::Map<String, Value>,
    last_meta_sig: String,
}

impl MediaRemoteStream {
    pub fn start(paths: AdapterPaths) -> AppResult<Self> {
        Ok(Self {
            reader: StreamReader::spawn(&paths)?,
            state: serde_json::Map::new(),
            last_meta_sig: String::new(),
        })
    }

    fn track_meta_signature(track: &TrackHit) -> String {
        format!(
            "{}\0{}\0{}\0{}\0{}",
            track.title, track.artist, track.album, track.app, track.playing
        )
    }

    fn handle_line(&mut self, line: &str) -> Option<Option<TrackHit>> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }
        let msg: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => return None,
        };
        let obj = msg.as_object()?;
        if obj.get("type").and_then(Value::as_str) != Some("data") {
            return None;
        }
        let payload = obj.get("payload")?.as_object()?;
        let diff = obj.get("diff").and_then(Value::as_bool).unwrap_or(true);
        let had_title = self
            .state
            .get("title")
            .and_then(Value::as_str)
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
            || payload
                .get("title")
                .and_then(Value::as_str)
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false);

        apply_diff_payload(&mut self.state, payload, diff);

        let title = self
            .state
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();
        if !had_title && title.is_empty() {
            self.last_meta_sig.clear();
            return Some(None);
        }

        let track = adapter_state_to_track(&self.state)?;
        let meta_sig = Self::track_meta_signature(&track);
        if meta_sig == self.last_meta_sig {
            return None;
        }
        self.last_meta_sig = meta_sig;
        Some(Some(track))
    }

    /// Wait for a track change. Returns `None` on timeout (no metadata change).
    pub fn wait_event(&mut self, timeout: Duration) -> StreamEvent {
        match self.reader.line_rx.recv_timeout(timeout) {
            Ok(line) => match self.handle_line(&line) {
                Some(track) => StreamEvent::Track(track),
                None => StreamEvent::NoChange,
            },
            Err(RecvTimeoutError::Timeout) => StreamEvent::Timeout,
            Err(RecvTimeoutError::Disconnected) => StreamEvent::Disconnected,
        }
    }

    pub fn stop(&mut self) {
        self.reader.stop();
        self.state.clear();
        self.last_meta_sig.clear();
    }
}

pub enum StreamEvent {
    Track(Option<TrackHit>),
    NoChange,
    Timeout,
    Disconnected,
}

pub const STREAM_HEARTBEAT: Duration = Duration::from_secs(45);
pub const STREAM_RESTART_DELAY: Duration = STREAM_RESTART;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundle_id_maps_spotify() {
        assert_eq!(bundle_id_to_app_name("com.spotify.client"), "Spotify");
    }

    #[test]
    fn diff_payload_merges_title() {
        let mut state = serde_json::Map::new();
        state.insert("artist".into(), Value::String("A".into()));
        let mut payload = serde_json::Map::new();
        payload.insert("title".into(), Value::String("Song".into()));
        apply_diff_payload(&mut state, &payload, true);
        let track = adapter_state_to_track(&state).unwrap();
        assert_eq!(track.title, "Song");
        assert_eq!(track.artist, "A");
    }
}
