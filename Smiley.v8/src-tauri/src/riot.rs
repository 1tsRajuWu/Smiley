//! Local Riot Client — Valorant live match board (local-only).
//! Lockfile + 127.0.0.1 HTTPS only. No inject, no memory reads.
//! Riot IDs come from local name-service when available; PUUID never leaves to UI.

use crate::error::AppResult;
use crate::valorant_catalog::{
    agent_display_name, is_ffa_deathmatch_queue, is_team_deathmatch_queue, match_queue_id,
    queue_label, resolve_map,
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

const TIMEOUT: Duration = Duration::from_secs(3);
const AGENT_TTL: Duration = Duration::from_secs(86_400);
const PROBE_CACHE_TTL: Duration = Duration::from_millis(3500);

#[derive(Debug, Clone, Copy, Default)]
pub struct RiotProbeOptions {
    /// Skip local name-service when false (faster + privacy default).
    pub resolve_names: bool,
}

struct CachedProbe {
    at: Instant,
    live: RiotLive,
}

static PROBE_CACHE: OnceLock<Mutex<Option<CachedProbe>>> = OnceLock::new();
static HTTP: OnceLock<reqwest::blocking::Client> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MatchPlayer {
    pub seat: String,
    pub name: String,
    pub agent: Option<String>,
    pub agent_id: Option<String>,
    pub agent_icon: Option<String>,
    pub kda: Option<String>,
    pub is_self: bool,
    #[serde(skip_serializing)]
    pub team: Option<String>,
}

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
    pub ally_count: Option<u32>,
    pub enemy_count: Option<u32>,
    pub players: Vec<MatchPlayer>,
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

fn chat_team_score(private: &Value) -> Option<String> {
    let ally = private
        .get("partyOwnerMatchScoreAllyTeam")
        .or_else(|| private.get("partyOwnerMatchCurrentTeamRoundScore"))
        .or_else(|| private.get("matchScoreAllyTeam"))
        .or_else(|| private.get("allyScore"))
        .and_then(|v| v.as_i64());
    let enemy = private
        .get("partyOwnerMatchScoreEnemyTeam")
        .or_else(|| private.get("matchScoreEnemyTeam"))
        .or_else(|| private.get("enemyScore"))
        .and_then(|v| v.as_i64());
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
    let map_id = resolved
        .uuid
        .clone()
        .or_else(|| if path.len() == 36 { Some(path.to_string()) } else { None });
    let name = if resolved.name.is_empty() {
        path.split('/').filter(|s| !s.is_empty()).last().unwrap_or(path).to_string()
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
    let k = stats.get("Kills").or_else(|| stats.get("kills"))?.as_i64()?;
    let d = stats
        .get("Deaths")
        .or_else(|| stats.get("deaths"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let a = stats
        .get("Assists")
        .or_else(|| stats.get("assists"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    Some(format!("{k}/{d}/{a}"))
}

fn kills_only(p: &Value) -> Option<String> {
    let stats = p.get("Stats").unwrap_or(p);
    let k = stats.get("Kills").or_else(|| stats.get("kills"))?.as_i64()?;
    Some(format!("{k} kills"))
}

fn team_points(team: &Value) -> Option<i64> {
    for k in [
        "NumPoints",
        "numPoints",
        "RoundsWon",
        "roundsWon",
        "RoundScore",
        "roundScore",
        "Score",
        "score",
        "points",
    ] {
        if let Some(n) = team.get(k).and_then(|v| v.as_i64()) {
            return Some(n);
        }
    }
    None
}

fn team_score_from_teams(match_json: &Value, self_team: Option<&str>) -> Option<String> {
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
            let pts = team_points(t)?;
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
        let tid = team_id(p)?;
        let k = p.get("Stats").or(Some(p))?;
        let kills = k.get("Kills").or_else(|| k.get("kills"))?.as_i64()?;
        *by_team.entry(tid).or_insert(0) += kills;
    }
    if by_team.len() < 2 {
        return None;
    }
    let entries: Vec<(String, i64)> = by_team.into_iter().collect();
    if let Some(want) = self_team {
        let want = want.to_lowercase();
        let ally = entries.iter().find(|(id, _)| id.to_lowercase() == want);
        let enemy = entries.iter().find(|(id, _)| ally.is_none_or(|(aid, _)| id != aid));
        if let (Some((_, a)), Some((_, e))) = (ally, enemy) {
            return Some(format!("{a}-{e}"));
        }
    }
    Some(format!("{}-{}", entries[0].1, entries[1].1))
}

fn match_score_hint(
    match_json: &Value,
    self_row: Option<&Value>,
    queue_id: Option<&str>,
    chat_score: Option<&str>,
) -> Option<String> {
    let q = queue_id.unwrap_or("");
    let self_team = self_row.and_then(team_id);

    if is_ffa_deathmatch_queue(q) {
        return self_row
            .and_then(kills_only)
            .or_else(|| self_row.and_then(kda_of).map(|k| format!("{} kills", k.split('/').next().unwrap_or("0"))));
    }

    let from_teams = team_score_from_teams(match_json, self_team.as_deref());
    if from_teams.is_some() {
        return from_teams;
    }

    if is_team_deathmatch_queue(q) {
        let players = core_game_players(match_json);
        if let Some(s) = team_score_from_players(&players, self_team.as_deref()) {
            return Some(s);
        }
    }

    chat_score.map(|s| s.to_string())
}

fn extend_players(flat: &mut Vec<Value>, list: &Value) {
    flat.extend(players_array(list));
}

fn pregame_players(match_json: &Value) -> Vec<Value> {
    let mut flat = Vec::new();
    if let Some(ally) = match_json.get("AllyTeam") {
        if ally.is_array() {
            extend_players(&mut flat, ally);
        } else {
            if let Some(p) = ally.get("Players") {
                extend_players(&mut flat, p);
            }
            if let Some(c) = ally.get("Characters") {
                extend_players(&mut flat, c);
            }
            if ally.get("Players").is_none() && !ally.is_array() {
                extend_players(&mut flat, ally);
            }
        }
    }
    if let Some(enemy) = match_json.get("EnemyTeam") {
        if let Some(p) = enemy.get("Players") {
            extend_players(&mut flat, p);
        }
    }
    extend_players(&mut flat, &match_json["Players"]);
    if let Some(teams) = match_json.get("Teams").and_then(|v| v.as_array()) {
        for t in teams {
            if let Some(p) = t.get("Players") {
                extend_players(&mut flat, p);
            }
            if t.get("Subject").is_some() || character_id(t).is_some() {
                flat.push(t.clone());
            }
        }
    }
    flat
}

fn core_game_players(match_json: &Value) -> Vec<Value> {
    let players = players_array(&match_json["Players"]);
    if !players.is_empty() {
        return players;
    }
    pregame_players(match_json)
}

fn resolve_names(lock: &Lockfile, puuids: &[String]) -> HashMap<String, String> {
    let mut out = HashMap::new();
    if puuids.is_empty() {
        return out;
    }
    let body = Value::Array(puuids.iter().map(|p| json!(p)).collect());
    let res = local_post_json(lock, "/name-service/v2/players", &body)
        .or_else(|| local_post_json(lock, "/player-name-service/v2/players", &body));
    let Some(Value::Array(arr)) = res else {
        return out;
    };
    for row in arr {
        let sub = str_field(&row, &["Subject", "subject", "puuid"]).unwrap_or_default();
        if sub.is_empty() {
            continue;
        }
        let game = str_field(&row, &["GameName", "gameName", "DisplayName", "displayName"]);
        let tag = str_field(&row, &["TagLine", "tagLine", "Tag"]);
        let name = match (game, tag) {
            (Some(g), Some(t)) => format!("{g}#{t}"),
            (Some(g), None) => g,
            _ => str_field(&row, &["DisplayName", "displayName"]).unwrap_or_else(|| "Player".into()),
        };
        out.insert(sub.to_lowercase(), name);
    }
    out
}

fn build_player(
    p: &Value,
    self_puuid: &str,
    self_team: Option<&str>,
    names: &HashMap<String, String>,
    with_kda: bool,
) -> Option<MatchPlayer> {
    let sub = subject_of(p)?;
    let is_self = sub.eq_ignore_ascii_case(self_puuid);
    let tid = team_id(p);
    let seat = if let (Some(st), Some(tid)) = (self_team, tid.as_deref()) {
        if tid.eq_ignore_ascii_case(st) {
            "Ally"
        } else {
            "Enemy"
        }
    } else if is_self {
        "Ally"
    } else {
        "Enemy"
    };
    let aid = character_id(p);
    let agent = aid.as_ref().and_then(|id| agent_name(id));
    let icon = aid.as_ref().map(|id| agent_icon(id));
    let name = names
        .get(&sub.to_lowercase())
        .cloned()
        .unwrap_or_else(|| if is_self { "You".into() } else { "Player".into() });
    Some(MatchPlayer {
        seat: seat.into(),
        name,
        agent,
        agent_id: aid,
        agent_icon: icon,
        kda: if with_kda { kda_of(p) } else { None },
        is_self,
        team: tid,
    })
}

fn count_seats(players: &[MatchPlayer]) -> (u32, u32) {
    let mut ally = 0u32;
    let mut enemy = 0u32;
    for p in players {
        if p.seat == "Enemy" {
            enemy += 1;
        } else {
            ally += 1;
        }
    }
    (ally, enemy)
}

/// Probe local Valorant truth + full match board for UI.
pub fn probe_riot_presence() -> AppResult<Option<RiotLive>> {
    probe_riot_presence_opts(RiotProbeOptions::default())
}

pub fn probe_riot_presence_opts(opts: RiotProbeOptions) -> AppResult<Option<RiotLive>> {
    {
        let cache = PROBE_CACHE.get_or_init(|| Mutex::new(None)).lock();
        if let Some(c) = cache.as_ref() {
            if c.at.elapsed() < PROBE_CACHE_TTL {
                return Ok(Some(c.live.clone()));
            }
        }
    }

    let live = probe_riot_presence_inner(opts)?;
    if let Some(ref l) = live {
        *PROBE_CACHE.get_or_init(|| Mutex::new(None)).lock() = Some(CachedProbe {
            at: Instant::now(),
            live: l.clone(),
        });
    } else {
        *PROBE_CACHE.get_or_init(|| Mutex::new(None)).lock() = None;
    }
    Ok(live)
}

fn probe_riot_presence_inner(opts: RiotProbeOptions) -> AppResult<Option<RiotLive>> {
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
                active: true,
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
    let chat_score = chat_team_score(&private);
    let map_path_chat = str_field(
        &private,
        &["matchMap", "partyOwnerMatchMap", "MapID", "mapId"],
    );
    let (map_chat_name, map_chat_id) = map_path_chat
        .as_deref()
        .map(map_from_path)
        .unwrap_or_else(|| (String::new(), None));

    let core = fetch_core_board(&lock, &puuid, opts.resolve_names, chat_score.as_deref());
    let pre = fetch_pregame_board(&lock, &puuid, opts.resolve_names);
    let has_core = core.is_some();
    let has_pregame = pre.is_some();
    let phase = phase_from_chat(&private, has_core, has_pregame).to_string();

    let mut map = core.as_ref().and_then(|c| c.map.clone()).or_else(|| {
        pre.as_ref().and_then(|p| p.map.clone()).or(if map_chat_name.is_empty() {
            None
        } else {
            Some(map_chat_name.clone())
        })
    });
    let mut map_id = core
        .as_ref()
        .and_then(|c| c.map_id.clone())
        .or_else(|| pre.as_ref().and_then(|p| p.map_id.clone()))
        .or(map_chat_id);
    let mut mode = core
        .as_ref()
        .and_then(|c| c.mode.clone())
        .or_else(|| pre.as_ref().and_then(|p| p.mode.clone()))
        .or_else(|| mode_chat.clone());
    let mut queue_id = core
        .as_ref()
        .and_then(|c| c.queue_id.clone())
        .or_else(|| pre.as_ref().and_then(|p| p.queue_id.clone()))
        .or_else(|| mode_chat.as_ref().map(|m| m.to_lowercase().replace(' ', "")));
    let mut score = core.as_ref().and_then(|c| c.score.clone());
    if score.is_none() && phase == "match" {
        score = chat_score.clone();
    }
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
    let mut self_agent_id = core
        .as_ref()
        .and_then(|c| c.self_agent_id.clone())
        .or_else(|| pre.as_ref().and_then(|p| p.self_agent_id.clone()))
        .or(chat_agent_id);
    let mut self_agent = self_agent_id
        .as_ref()
        .and_then(|id| agent_name(id))
        .or_else(|| core.as_ref().and_then(|c| c.self_agent.clone()))
        .or_else(|| pre.as_ref().and_then(|p| p.self_agent.clone()));
    let self_kda = core.as_ref().and_then(|c| c.self_kda.clone());
    let mut players = if has_core {
        core.as_ref().map(|c| c.players.clone()).unwrap_or_default()
    } else {
        pre.as_ref().map(|p| p.players.clone()).unwrap_or_default()
    };
    let (ally_count, enemy_count) = count_seats(&players);

    let roster = roster_hint(&players, ally_count, enemy_count);

    let (details, state) = match phase.as_str() {
        "match" => (
            join(&[self_agent.as_deref(), map.as_deref()]).or_else(|| Some("VALORANT".into())),
            join(&[
                score.as_deref(),
                party.as_deref(),
                mode.as_deref(),
                roster.as_deref(),
                self_kda.as_deref(),
            ]),
        ),
        "pregame" => (
            Some(
                join(&[self_agent.as_deref(), Some("Agent Select"), map.as_deref()])
                    .unwrap_or_else(|| {
                        join(&[Some("Agent Select"), map.as_deref()])
                            .unwrap_or_else(|| "Agent Select".into())
                    }),
            ),
            join(&[party.as_deref(), mode.as_deref(), roster.as_deref()]),
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
        ally_count: Some(ally_count),
        enemy_count: Some(enemy_count),
        players,
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
    players: Vec<MatchPlayer>,
}

fn fetch_core_board(
    lock: &Lockfile,
    puuid: &str,
    do_resolve_names: bool,
    chat_score: Option<&str>,
) -> Option<BoardBits> {
    let player = local_get(lock, &format!("/core-game/v1/players/{puuid}"))?;
    let match_id = str_field(&player, &["MatchID", "MatchId", "matchId"])?;
    let match_json = local_get(lock, &format!("/core-game/v1/matches/{match_id}"))?;
    let _scoreboard = local_get(
        lock,
        &format!("/core-game/v1/matches/{match_id}/scoreboard"),
    );

    let players_raw = core_game_players(&match_json);
    let self_row = players_raw.iter().find(|p| {
        subject_of(p)
            .map(|s| s.eq_ignore_ascii_case(puuid))
            .unwrap_or(false)
    });
    let self_team = self_row.and_then(|p| team_id(p));
    let self_agent_id = pick_agent_id(&[self_row, Some(&player)]);
    let self_agent = self_agent_id.as_ref().and_then(|id| agent_name(id));
    let self_kda = self_row.and_then(|p| kda_of(p));
    let queue_id = match_queue_id(&match_json);
    let score = match_score_hint(&match_json, self_row, queue_id.as_deref(), chat_score);
    let map_path = str_field(&match_json, &["MapID", "MapId", "mapId"]);
    let (map, map_id) = map_path.as_deref().map(map_from_path).unwrap_or_default();
    let mode = queue_id.as_ref().map(|q| queue_label(q));

    let puuids: Vec<String> = players_raw.iter().filter_map(subject_of).collect();
    let names = if do_resolve_names {
        resolve_names(lock, &puuids)
    } else {
        HashMap::new()
    };
    let mut players: Vec<MatchPlayer> = players_raw
        .iter()
        .filter_map(|p| build_player(p, puuid, self_team.as_deref(), &names, true))
        .collect();
    players.sort_by(|a, b| {
        a.seat
            .cmp(&b.seat)
            .then(b.is_self.cmp(&a.is_self))
            .then(a.name.cmp(&b.name))
    });

    Some(BoardBits {
        map: if map.is_empty() { None } else { Some(map) },
        map_id,
        mode,
        queue_id,
        score,
        self_agent,
        self_agent_id,
        self_kda,
        players,
    })
}

fn fetch_pregame_board(lock: &Lockfile, puuid: &str, do_resolve_names: bool) -> Option<BoardBits> {
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

    let puuids: Vec<String> = players_raw.iter().filter_map(subject_of).collect();
    let names = if do_resolve_names {
        resolve_names(lock, &puuids)
    } else {
        HashMap::new()
    };
    let self_team = self_row
        .and_then(|p| team_id(p))
        .or_else(|| Some("Blue".into()));
    let mut players: Vec<MatchPlayer> = players_raw
        .iter()
        .filter_map(|p| build_player(p, puuid, self_team.as_deref(), &names, false))
        .collect();
    players.sort_by(|a, b| b.is_self.cmp(&a.is_self).then(a.name.cmp(&b.name)));

    Some(BoardBits {
        map: if map.is_empty() { None } else { Some(map) },
        map_id,
        mode,
        queue_id,
        score: None,
        self_agent,
        self_agent_id,
        self_kda: None,
        players,
    })
}

fn roster_hint(players: &[MatchPlayer], ally_count: u32, enemy_count: u32) -> Option<String> {
    let ally_agents: Vec<&str> = players
        .iter()
        .filter(|p| p.seat == "Ally")
        .filter_map(|p| p.agent.as_deref())
        .collect();
    if ally_agents.len() >= 2 {
        let preview: Vec<&str> = ally_agents.iter().copied().take(3).collect();
        let mut line = preview.join(", ");
        if ally_agents.len() > 3 {
            line.push('…');
        }
        return Some(line);
    }
    match (ally_count, enemy_count) {
        (a, e) if a > 0 && e > 0 => Some(format!("{a} allies · {e} enemies")),
        (a, 0) if a > 0 => Some(format!("{a} allies")),
        (0, e) if e > 0 => Some(format!("{e} enemies")),
        _ => None,
    }
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
    fn pregame_enemy_team_seat() {
        let players_raw = vec![
            json!({ "Subject": "me", "TeamID": "Blue", "CharacterID": JETT }),
            json!({ "Subject": "foe", "TeamID": "Red" }),
        ];
        let names = HashMap::new();
        let built: Vec<MatchPlayer> = players_raw
            .iter()
            .filter_map(|p| build_player(p, "me", Some("Blue"), &names, false))
            .collect();
        assert_eq!(built.len(), 2);
        assert!(built.iter().any(|p| p.is_self && p.seat == "Ally"));
        assert!(built.iter().any(|p| !p.is_self && p.seat == "Enemy"));
    }
}
