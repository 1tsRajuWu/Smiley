//! Light gaming probe — process list only, hard timeout, no AppleScript.
//! Matches v7 `electron/now-gaming.js` known-game catalog + Steam capsule art.

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artwork_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steam_app_id: Option<u32>,
}

struct KnownGame {
    id: &'static str,
    title: &'static str,
    state: &'static str,
    steam_app_id: Option<u32>,
    /// Process-name needles (lowercase, already normalized).
    needles: &'static [&'static str],
}

/// Games first — Steam launcher entries are last so they never mask a running title.
const KNOWN_GAMES: &[KnownGame] = &[
    KnownGame {
        id: "cs2",
        title: "Counter-Strike 2",
        state: "Playing",
        steam_app_id: Some(730),
        needles: &["cs2", "csgo", "counter-strike 2", "counter-strike2", "counter strike 2"],
    },
    KnownGame {
        id: "valorant",
        title: "VALORANT",
        state: "Playing",
        steam_app_id: None,
        needles: &["valorant", "valorant-win64-shipping"],
    },
    KnownGame {
        id: "lol",
        title: "League of Legends",
        state: "Playing",
        steam_app_id: None,
        needles: &["leagueclient", "leagueclientux", "league of legends"],
    },
    KnownGame {
        id: "dota2",
        title: "Dota 2",
        state: "Playing",
        steam_app_id: Some(570),
        needles: &["dota2"],
    },
    KnownGame {
        id: "fortnite",
        title: "Fortnite",
        state: "Playing",
        steam_app_id: None,
        needles: &["fortnite", "fortniteclient-win64-shipping"],
    },
    KnownGame {
        id: "overwatch",
        title: "Overwatch 2",
        state: "Playing",
        steam_app_id: None,
        needles: &["overwatch"],
    },
    KnownGame {
        id: "roblox",
        title: "Roblox",
        state: "Playing",
        steam_app_id: None,
        needles: &["roblox", "robloxplayerbeta"],
    },
    KnownGame {
        id: "minecraft",
        title: "Minecraft",
        state: "Playing",
        steam_app_id: None,
        needles: &["minecraft", "minecraftlauncher", "minecraftjavaw"],
    },
    KnownGame {
        id: "tf2",
        title: "Team Fortress 2",
        state: "Playing",
        steam_app_id: Some(440),
        needles: &["tf_win64", "hl2"],
    },
    KnownGame {
        id: "gta5",
        title: "Grand Theft Auto V",
        state: "Playing",
        steam_app_id: Some(271590),
        needles: &["gta5", "gtav", "playgtav"],
    },
    KnownGame {
        id: "apex",
        title: "Apex Legends",
        state: "Playing",
        steam_app_id: Some(1172470),
        needles: &["r5apex", "r5apex_dx12"],
    },
    KnownGame {
        id: "pubg",
        title: "PUBG",
        state: "Playing",
        steam_app_id: Some(578080),
        needles: &["tslgame", "pubg"],
    },
    KnownGame {
        id: "rust",
        title: "Rust",
        state: "Playing",
        steam_app_id: Some(252490),
        needles: &["rust", "rustclient"],
    },
    KnownGame {
        id: "eldenring",
        title: "ELDEN RING",
        state: "Playing",
        steam_app_id: Some(1245620),
        needles: &["eldenring"],
    },
    KnownGame {
        id: "helldivers2",
        title: "Helldivers 2",
        state: "Playing",
        steam_app_id: Some(553850),
        needles: &["helldivers2"],
    },
    KnownGame {
        id: "destiny2",
        title: "Destiny 2",
        state: "Playing",
        steam_app_id: Some(1085660),
        needles: &["destiny2"],
    },
    KnownGame {
        id: "warframe",
        title: "Warframe",
        state: "Playing",
        steam_app_id: Some(230410),
        needles: &["warframe", "warframe.x64"],
    },
    KnownGame {
        id: "rocketleague",
        title: "Rocket League",
        state: "Playing",
        steam_app_id: Some(252950),
        needles: &["rocketleague"],
    },
    KnownGame {
        id: "cyberpunk",
        title: "Cyberpunk 2077",
        state: "Playing",
        steam_app_id: Some(1091500),
        needles: &["cyberpunk2077"],
    },
    KnownGame {
        id: "valheim",
        title: "Valheim",
        state: "Playing",
        steam_app_id: Some(892970),
        needles: &["valheim"],
    },
    KnownGame {
        id: "stardew",
        title: "Stardew Valley",
        state: "Playing",
        steam_app_id: Some(413150),
        needles: &["stardew valley", "stardewvalley"],
    },
    KnownGame {
        id: "amongus",
        title: "Among Us",
        state: "Playing",
        steam_app_id: Some(945360),
        needles: &["among us", "amongus"],
    },
    KnownGame {
        id: "hades",
        title: "Hades",
        state: "Playing",
        steam_app_id: Some(1145360),
        needles: &["hades", "hades2"],
    },
    KnownGame {
        id: "terraria",
        title: "Terraria",
        state: "Playing",
        steam_app_id: Some(105600),
        needles: &["terraria"],
    },
    KnownGame {
        id: "genshin",
        title: "Genshin Impact",
        state: "Playing",
        steam_app_id: None,
        needles: &["genshin"],
    },
];

