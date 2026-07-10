//! Local Riot Client API — Valorant + LoL presence (local-only).
//! File is named `riot.rs` because it reads the Riot Client lockfile, not memory.
//! Lockfile + 127.0.0.1 HTTPS only. No inject, no memory reads.

use crate::error::AppResult;
use crate::valorant_catalog::{
    agent_display_name, is_ffa_deathmatch_queue, is_team_deathmatch_queue, match_queue_id,
    queue_label, resolve_map,
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

const TIMEOUT: Duration = Duration::from_secs(3);
const AGENT_TTL: Duration = Duration::from_secs(86_400);
const ACTIVE_PROBE_CACHE_TTL: Duration = Duration::from_millis(1200);
const QUEUE_PROBE_CACHE_TTL: Duration = Duration::from_millis(2200);
const IDLE_PROBE_CACHE_TTL: Duration = Duration::from_millis(5000);

struct CachedProbe {
    at: Instant,
    ttl: Duration,
    live: RiotLive,
}

static PROBE_CACHE: OnceLock<Mutex<Option<CachedProbe>>> = OnceLock::new();
static HTTP: OnceLock<reqwest::blocking::Client> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MatchBoard {
    pub active: bool,
    pub product: String,
    pub title: String,
    pub details: String,
    pub state: String,
    pub phase: String,
    pub map: Option<String>,
    pub map_id: Option<String>,
    pub mode: Option<String>,
    pub queue_id: Option<String>,
    pub score: Option<String>,
    pub party: Option<String>,
    pub self_agent: Option<String>,
    pub self_agent_id: Option<String>,
    pub self_kda: Option<String>,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RiotLive {
    pub product: String,
    pub title: String,
    pub details: String,
    pub state: String,
    pub phase: String,
    pub board: MatchBoard,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub self_agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub map_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub queue_id: Option<String>,
}

struct Lockfile {
    port: u16,
    password: String,
}

struct AgentCache {
    at: Instant,
    names: HashMap<String, String>,
}

static AGENTS: OnceLock<Mutex<AgentCache>> = OnceLock::new();

fn agent_cache() -> &'static Mutex<AgentCache> {
    AGENTS.get_or_init(|| {
        Mutex::new(AgentCache {
            at: Instant::now() - AGENT_TTL,
            names: HashMap::new(),
        })
    })
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

fn http_client() -> &'static reqwest::blocking::Client {
    HTTP.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .danger_accept_invalid_certs(true)
            .timeout(TIMEOUT)
            .pool_max_idle_per_host(2)
            .build()
            .expect("http client")
    })
}

fn auth_header(lock: &Lockfile) -> String {
    format!(
        "Basic {}",
        base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            format!("riot:{}", lock.password)
        )
    )
}

fn local_get(lock: &Lockfile, path: &str) -> Option<Value> {
    let url = format!("https://127.0.0.1:{}{}", lock.port, path);
    let res = http_client()
        .get(&url)
        .header("Authorization", auth_header(lock))
        .header("Accept", "application/json")
        .send()
        .ok()?;
    if !res.status().is_success() {
        return None;
    }
    res.json().ok()
}

fn local_post_json(lock: &Lockfile, path: &str, body: &Value) -> Option<Value> {
    let url = format!("https://127.0.0.1:{}{}", lock.port, path);
    let res = http_client()
        .post(&url)
        .header("Authorization", auth_header(lock))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(body)
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
    if let Some(inner) = v.get("presence").cloned() {
        return flatten(&inner);
    }
    let mut base = v.clone();
    if let Some(inner) = v.get("matchPresenceData").cloned() {
        if let (Some(a), Some(b)) = (base.as_object_mut(), inner.as_object()) {
            for (k, val) in b {
                a.insert(k.clone(), val.clone());
            }
        }
    }
    if let Some(inner) = v.get("partyPresenceData").cloned() {
        if let (Some(a), Some(b)) = (base.as_object_mut(), inner.as_object()) {
            for (k, val) in b {
                a.entry(k.clone()).or_insert(val.clone());
            }
        }
    }
    if let Some(inner) = v.get("playerPresenceData").cloned() {
        if let (Some(a), Some(b)) = (base.as_object_mut(), inner.as_object()) {
            for (k, val) in b {
                a.entry(k.clone()).or_insert(val.clone());
            }
        }
    }
    base
}

fn refresh_agents() {
    let mut cache = agent_cache().lock();
    if cache.at.elapsed() < AGENT_TTL && !cache.names.is_empty() {
        return;
    }
    let Ok(res) = http_client()
        .get("https://valorant-api.com/v1/agents?isPlayableCharacter=true")
        .send()
    else {
        return;
    };
    if !res.status().is_success() {
        return;
    }
    let Ok(data) = res.json::<Value>() else {
        return;
    };
    let mut map = HashMap::new();
    if let Some(arr) = data.get("data").and_then(|d| d.as_array()) {
        for a in arr {
            if let (Some(id), Some(name)) = (
                a.get("uuid").and_then(|x| x.as_str()),
                a.get("displayName").and_then(|x| x.as_str()),
            ) {
                map.insert(id.to_lowercase(), name.to_string());
            }
        }
    }
    if !map.is_empty() {
        cache.names = map;
        cache.at = Instant::now();
    }
}

fn agent_name(id: &str) -> Option<String> {
    refresh_agents();
    agent_cache()
        .lock()
        .names
        .get(&id.to_lowercase())
        .cloned()
        .or_else(|| agent_display_name(id))
}

fn agent_icon(id: &str) -> String {
    format!(
        "https://media.valorant-api.com/agents/{}/displayicon.png",
        id.to_lowercase()
    )
}

