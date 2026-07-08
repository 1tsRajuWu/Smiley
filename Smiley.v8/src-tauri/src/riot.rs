//! Local Riot Client presence — lockfile + 127.0.0.1 HTTPS only.
//! No memory reads, no injectors, no Tracker.gg, password never leaves this process.

use crate::error::AppResult;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RiotLive {
    pub product: String,
    pub title: String,
    pub details: String,
    pub state: String,
    pub phase: String,
}

struct Lockfile {
    port: u16,
    password: String,
}

fn lockfile_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir()
            .unwrap_or_default()
            .join("Library/Application Support/Riot Games/Riot Client/Config/lockfile")
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("AppData/Local"))
            .join("Riot Games/Riot Client/Config/lockfile")
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        dirs::home_dir()
            .unwrap_or_default()
            .join(".config/Riot Games/Riot Client/Config/lockfile")
    }
}

fn read_lockfile() -> Option<Lockfile> {
    let text = fs::read_to_string(lockfile_path()).ok()?;
    let parts: Vec<&str> = text.trim().split(':').collect();
    // name:pid:port:password:protocol
    if parts.len() < 4 {
        return None;
    }
    let port = parts[2].parse().ok()?;
    let password = parts[3].to_string();
    if password.is_empty() {
        return None;
    }
    Some(Lockfile { port, password })
}

fn local_get(lock: &Lockfile, path: &str) -> Option<Value> {
    let auth = format!(
        "Basic {}",
        base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            format!("riot:{}", lock.password)
        )
    );
    let url = format!("https://127.0.0.1:{}{}", lock.port, path);
    let client = reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(TIMEOUT)
        .build()
        .ok()?;
    let res = client
        .get(&url)
        .header("Authorization", auth)
        .header("Accept", "application/json")
        .send()
        .ok()?;
    if !res.status().is_success() {
        return None;
    }
    res.json().ok()
}

fn decode_private(private: &str) -> Option<Value> {
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, private).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn str_field(v: &Value, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(s) = v.get(*k).and_then(|x| x.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    None
}

fn flatten(v: &Value) -> Value {
    // Riot 2025+ sometimes nests under "presence" / "partyPresenceData"
    if let Some(inner) = v.get("presence").cloned() {
        return flatten(&inner);
    }
    v.clone()
}

fn phase_from(private: &Value) -> &'static str {
    let loop_state = str_field(
        private,
        &[
            "sessionLoopState",
            "session_loop_state",
            "partyState",
            "party_state",
        ],
    )
    .unwrap_or_default()
    .to_uppercase();
    if loop_state.contains("INGAME") || loop_state == "IN_GAME" {
        return "match";
    }
    if loop_state.contains("PREGAME") || loop_state.contains("AGENT") {
        return "pregame";
    }
    if loop_state.contains("MATCHMAKING") || loop_state.contains("QUEUE") {
        return "queue";
    }
    "lobby"
}

fn queue_label(private: &Value) -> Option<String> {
    let id = str_field(
        private,
        &["queueId", "queueID", "QueueID", "mode", "modeId"],
    )?;
    let key = id.to_lowercase();
    Some(
        match key.as_str() {
            "competitive" | "comp" => "Competitive",
            "unrated" => "Unrated",
            "spikerush" | "ggteam" => "Spike Rush",
            "swiftplay" => "Swiftplay",
            "deathmatch" => "Deathmatch",
            "hurm" | "onefa" => "Team Deathmatch",
            "premier" => "Premier",
            "custom" => "Custom",
            other => other,
        }
        .into(),
    )
}

fn party_label(private: &Value) -> Option<String> {
    let size = private
        .get("partySize")
        .or_else(|| private.get("party_size"))
        .and_then(|v| v.as_u64())
        .or_else(|| {
            private
                .get("partySize")
                .or_else(|| private.get("party_size"))
                .and_then(|v| v.as_i64())
                .map(|n| n as u64)
        })?;
    let max = private
        .get("maxPartySize")
        .or_else(|| private.get("max_party_size"))
        .and_then(|v| v.as_u64())
        .unwrap_or(5);
    if size == 0 {
        return None;
    }
    if size == 1 {
        Some("Solo".into())
    } else {
        Some(format!("Party {size}/{max}"))
    }
}

/// Read-only Valorant / LoL style line from Riot chat presence. Never returns secrets.
pub fn probe_riot_presence() -> AppResult<Option<RiotLive>> {
    let Some(lock) = read_lockfile() else {
        return Ok(None);
    };
    let session = local_get(&lock, "/chat/v1/session");
    let presences = local_get(&lock, "/chat/v4/presences");
    let (Some(session), Some(presences)) = (session, presences) else {
        return Ok(None);
    };

    let puuid = match str_field(&session, &["puuid", "cid"]) {
        Some(p) => p,
        None => return Ok(None),
    };

    let list = presences
        .get("presences")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let self_row = list.into_iter().find(|row| {
        str_field(row, &["puuid"])
            .map(|p| p.eq_ignore_ascii_case(&puuid))
            .unwrap_or(false)
    });
    let Some(self_row) = self_row else {
        return Ok(None);
    };

    let product = str_field(&self_row, &["product", "productName"]).unwrap_or_else(|| "riot".into());
    let private_raw = str_field(&self_row, &["private"]).unwrap_or_default();
    let private = decode_private(&private_raw)
        .map(|v| flatten(&v))
        .unwrap_or(Value::Null);

    let is_val = product.to_lowercase().contains("valorant")
        || product.eq_ignore_ascii_case("vng")
        || private.get("isValid").is_some()
        || private.get("sessionLoopState").is_some();

    if is_val {
        let phase = phase_from(&private);
        let mode = queue_label(&private);
        let party = party_label(&private);
        let (details, state) = match phase {
            "match" => (
                "VALORANT".into(),
                join(&[mode.as_deref(), party.as_deref(), Some("In match")]),
            ),
            "pregame" => (
                "Agent Select".into(),
                join(&[mode.as_deref(), party.as_deref()]),
            ),
            "queue" => (
                "VALORANT".into(),
                join(&[Some("Queue"), mode.as_deref(), party.as_deref()]),
            ),
            _ => (
                "VALORANT".into(),
                join(&[mode.as_deref(), party.as_deref(), Some("In lobby")]),
            ),
        };
        return Ok(Some(RiotLive {
            product: "valorant".into(),
            title: "VALORANT".into(),
            details,
            state,
            phase: phase.into(),
        }));
    }

    // League / generic Riot product — keep short & local
    Ok(Some(RiotLive {
        product: product.to_lowercase(),
        title: "League of Legends".into(),
        details: "League of Legends".into(),
        state: "In client".into(),
        phase: "lobby".into(),
    }))
}

fn join(parts: &[Option<&str>]) -> String {
    parts
        .iter()
        .filter_map(|p| *p)
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join(" · ")
}