const IGNORED: &[&str] = &[
    "electron",
    "smiley",
    "discord",
    "discordcanary",
    "discordptb",
    "code",
    "cursor",
    "finder",
    "explorer",
    "chrome",
    "google chrome",
    "firefox",
    "safari",
    "edge",
    "microsoft edge",
    "brave",
    "arc",
    "spotify",
    "music",
    "terminal",
    "iterm2",
    "steamwebhelper",
    "epicgameslauncher",
    "epic games launcher",
    "riot client",
    "riotclientux",
    "riot client ux",
    "riotclientservices",
    "system settings",
    "system preferences",
    "dock",
    "windowserver",
    "loginwindow",
];

pub fn steam_capsule(app_id: u32) -> String {
    format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}/capsule_231x87.jpg")
}

pub fn is_riot_game_id(id: &str) -> bool {
    matches!(id, "valorant" | "lol" | "league")
}

fn humanize(raw: &str) -> String {
    raw.trim()
        .trim_end_matches(".exe")
        .trim_end_matches(".app")
        .replace(['_', '-'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn norm_key(name: &str) -> String {
    humanize(name).to_ascii_lowercase().replace(' ', "")
}

fn norm_spaced(name: &str) -> String {
    humanize(name).to_ascii_lowercase()
}

fn is_ignored_process(name: &str) -> bool {
    let key = norm_spaced(&humanize(name));
    if key.is_empty() || key.contains("smiley") {
        return true;
    }
    if IGNORED.iter().any(|i| key == *i) {
        return true;
    }
    if (key.contains("chrome")
        || key.contains("firefox")
        || key.contains("safari")
        || key.contains("discord")
        || key.contains("spotify")
        || key.contains("slack")
        || key.contains("zoom")
        || key.contains("teams"))
        && !key.contains("counter-strike")
    {
        if key.contains("helper") || key.contains("gpu") || key.contains("crashpad") {
            return true;
        }
    }
    false
}

fn matches_needle(key: &str, spaced: &str, needle: &str) -> bool {
    if key == needle || spaced == needle {
        return true;
    }
    if needle.contains(' ') {
        return spaced == needle || spaced.contains(needle);
    }
    key == needle || spaced.contains(needle)
}

fn match_known_game(process_name: &str) -> Option<&'static KnownGame> {
    let spaced = norm_spaced(process_name);
    let key = norm_key(process_name);
    if spaced.is_empty() {
        return None;
    }
    for game in KNOWN_GAMES {
        for needle in game.needles {
            if matches_needle(&key, &spaced, needle) {
                return Some(game);
            }
        }
    }
    None
}

fn hit_from_game(game: &KnownGame) -> GameHit {
    let artwork_url = game.steam_app_id.map(steam_capsule);
    GameHit {
        id: game.id.into(),
        title: game.title.into(),
        details: game.title.into(),
        state: game.state.into(),
        artwork_url,
        steam_app_id: game.steam_app_id,
    }
}

pub fn probe_foreground_game() -> AppResult<Option<GameHit>> {
    let started = Instant::now();
    let mut child = Command::new("ps")
        .args(["-axo", "comm="])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| AppError::Msg(format!("ps: {e}")))?;

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

    let mut best: Option<GameHit> = None;
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let raw = line.trim();
        if raw.is_empty() {
            continue;
        }
        let name = humanize(raw);
        if is_ignored_process(&name) {
            continue;
        }
        if let Some(game) = match_known_game(&name) {
            best = Some(hit_from_game(game));
        }
    }
    Ok(best)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cs2_process_aliases() {
        assert_eq!(
            match_known_game("cs2").map(|g| g.id),
            Some("cs2")
        );
        assert_eq!(
            match_known_game("Counter-Strike 2").map(|g| g.id),
            Some("cs2")
        );
    }

    #[test]
    fn ignores_discord_and_steam_helpers() {
        assert!(is_ignored_process("Discord"));
        assert!(is_ignored_process("steamwebhelper"));
        assert!(!is_ignored_process("cs2"));
    }

    #[test]
    fn steam_capsule_shape() {
        let url = steam_capsule(730);
        assert!(url.contains("/730/capsule_231x87.jpg"));
    }

    #[test]
    fn hit_includes_steam_artwork_for_cs2() {
        let game = match_known_game("cs2").expect("cs2");
        let hit = hit_from_game(game);
        assert_eq!(hit.details, "Counter-Strike 2");
        assert_eq!(hit.state, "Playing");
        assert_eq!(hit.steam_app_id, Some(730));
        assert!(hit.artwork_url.unwrap().contains("/730/"));
    }

    #[test]
    fn valorant_is_riot_game() {
        assert!(is_riot_game_id("valorant"));
        assert!(!is_riot_game_id("cs2"));
    }
}