fn phase_from_chat(private: &Value, has_core: bool, has_pregame: bool) -> &'static str {
    if has_core {
        return "match";
    }
    if has_pregame {
        return "pregame";
    }
    let loop_state = str_field(
        private,
        &[
            "sessionLoopState",
            "session_loop_state",
            "partyOwnerSessionLoopState",
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
    let party_state = str_field(private, &["partyState", "party_state"])
        .unwrap_or_default()
        .to_uppercase();
    if loop_state.contains("MATCHMAKING")
        || loop_state == "MATCHMAKING"
        || matches!(
            party_state.as_str(),
            "MATCHMAKING"
                | "STARTING_MATCHMAKING"
                | "MATCHMAKINGREADYCHK"
                | "MATCHMAKING_READY_CHECK"
                | "MATCHMADE_GAME_STARTING"
        )
    {
        return "queue";
    }
    "lobby"
}

fn queue_from_private(private: &Value) -> Option<String> {
    str_field(
        private,
        &[
            "queueId",
            "queueID",
            "QueueID",
            "partyOwnerQueueId",
            "mode",
            "modeId",
        ],
    )
    .map(|id| queue_label(&id))
}

/// Coerce Riot JSON numbers that may arrive as int, float, or string.
fn json_i64(v: &Value) -> Option<i64> {
    v.as_i64()
        .or_else(|| v.as_u64().and_then(|n| i64::try_from(n).ok()))
        .or_else(|| v.as_f64().map(|f| f as i64))
        .or_else(|| v.as_str().and_then(|s| s.trim().parse::<i64>().ok()))
}

fn is_ally_enemy_score(s: &str) -> bool {
    let mut parts = s.split('-');
    matches!(
        (parts.next(), parts.next(), parts.next()),
        (Some(a), Some(b), None)
            if a.chars().all(|c| c.is_ascii_digit())
                && b.chars().all(|c| c.is_ascii_digit())
                && !a.is_empty()
                && !b.is_empty()
    )
}

fn raw_queue_from_private(private: &Value) -> Option<String> {
    str_field(
        private,
        &[
            "queueId",
            "queueID",
            "QueueID",
            "partyOwnerQueueId",
            "mode",
            "modeId",
        ],
    )
}

fn chat_team_score(private: &Value) -> Option<String> {
    let ally = private
        .get("partyOwnerMatchScoreAllyTeam")
        .or_else(|| private.get("partyOwnerMatchCurrentTeamRoundScore"))
        .or_else(|| private.get("matchScoreAllyTeam"))
        .or_else(|| private.get("allyScore"))
        .and_then(json_i64);
    let enemy = private
        .get("partyOwnerMatchScoreEnemyTeam")
        .or_else(|| private.get("matchScoreEnemyTeam"))
        .or_else(|| private.get("enemyScore"))
        .and_then(json_i64);
    if let (Some(a), Some(e)) = (ally, enemy) {
        return Some(format!("{a}-{e}"));
    }
    None
}

fn party_label(private: &Value) -> Option<String> {
    let size = private
        .get("partySize")
        .or_else(|| private.get("party_size"))
        .or_else(|| private.get("partyOwnerPartySize"))
        .and_then(|v| v.as_u64())
        .or_else(|| {
            private
                .get("partyMembers")
                .or_else(|| private.get("partyMemberUUIDs"))
                .and_then(|v| v.as_array())
                .map(|a| a.len() as u64)
        })?;
    if size == 0 {
        return None;
    }
    Some(match size {
        1 => "Solo".into(),
        2 => "Duo".into(),
        3 => "Trio".into(),
        4 => "Quad".into(),
        5 => "5-Stack".into(),
        n => format!("{n}-Stack"),
    })
}

fn map_from_path(path: &str) -> (String, Option<String>) {
    let resolved = resolve_map(path);
    let map_id = resolved.uuid.clone().or_else(|| {
        if path.len() == 36 {
            Some(path.to_string())
        } else {
            None
        }
    });
    let name = if resolved.name.is_empty() {
        path.split('/')
            .filter(|s| !s.is_empty())
            .last()
            .unwrap_or(path)
            .to_string()
    } else {
        resolved.name
    };
    (name, map_id)
}

fn subject_of(p: &Value) -> Option<String> {
    str_field(p, &["Subject", "subject", "puuid"]).or_else(|| {
        p.get("PlayerIdentity")
            .and_then(|pi| str_field(pi, &["Subject", "subject"]))
    })
}

fn character_id(p: &Value) -> Option<String> {
    let pi = p.get("PlayerIdentity");
    let raw = str_field(
        p,
        &[
            "CharacterID",
            "CharacterId",
            "characterID",
            "AgentID",
            "AgentId",
            "agentID",
            "SelectedCharacterID",
            "selectedCharacterID",
        ],
    )
    .or_else(|| pi.and_then(|pi| str_field(pi, &["CharacterID", "CharacterId", "AgentID"])))
    .or_else(|| {
        p.get("Character")
            .and_then(|c| str_field(c, &["ID", "id", "uuid"]))
    })
    .or_else(|| {
        p.get("Character")
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
    })?;
    if raw == "00000000-0000-0000-0000-000000000000" {
        return None;
    }
    Some(raw)
}

fn pick_agent_id(candidates: &[Option<&Value>]) -> Option<String> {
    for row in candidates {
        if let Some(id) = row.and_then(|p| character_id(p)) {
            return Some(id);
        }
    }
    None
}

fn stamp_team_id(row: &Value, team: Option<&str>) -> Value {
    let Some(team) = team.filter(|t| !t.is_empty()) else {
        return row.clone();
    };
    if team_id(row).is_some() {
        return row.clone();
    }
    let Some(obj) = row.as_object() else {
        return row.clone();
    };
    let mut next = obj.clone();
    next.insert("TeamID".into(), Value::String(team.to_string()));
    Value::Object(next)
}

fn players_array(raw: &Value) -> Vec<Value> {
    if let Some(arr) = raw.as_array() {
        return arr.clone();
    }
    if let Some(obj) = raw.as_object() {
        let vals: Vec<Value> = obj.values().filter(|v| v.is_object()).cloned().collect();
        if !vals.is_empty() {
            return vals;
        }
    }
    Vec::new()
}

fn team_id(p: &Value) -> Option<String> {
    str_field(p, &["TeamID", "TeamId", "teamId", "Team"])
}

fn kda_of(p: &Value) -> Option<String> {
    let stats = p.get("Stats").unwrap_or(p);
    let k = stats
        .get("Kills")
        .or_else(|| stats.get("kills"))
        .and_then(json_i64)?;
    let d = stats
        .get("Deaths")
        .or_else(|| stats.get("deaths"))
        .and_then(json_i64)
        .unwrap_or(0);
    let a = stats
        .get("Assists")
        .or_else(|| stats.get("assists"))
        .and_then(json_i64)
        .unwrap_or(0);
    Some(format!("{k}/{d}/{a}"))
}

fn kills_only(p: &Value) -> Option<String> {
    let stats = p.get("Stats").unwrap_or(p);
    let k = stats
        .get("Kills")
        .or_else(|| stats.get("kills"))
        .and_then(json_i64)?;
    Some(format!("{k} kills"))
}

/// Team points for Discord. TDM must use NumPoints — RoundScore is spike noise (often 0-0).
fn team_points(team: &Value, queue_id: Option<&str>) -> Option<i64> {
    let tdm = queue_id.is_some_and(is_team_deathmatch_queue);
    let keys: &[&str] = if tdm {
        &["NumPoints", "numPoints", "points"]
    } else {
        &[
            "NumPoints",
            "numPoints",
            "RoundsWon",
            "roundsWon",
            "RoundScore",
            "roundScore",
            "Score",
            "score",
            "points",
        ]
    };
    for k in keys {
        if let Some(n) = team.get(*k).and_then(json_i64) {
            return Some(n);
        }
    }
    None
}

fn team_score_from_teams(
    match_json: &Value,
    self_team: Option<&str>,
    queue_id: Option<&str>,
) -> Option<String> {
    let teams = match_json
        .get("Teams")
        .or_else(|| match_json.get("ScoreboardTeams"))
        .or_else(|| match_json.get("TeamScores"))
        .and_then(|v| v.as_array())?;
    if teams.len() < 2 {
        return None;
    }
    let mut scored: Vec<(String, i64)> = teams
        .iter()
        .filter_map(|t| {
            let id = str_field(t, &["TeamID", "TeamId", "teamId"]).unwrap_or_default();
            let pts = team_points(t, queue_id)?;
            Some((id, pts))
        })
        .collect();
    if scored.len() < 2 {
        return None;
    }
    if let Some(want) = self_team {
        let want = want.to_lowercase();
        if let Some(i) = scored.iter().position(|(id, _)| id.to_lowercase() == want) {
            let ally = scored.remove(i);
            let enemy = scored.remove(0);
            return Some(format!("{}-{}", ally.1, enemy.1));
        }
    }
    Some(format!("{}-{}", scored[0].1, scored[1].1))
}

fn team_score_from_players(players: &[Value], self_team: Option<&str>) -> Option<String> {
    let mut by_team: HashMap<String, i64> = HashMap::new();
    for p in players {
        let Some(tid) = team_id(p) else {
            continue;
        };
        // FFA DM uses per-player TeamIDs (often the subject UUID) — skip for team totals.
        if tid.len() > 8 && tid.contains('-') {
            continue;
        }
        let stats = p.get("Stats").unwrap_or(p);
        let Some(kills) = stats
            .get("Kills")
            .or_else(|| stats.get("kills"))
            .and_then(json_i64)
        else {
            continue;
        };
        *by_team.entry(tid).or_insert(0) += kills;
    }
    if by_team.len() < 2 {
        return None;
    }
    let entries: Vec<(String, i64)> = by_team.into_iter().collect();
    if let Some(want) = self_team {
        let want = want.to_lowercase();
        let ally = entries.iter().find(|(id, _)| id.to_lowercase() == want);
        let enemy = entries
            .iter()
            .find(|(id, _)| ally.is_none_or(|(aid, _)| id != aid));
        if let (Some((_, a)), Some((_, e))) = (ally, enemy) {
            return Some(format!("{a}-{e}"));
        }
    }
    Some(format!("{}-{}", entries[0].1, entries[1].1))
}

/// Local-only score from core-game / merged scoreboard players. No chat fallback.
fn local_match_score(
    match_json: &Value,
    players: &[Value],
    self_row: Option<&Value>,
    queue_id: Option<&str>,
) -> Option<String> {
    let q = queue_id.unwrap_or("");
    let self_team = self_row.and_then(team_id);

    if is_ffa_deathmatch_queue(q) {
        return self_row.and_then(kills_only).or_else(|| {
            self_row
                .and_then(kda_of)
                .map(|k| format!("{} kills", k.split('/').next().unwrap_or("0")))
        });
    }

    if let Some(from_teams) = team_score_from_teams(match_json, self_team.as_deref(), queue_id) {
        return Some(from_teams);
    }

    if is_team_deathmatch_queue(q) {
        if let Some(s) = team_score_from_players(players, self_team.as_deref()) {
            return Some(s);
        }
    }

    None
}

/// Presence score line (v7 resolveScoreHint).
/// FFA DM: kills only — never chat ally–enemy.
/// TDM / spike / Comp: ally–enemy from local or chat; reject local "N kills" leftovers.
fn resolve_presence_score(
    in_match: bool,
    queue_id: Option<&str>,
    local_score: Option<&str>,
    local_kda: Option<&str>,
    chat_score: Option<&str>,
) -> Option<String> {
    if !in_match {
        return None;
    }
    let q = queue_id.unwrap_or("");
    let local = local_score.map(str::trim).filter(|s| !s.is_empty());
    let local_team = local.filter(|s| is_ally_enemy_score(s));
    let local_kills = local.filter(|s| !is_ally_enemy_score(s));

    if is_ffa_deathmatch_queue(q) {
        if let Some(kills) = local_kills {
            return Some(kills.to_string());
        }
        if let Some(kda) = local_kda {
            let kills = kda.split('/').next().unwrap_or("0");
            if !kills.is_empty() {
                return Some(format!("{kills} kills"));
            }
        }
        return None;
    }

    local_team
        .map(|s| s.to_string())
        .or_else(|| chat_score.map(|s| s.to_string()))
}

/// Back-compat helper used by unit tests — local score then chat for team modes.
fn match_score_hint(
    match_json: &Value,
    self_row: Option<&Value>,
    queue_id: Option<&str>,
    chat_score: Option<&str>,
) -> Option<String> {
    let players = core_game_players(match_json);
    let local = local_match_score(match_json, &players, self_row, queue_id);
    let kda = self_row.and_then(kda_of);
    resolve_presence_score(
        true,
        queue_id,
        local.as_deref(),
        kda.as_deref(),
        chat_score,
    )
}

fn collect_players(flat: &mut Vec<Value>, raw: &Value, team: Option<&str>) {
    match raw {
        Value::Array(arr) => {
            for row in arr {
                collect_players(flat, row, team);
            }
        }
        Value::Object(obj) => {
            if subject_of(raw).is_some() || character_id(raw).is_some() {
                flat.push(stamp_team_id(raw, team));
                return;
            }
            for row in obj.values() {
                if row.is_array() || row.is_object() {
                    collect_players(flat, row, team);
                }
            }
        }
        _ => {}
    }
}

fn unique_player_key(p: &Value) -> Option<String> {
    subject_of(p)
        .map(|subject| format!("subject:{}", subject.to_lowercase()))
        .or_else(|| {
            character_id(p).map(|agent| {
                format!(
                    "agent:{}:{}",
                    agent.to_lowercase(),
                    team_id(p).unwrap_or_default().to_lowercase()
                )
            })
        })
}

fn dedupe_players(players: Vec<Value>) -> Vec<Value> {
    let mut seen = HashSet::new();
    let mut out = Vec::with_capacity(players.len());
    for row in players {
        if let Some(key) = unique_player_key(&row) {
            if !seen.insert(key) {
                continue;
            }
        }
        out.push(row);
    }
    out
}

fn is_blank_value(v: &Value) -> bool {
    matches!(v, Value::Null)
        || v.as_str().is_some_and(|s| s.trim().is_empty())
        || v.as_array().is_some_and(|arr| arr.is_empty())
}

fn merge_player_rows(base: &Value, overlay: &Value) -> Value {
    let (Some(base_obj), Some(overlay_obj)) = (base.as_object(), overlay.as_object()) else {
        return base.clone();
    };

    let mut next = base_obj.clone();
    for (key, value) in overlay_obj {
        if key == "Stats" {
            if let Some(overlay_stats) = value.as_object() {
                let merged_stats = next
                    .get("Stats")
                    .and_then(|v| v.as_object())
                    .map(|base_stats| {
                        let mut combined = base_stats.clone();
                        for (stats_key, stats_val) in overlay_stats {
                            if !is_blank_value(stats_val) {
                                combined.insert(stats_key.clone(), stats_val.clone());
                            }
                        }
                        Value::Object(combined)
                    })
                    .unwrap_or_else(|| Value::Object(overlay_stats.clone()));
                next.insert("Stats".into(), merged_stats);
            } else if !is_blank_value(value) {
                next.insert(key.clone(), value.clone());
            }
            continue;
        }
        if next.get(key).is_none_or(is_blank_value) && !is_blank_value(value) {
            next.insert(key.clone(), value.clone());
        }
    }
    Value::Object(next)
}

fn merge_players_by_subject(base: Vec<Value>, overlay: &[Value]) -> Vec<Value> {
    let mut overlay_by_subject = HashMap::new();
    for row in overlay {
        if let Some(subject) = subject_of(row) {
            overlay_by_subject.insert(subject.to_lowercase(), row.clone());
        }
    }

    let mut seen = HashSet::new();
    let mut merged = Vec::with_capacity(base.len().max(overlay.len()));
    for row in base {
        if let Some(subject) = subject_of(&row) {
            let key = subject.to_lowercase();
            seen.insert(key.clone());
            if let Some(extra) = overlay_by_subject.get(&key) {
                merged.push(merge_player_rows(&row, extra));
                continue;
            }
        }
        merged.push(row);
    }

    for row in overlay {
        let Some(subject) = subject_of(row) else {
            continue;
        };
        let key = subject.to_lowercase();
        if seen.insert(key) {
            merged.push(row.clone());
        }
    }

    dedupe_players(merged)
}

fn merge_team_ids(players: Vec<Value>, team_sources: &[Value]) -> Vec<Value> {
    let mut by_subject = HashMap::new();
    for row in team_sources {
        let Some(subject) = subject_of(row) else {
            continue;
        };
        let Some(team) = team_id(row) else {
            continue;
        };
        by_subject.insert(subject.to_lowercase(), team);
    }

    players
        .into_iter()
        .map(|row| {
            if team_id(&row).is_some() {
                return row;
            }
            let inferred = subject_of(&row)
                .and_then(|subject| by_subject.get(&subject.to_lowercase()).cloned());
            stamp_team_id(&row, inferred.as_deref())
        })
        .collect()
}

fn pregame_players(match_json: &Value) -> Vec<Value> {
    let mut flat = Vec::new();
    if let Some(ally) = match_json.get("AllyTeam") {
        collect_players(&mut flat, ally, Some("Blue"));
    }
    if let Some(enemy) = match_json.get("EnemyTeam") {
        collect_players(&mut flat, enemy, Some("Red"));
    }
    collect_players(&mut flat, &match_json["Players"], None);
    if let Some(teams) = match_json.get("Teams").and_then(|v| v.as_array()) {
        for t in teams {
            let team = str_field(t, &["TeamID", "TeamId", "teamId"]);
            collect_players(&mut flat, t, team.as_deref());
        }
    }
    dedupe_players(flat)
}

fn team_players(match_json: &Value) -> Vec<Value> {
    let mut flat = Vec::new();
    if let Some(teams) = match_json.get("Teams").and_then(|v| v.as_array()) {
        for t in teams {
            let team = str_field(t, &["TeamID", "TeamId", "teamId"]);
            collect_players(&mut flat, t, team.as_deref());
        }
    }
    dedupe_players(flat)
}

fn core_game_players(match_json: &Value) -> Vec<Value> {
    let players = dedupe_players(players_array(&match_json["Players"]));
    if !players.is_empty() {
        let from_teams = team_players(match_json);
        if !from_teams.is_empty() {
            return merge_team_ids(players, &from_teams);
        }
        return players;
    }
    let from_teams = team_players(match_json);
    if !from_teams.is_empty() {
        return from_teams;
    }
    pregame_players(match_json)
}

fn probe_cache_ttl(phase: &str) -> Duration {
    match phase {
        "match" | "pregame" => ACTIVE_PROBE_CACHE_TTL,
        "queue" => QUEUE_PROBE_CACHE_TTL,
        _ => IDLE_PROBE_CACHE_TTL,
    }
}

/// Probe local Valorant presence (map, mode, self agent, score).
pub fn probe_riot_presence() -> AppResult<Option<RiotLive>> {
    {
        let cache = PROBE_CACHE.get_or_init(|| Mutex::new(None)).lock();
        if let Some(c) = cache.as_ref() {
            if c.at.elapsed() < c.ttl {
                return Ok(Some(c.live.clone()));
            }
        }
    }

    let live = probe_riot_presence_inner()?;
    if let Some(ref l) = live {
        *PROBE_CACHE.get_or_init(|| Mutex::new(None)).lock() = Some(CachedProbe {
            at: Instant::now(),
            ttl: probe_cache_ttl(&l.phase),
            live: l.clone(),
        });
    } else {
        *PROBE_CACHE.get_or_init(|| Mutex::new(None)).lock() = None;
    }
    Ok(live)
}

fn probe_riot_presence_inner() -> AppResult<Option<RiotLive>> {
    let Some(lock) = read_lockfile() else {
        return Ok(None);
    };
    let session = local_get(&lock, "/chat/v1/session");
    let presences = local_get(&lock, "/chat/v4/presences");
    let (Some(session), Some(presences)) = (session, presences) else {
        return Ok(None);
    };
    let Some(puuid) = str_field(&session, &["puuid", "cid"]) else {
        return Ok(None);
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
    let product =
        str_field(&self_row, &["product", "productName"]).unwrap_or_else(|| "riot".into());
    let private_raw = str_field(&self_row, &["private"]).unwrap_or_default();
    let private = decode_private(&private_raw)
        .map(|v| flatten(&v))
        .unwrap_or(Value::Null);

    let is_val = product.to_lowercase().contains("valorant")
        || product.eq_ignore_ascii_case("vng")
        || private.get("sessionLoopState").is_some()
        || private.get("isValid").is_some();

    if !is_val {
        return Ok(Some(RiotLive {
            product: product.to_lowercase(),
            title: "League of Legends".into(),
            details: "League of Legends".into(),
            state: "In client".into(),
            phase: "lobby".into(),
            board: MatchBoard {
                active: false,
                product: "league".into(),
                title: "League of Legends".into(),
                details: "League of Legends".into(),
                state: "In client".into(),
                phase: "lobby".into(),
                ..Default::default()
            },
            self_agent_id: None,
            map_id: None,
            queue_id: None,
        }));
    }

    let party = party_label(&private);
    let mode_chat = queue_from_private(&private);
    let chat_queue_raw = raw_queue_from_private(&private);
    let chat_score = chat_team_score(&private);
    let map_path_chat = str_field(
        &private,
        &["matchMap", "partyOwnerMatchMap", "MapID", "mapId"],
    );
    let (map_chat_name, map_chat_id) = map_path_chat
        .as_deref()
        .map(map_from_path)
        .unwrap_or_else(|| (String::new(), None));

    let core = fetch_core_board(&lock, &puuid);
    let pre = fetch_pregame_board(&lock, &puuid);
    let has_core = core.is_some();
    let has_pregame = pre.is_some();
    let phase = phase_from_chat(&private, has_core, has_pregame).to_string();

    let map = core.as_ref().and_then(|c| c.map.clone()).or_else(|| {
        pre.as_ref()
            .and_then(|p| p.map.clone())
            .or(if map_chat_name.is_empty() {
                None
            } else {
                Some(map_chat_name.clone())
            })
    });
    let map_id = core
        .as_ref()
        .and_then(|c| c.map_id.clone())
        .or_else(|| pre.as_ref().and_then(|p| p.map_id.clone()))
        .or(map_chat_id);
    // Prefer chat queue id for score mode (v7): recovers TDM when local ModeID was misread as DM.
    let queue_id = chat_queue_raw
        .as_ref()
        .and_then(|raw| {
            let labeled = queue_label(raw);
            if is_team_deathmatch_queue(raw) || labeled.eq_ignore_ascii_case("Team Deathmatch") {
                Some("hurm".into())
            } else if is_ffa_deathmatch_queue(raw) || labeled.eq_ignore_ascii_case("Deathmatch") {
                Some("deathmatch".into())
            } else if raw.len() < 32 && raw.chars().all(|c| c.is_ascii_alphanumeric()) {
                Some(raw.to_lowercase())
            } else {
                match_queue_id(&serde_json::json!({ "QueueID": raw }))
            }
        })
        .or_else(|| core.as_ref().and_then(|c| c.queue_id.clone()))
        .or_else(|| pre.as_ref().and_then(|p| p.queue_id.clone()))
        .or_else(|| {
            mode_chat
                .as_ref()
                .map(|m| m.to_lowercase().replace(' ', ""))
        });
    let mode = queue_id
        .as_ref()
        .map(|q| queue_label(q))
        .or_else(|| mode_chat.clone())
        .or_else(|| core.as_ref().and_then(|c| c.mode.clone()))
        .or_else(|| pre.as_ref().and_then(|p| p.mode.clone()));
    let local_score = core.as_ref().and_then(|c| c.score.clone());
    let self_kda = core.as_ref().and_then(|c| c.self_kda.clone());
    let score = resolve_presence_score(
        phase == "match",
        queue_id.as_deref(),
        local_score.as_deref(),
        self_kda.as_deref(),
        chat_score.as_deref(),
    );
    let chat_agent_id = str_field(
        &private,
        &[
            "characterId",
            "CharacterID",
            "CharacterId",
            "selectedAgent",
            "SelectedAgent",
        ],
    );
    let self_agent_id = core
        .as_ref()
        .and_then(|c| c.self_agent_id.clone())
        .or_else(|| pre.as_ref().and_then(|p| p.self_agent_id.clone()))
        .or(chat_agent_id);
    let self_agent = self_agent_id
        .as_ref()
        .and_then(|id| agent_name(id))
        .or_else(|| core.as_ref().and_then(|c| c.self_agent.clone()))
        .or_else(|| pre.as_ref().and_then(|p| p.self_agent.clone()));

    let (details, state) = match phase.as_str() {
        "match" => {
            // FFA DM already puts kills in score — skip duplicate KDA (v7 presence-builder).
            let show_kda = self_kda.as_ref().filter(|_| {
                !(queue_id
                    .as_deref()
                    .is_some_and(is_ffa_deathmatch_queue)
                    && score.is_some())
            });
            (
                join(&[self_agent.as_deref(), map.as_deref()]).or_else(|| Some("VALORANT".into())),
                join(&[
                    score.as_deref(),
                    party.as_deref(),
                    mode.as_deref(),
                    show_kda.map(|s| s.as_str()),
                ]),
            )
        }
        "pregame" => (
            Some(
                join(&[self_agent.as_deref(), Some("Agent Select"), map.as_deref()])
                    .unwrap_or_else(|| {
                        join(&[Some("Agent Select"), map.as_deref()])
                            .unwrap_or_else(|| "Agent Select".into())
                    }),
            ),
            join(&[party.as_deref(), mode.as_deref()]),
        ),
        "queue" => (
            Some("VALORANT".into()),
            join(&[Some("Queue"), mode.as_deref(), party.as_deref()]),
        ),
        _ => (
            Some("VALORANT".into()),
            join(&[mode.as_deref(), party.as_deref(), Some("In lobby")]),
        ),
    };

    let details = details.unwrap_or_else(|| "VALORANT".into());
    let state = state.unwrap_or_else(|| "In lobby".into());
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let board = MatchBoard {
        active: true,
        product: "valorant".into(),
        title: "VALORANT".into(),
        details: details.clone(),
        state: state.clone(),
        phase: phase.clone(),
        map: map.clone(),
        map_id: map_id.clone(),
        mode: mode.clone(),
        queue_id: queue_id.clone(),
        score: score.clone(),
        party: party.clone(),
        self_agent: self_agent.clone(),
        self_agent_id: self_agent_id.clone(),
        self_kda: self_kda.clone(),
        updated_at: now,
    };

    Ok(Some(RiotLive {
        product: "valorant".into(),
        title: "VALORANT".into(),
        details,
        state,
        phase,
        board,
        self_agent_id,
        map_id,
        queue_id,
    }))
}

struct BoardBits {
    map: Option<String>,
    map_id: Option<String>,
    mode: Option<String>,
    queue_id: Option<String>,
    score: Option<String>,
    self_agent: Option<String>,
    self_agent_id: Option<String>,
    self_kda: Option<String>,
}

fn fetch_core_board(lock: &Lockfile, puuid: &str) -> Option<BoardBits> {
    let player = local_get(lock, &format!("/core-game/v1/players/{puuid}"))?;
    let match_id = str_field(&player, &["MatchID", "MatchId", "matchId"])?;
    let match_json = local_get(lock, &format!("/core-game/v1/matches/{match_id}"))?;
    let scoreboard = local_get(
        lock,
        &format!("/core-game/v1/matches/{match_id}/scoreboard"),
    );

    let scoreboard_players = scoreboard
        .as_ref()
        .map(core_game_players)
        .unwrap_or_default();
    let players_raw = if scoreboard_players.is_empty() {
        core_game_players(&match_json)
    } else {
        merge_players_by_subject(core_game_players(&match_json), &scoreboard_players)
    };
    let self_row = players_raw.iter().find(|p| {
        subject_of(p)
            .map(|s| s.eq_ignore_ascii_case(puuid))
            .unwrap_or(false)
    });
    let self_agent_id = pick_agent_id(&[self_row, Some(&player)]);
    let self_agent = self_agent_id.as_ref().and_then(|id| agent_name(id));
    let self_kda = self_row.and_then(|p| kda_of(p));
    let queue_id = match_queue_id(&match_json);
    // Team scores come from the match payload (NumPoints / RoundScore). Scoreboard is
    // merged only for player KDA/kills — preferring scoreboard Teams poisoned TDM with 0-0.
    let score = local_match_score(&match_json, &players_raw, self_row, queue_id.as_deref());
    let map_path = str_field(&match_json, &["MapID", "MapId", "mapId"]);
    let (map, map_id) = map_path.as_deref().map(map_from_path).unwrap_or_default();
    let mode = queue_id.as_ref().map(|q| queue_label(q));

    Some(BoardBits {
        map: if map.is_empty() { None } else { Some(map) },
        map_id,
        mode,
        queue_id,
        score,
        self_agent,
        self_agent_id,
        self_kda,
    })
}

fn fetch_pregame_board(lock: &Lockfile, puuid: &str) -> Option<BoardBits> {
    let player = local_get(lock, &format!("/pregame/v1/players/{puuid}"))?;
    let match_id = str_field(&player, &["MatchID", "MatchId", "matchId"])?;
    let match_json = local_get(lock, &format!("/pregame/v1/matches/{match_id}"))?;
    let players_raw = pregame_players(&match_json);
    let self_row = players_raw.iter().find(|p| {
        subject_of(p)
            .map(|s| s.eq_ignore_ascii_case(puuid))
            .unwrap_or(false)
    });
    let self_agent_id = pick_agent_id(&[self_row, Some(&player)]);
    let self_agent = self_agent_id.as_ref().and_then(|id| agent_name(id));
    let queue_id = match_queue_id(&match_json);
    let map_path = str_field(&match_json, &["MapID", "MapId", "mapId"]);
    let (map, map_id) = map_path.as_deref().map(map_from_path).unwrap_or_default();
    let mode = queue_id.as_ref().map(|q| queue_label(q));

    Some(BoardBits {
        map: if map.is_empty() { None } else { Some(map) },
        map_id,
        mode,
        queue_id,
        score: None,
        self_agent,
        self_agent_id,
        self_kda: None,
    })
}

fn join(parts: &[Option<&str>]) -> Option<String> {
    let v: Vec<&str> = parts
        .iter()
        .filter_map(|p| *p)
        .filter(|p| !p.is_empty())
        .collect();
    if v.is_empty() {
        None
    } else {
        Some(v.join(" · "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const JETT: &str = "add6443a-41bd-e414-f6ad-e58d267f4e95";

    #[test]
    fn character_id_reads_player_identity() {
        let p = json!({
            "PlayerIdentity": { "CharacterID": JETT }
        });
        assert_eq!(character_id(&p).as_deref(), Some(JETT));
    }

    #[test]
    fn tdm_num_points_ally_first() {
        let match_json = json!({
            "Teams": [
                { "TeamID": "Red", "NumPoints": 48 },
                { "TeamID": "Blue", "NumPoints": 62 }
            ],
            "Players": [
                { "Subject": "me", "TeamID": "Blue" }
            ]
        });
        let self_row = match_json["Players"][0].clone();
        assert_eq!(
            match_score_hint(&match_json, Some(&self_row), Some("hurm"), None).as_deref(),
            Some("62-48")
        );
    }

    #[test]
    fn tdm_ignores_scoreboard_round_score_zero() {
        // Scoreboard often has RoundScore 0-0 for TDM; NumPoints lives on match payload / chat.
        let scoreboard = json!({
            "Teams": [
                { "TeamID": "Blue", "RoundScore": 0 },
                { "TeamID": "Red", "RoundScore": 0 }
            ],
            "Players": [
                { "Subject": "me", "TeamID": "Blue", "Stats": { "Kills": 9, "Deaths": 4, "Assists": 1 } }
            ]
        });
        let match_json = json!({
            "ModeID": "/Game/GameModes/TeamDeathmatch/TeamDeathmatch_PrimaryAsset",
            "Teams": [
                { "TeamID": "Red", "NumPoints": 55 },
                { "TeamID": "Blue", "NumPoints": 71 }
            ],
            "Players": [
                { "Subject": "me", "TeamID": "Blue" }
            ]
        });
        let players = merge_players_by_subject(
            core_game_players(&match_json),
            &core_game_players(&scoreboard),
        );
        let self_row = players.iter().find(|p| subject_of(p).as_deref() == Some("me"));
        let local = local_match_score(&match_json, &players, self_row, Some("hurm"));
        assert_eq!(local.as_deref(), Some("71-55"));
        // Poisoned scoreboard alone must not win over chat when match has no NumPoints path used
        let poisoned = local_match_score(&scoreboard, &players, self_row, Some("hurm"));
        assert!(
            poisoned.is_none() || poisoned.as_deref() != Some("0-0"),
            "TDM must not treat RoundScore 0-0 as the live score: {poisoned:?}"
        );
        assert_eq!(
            resolve_presence_score(true, Some("hurm"), poisoned.as_deref(), None, Some("71-55"))
                .as_deref(),
            Some("71-55")
        );
    }

    #[test]
    fn tdm_recovers_chat_score_when_local_misclassified_as_dm() {
        // Local leftover "9 kills" + chat queue hurm → team score wins (v7.9.25 regression).
        assert_eq!(
            resolve_presence_score(
                true,
                Some("hurm"),
                Some("9 kills"),
                Some("9/3/1"),
                Some("40-33"),
            )
            .as_deref(),
            Some("40-33")
        );
    }

    #[test]
    fn dm_kills_only_never_chat_team_score() {
        assert_eq!(
            resolve_presence_score(
                true,
                Some("deathmatch"),
                Some("14 kills"),
                Some("14/8/2"),
                Some("3-2"),
            )
            .as_deref(),
            Some("14 kills")
        );
        assert_eq!(
            resolve_presence_score(true, Some("deathmatch"), None, Some("14/8/2"), Some("3-2"))
                .as_deref(),
            Some("14 kills")
        );
        assert_eq!(
            resolve_presence_score(true, Some("deathmatch"), None, None, Some("3-2")).as_deref(),
            None
        );
    }

    #[test]
    fn dm_reads_string_and_float_kills() {
        let row = json!({
            "Subject": "me",
            "Stats": { "Kills": "14", "Deaths": 8.0, "Assists": 2 }
        });
        assert_eq!(kills_only(&row).as_deref(), Some("14 kills"));
        assert_eq!(kda_of(&row).as_deref(), Some("14/8/2"));
    }

    #[test]
    fn tdm_kills_sum_skips_players_without_stats() {
        let match_json = json!({
            "QueueID": "hurm",
            "Players": [
                { "Subject": "coach", "IsCoach": true },
                {
                    "Subject": "me",
                    "TeamID": "Blue",
                    "Stats": { "Kills": 10, "Deaths": 2, "Assists": 1 }
                },
                {
                    "Subject": "ally",
                    "TeamID": "Blue",
                    "Stats": { "Kills": 5, "Deaths": 3, "Assists": 0 }
                },
                {
                    "Subject": "enemy",
                    "TeamID": "Red",
                    "Stats": { "Kills": 12, "Deaths": 4, "Assists": 2 }
                }
            ]
        });
        let self_row = &match_json["Players"][1];
        assert_eq!(
            match_score_hint(&match_json, Some(self_row), Some("hurm"), None).as_deref(),
            Some("15-12")
        );
    }

    #[test]
    fn comp_still_uses_round_score() {
        let match_json = json!({
            "QueueID": "competitive",
            "Teams": [
                { "TeamID": "Blue", "RoundScore": 8 },
                { "TeamID": "Red", "RoundScore": 6 }
            ],
            "Players": [{ "Subject": "me", "TeamID": "Blue" }]
        });
        let self_row = &match_json["Players"][0];
        assert_eq!(
            match_score_hint(&match_json, Some(self_row), Some("competitive"), None).as_deref(),
            Some("8-6")
        );
    }

    #[test]
    fn pregame_players_from_ally_team_object() {
        let m = json!({
            "AllyTeam": {
                "Players": [
                    { "Subject": "a", "CharacterID": JETT },
                    { "Subject": "b" }
                ]
            }
        });
        assert_eq!(pregame_players(&m).len(), 2);
    }

    #[test]
    fn pregame_players_from_ally_team_array() {
        let m = json!({
            "AllyTeam": [
                { "Subject": "a", "CharacterID": JETT },
                { "Subject": "b" }
            ]
        });
        assert_eq!(pregame_players(&m).len(), 2);
    }

    #[test]
    fn pregame_players_stamp_ally_and_enemy_teams() {
        let rows = pregame_players(&json!({
            "AllyTeam": {
                "Players": [
                    { "Subject": "me", "CharacterID": JETT },
                    { "Subject": "ally-2" }
                ]
            },
            "EnemyTeam": [
                { "Subject": "enemy-1" },
                { "Subject": "enemy-2" }
            ]
        }));
        assert_eq!(rows.len(), 4);
        assert_eq!(
            rows.iter()
                .find(|p| subject_of(p).as_deref() == Some("ally-2"))
                .and_then(team_id)
                .as_deref(),
            Some("Blue")
        );
        assert_eq!(
            rows.iter()
                .find(|p| subject_of(p).as_deref() == Some("enemy-1"))
                .and_then(team_id)
                .as_deref(),
            Some("Red")
        );
    }

    #[test]
    fn core_game_players_merge_team_ids_from_teams() {
        let rows = core_game_players(&json!({
            "Players": [
                { "Subject": "me", "CharacterID": JETT },
                { "Subject": "ally-2" },
                { "Subject": "enemy-1" }
            ],
            "Teams": [
                {
                    "TeamID": "Blue",
                    "Players": [
                        { "Subject": "me" },
                        { "Subject": "ally-2" }
                    ]
                },
                {
                    "TeamID": "Red",
                    "Players": [
                        { "Subject": "enemy-1" }
                    ]
                }
            ]
        }));
        assert_eq!(
            rows.iter()
                .find(|p| subject_of(p).as_deref() == Some("ally-2"))
                .and_then(team_id)
                .as_deref(),
            Some("Blue")
        );
        assert_eq!(
            rows.iter()
                .find(|p| subject_of(p).as_deref() == Some("enemy-1"))
                .and_then(team_id)
                .as_deref(),
            Some("Red")
        );
    }

    #[test]
    fn merge_players_by_subject_keeps_match_identity_and_scoreboard_stats() {
        let merged = merge_players_by_subject(
            vec![json!({
                "Subject": "me",
                "CharacterID": JETT,
                "TeamID": "Blue"
            })],
            &[json!({
                "Subject": "me",
                "Stats": { "Kills": 17, "Deaths": 9, "Assists": 4 }
            })],
        );
        assert_eq!(merged.len(), 1);
        assert_eq!(character_id(&merged[0]).as_deref(), Some(JETT));
        assert_eq!(kda_of(&merged[0]).as_deref(), Some("17/9/4"));
    }

    #[test]
    fn probe_cache_ttl_prefers_fast_match_refresh() {
        assert_eq!(probe_cache_ttl("match"), ACTIVE_PROBE_CACHE_TTL);
        assert_eq!(probe_cache_ttl("queue"), QUEUE_PROBE_CACHE_TTL);
        assert_eq!(probe_cache_ttl("lobby"), IDLE_PROBE_CACHE_TTL);
    }
}
