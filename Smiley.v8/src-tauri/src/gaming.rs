//! Light gaming probe — process list only, hard timeout, no AppleScript.
//! Full live gaming sync still lives in Electron v7 (`electron/game-sync.js`).

use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameHit {
    pub id: String,
    pub title: String,
    pub details: String,
    pub state: String,
}

/// Known game process substrings → Discord-facing titles.
const GAMES: &[(&str, &str, &str, &str)] = &[
    ("LeagueClient", "league", "League of Legends", "In game"),
    ("VALORANT", "valorant", "VALORANT", "In game"),
    ("Fortnite", "fortnite", "Fortnite", "In game"),
    ("Minecraft", "minecraft", "Minecraft", "In world"),
    ("Roblox", "roblox", "Roblox", "In experience"),
    ("steam_osx", "steam", "Steam", "Browsing"),
    ("Steam", "steam", "Steam", "Browsing"),
    ("cs2", "cs2", "Counter-Strike 2", "In match"),
    ("Overwatch", "overwatch", "Overwatch 2", "In game"),
    ("Genshin", "genshin", "Genshin Impact", "In Teyvat"),
];

pub fn probe_foreground_game() -> AppResult<Option<GameHit>> {
    let started = Instant::now();
    let mut child = Command::new("ps")
        .args(["-axo", "comm="])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| AppError::Msg(format!("ps: {e}")))?;

    // Hard watchdog — never hang the UI
    while started.elapsed() < Duration::from_millis(450) {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => break,
            Ok(Some(_)) => return Ok(None),
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(_) => {
                let _ = child.kill();
                return Ok(None);
            }
        }
    }
    if child.try_wait().ok().flatten().is_none() {
        let _ = child.kill();
        return Err(AppError::Msg("game probe timed out".into()));
    }

    let output = child
        .wait_with_output()
        .map_err(|e| AppError::Msg(format!("ps wait: {e}")))?;
    if !output.status.success() {
        return Ok(None);
    }
    let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
    for (needle, id, title, state) in GAMES {
        if text.contains(&needle.to_lowercase()) {
            return Ok(Some(GameHit {
                id: (*id).into(),
                title: (*title).into(),
                details: format!("Playing {title}"),
                state: (*state).into(),
            }));
        }
    }
    Ok(None)
}
