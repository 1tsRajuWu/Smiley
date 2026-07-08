//! Local Riot Client — Valorant live match board (Valshy-style, local-only).
//! Lockfile + 127.0.0.1 HTTPS only. No Tracker.gg, no inject, no memory reads.
//! Riot IDs come from local name-service when available; PUUID never leaves to UI.

use crate::error::AppResult;
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
    pub mode: Option<String>,
    pub score: Option<String>,
    pub party: Option<String>,
    pub self_agent: Option<String>,
    pub self_kda: Option<String>,
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

fn http_client() -> Option<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(TIMEOUT)
        .build()
        .ok()
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
    let client = http_client()?;
    let url = format!("https://127.0.0.1:{}{}", lock.port, path);
    let res = client
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
    let client = http_client()?;
    let url = format!("https://127.0.0.1:{}{}", lock.port, path);
    let res = client
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
    base
}

fn refresh_agents() {
    let mut cache = agent_cache().lock();
    if cache.at.elapsed() < AGENT_TTL && !cache.names.is_empty() {
        return;
    }
    let client = match http_client() {
        Some(c) => c,
        None => return,
    };
    let Ok(res) = client
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
    agent_cache().lock().names.get(&id.to_lowercase()).cloned()
}

fn agent_icon(id: &str) -> String {
    format!(
        "https://media.valorant-api.com/agents/{}/displayicon.png",
        id.to_lowercase()
    )
}

fn phase_from(private: &Value) -> &'static str {
    let loop_state = str_field(
        private,
        &["sessionLoopState", "session_loop_state", "partyState", "party_state"],
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

fn queue_label(id: &str) -> String {
    let key = id.to_lowercase();
    match key.as_str() {
        "competitive" | "comp" => "Competitive".into(),
        "unrated" => "Unrated".into(),
        "spikerush" => "Spike Rush".into(),
        "ggteam" | "escalation" => "Escalation".into(),
        "swiftplay" => "Swiftplay".into(),
        "deathmatch" => "Deathmatch".into(),
        "hurm" | "onefa" => "Team Deathmatch".into(),
        "premier" => "Premier".into(),
        "fortcollins" | "retake" => "Retake".into(),
        "custom" => "Custom".into(),
        other => other.to_string(),
    }
}

fn queue_from_private(private: &Value) -> Option<String> {
    str_field(private, &["queueId", "queueID", "QueueID", "mode", "modeId"]).map(|id| queue_label(&id))
}

fn party_label(private: &Value) -> Option<String> {
    let size = private
        .get("partySize")
        .or_else(|| private.get("party_size"))
        .and_then(|v| v.as_u64())
        .or_else(|| {
            private
                .get("partyMembers")
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

fn map_display(path: &str) -> String {
    let last = path
        .split('/')
        .filter(|s| !s.is_empty())
        .last()
        .unwrap_or(path)
        .to_lowercase();
    let key = last
        .replace("hurm_", "")
        .replace("_primaryasset", "")
        .replace('_', "");
    let named = match key.as_str() {
        "ascent" => "Ascent",
        "split" | "bonsai" => "Split",
        "fracture" | "canyon" => "Fracture",
        "bind" | "duality" => "Bind",
        "breeze" | "foxtrot" => "Breeze",
        "icebox" | "port" => "Icebox",
        "haven" | "triad" => "Haven",
        "pearl" | "pitt" => "Pearl",
        "lotus" | "jam" => "Lotus",
        "sunset" | "juliett" => "Sunset",
        "abyss" | "infinity" => "Abyss",
        "corrode" | "rook" => "Corrode",
        "district" | "pumice" | "kasbah" | "drift" => "Area",
        other => other,
    };
    if named.chars().next().map(|c| c.is_ascii_lowercase()).unwrap_or(false) {
        let mut c = named.chars();
        match c.next() {
            Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            None => named.to_string(),
        }
    } else {
        named.to_string()
    }
}

fn subject_of(p: &Value) -> Option<String> {
    str_field(
        p,
        &["Subject", "subject", "PlayerIdentity.Subject", "puuid"],
    )
    .or_else(|| {
        p.get("PlayerIdentity")
            .and_then(|pi| str_field(pi, &["Subject", "subject"]))
    })
}

fn character_id(p: &Value) -> Option<String> {
    let raw = str_field(
        p,
        &["CharacterID", "CharacterId", "characterID", "Character"],
    )
    .or_else(|| {
        p.get("Character")
            .and_then(|c| str_field(c, &["ID", "id", "uuid"]))
    })?;
    if raw == "00000000-0000-0000-0000-000000000000" {
        return None;
    }
    Some(raw)
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

fn score_hint(match_json: &Value, self_team: Option<&str>) -> Option<String> {
    let teams = match_json
        .get("Teams")
        .or_else(|| match_json.get("ScoreboardTeams"))
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

fn pregame_players(match_json: &Value) -> Vec<Value> {
    let ally = match_json.get("AllyTeam");
    if let Some(arr) = ally.and_then(|a| a.get("Players")).and_then(|p| p.as_array()) {
        return arr.clone();
    }
    if let Some(arr) = ally.and_then(|a| a.as_array()) {
        return arr.clone();
    }
    if let Some(arr) = match_json.get("Players").and_then(|p| p.as_array()) {
        return arr.clone();
    }
    Vec::new()
}

fn resolve_names(lock: &Lockfile, puuids: &[String]) -> HashMap<String, String> {
    let mut out = HashMap::new();
    if puuids.is_empty() {
        return out;
    }
    let body = Value::Array(puuids.iter().map(|p| json!(p)).collect());
    // Local name-service — same client, no cloud Tracker
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

/// Probe local Valorant truth + full match board for UI.
pub fn probe_riot_presence() -> AppResult<Option<RiotLive>> {
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
        }));
    }

    let chat_phase = phase_from(&private);
    let party = party_label(&private);
    let mode_chat = queue_from_private(&private);
    let map_chat = str_field(
        &private,
        &["matchMap", "partyOwnerMatchMap", "MapID", "mapId"],
    )
    .map(|m| map_display(&m));

    // Prefer core-game / pregame truth over chat alone
    let mut phase = chat_phase.to_string();
    let mut map = map_chat;
    let mut mode = mode_chat;
    let mut score: Option<String> = None;
    let mut self_agent: Option<String> = None;
    let mut self_kda: Option<String> = None;
    let mut players: Vec<MatchPlayer> = Vec::new();

    if let Some(core) = fetch_core_board(&lock, &puuid) {
        phase = "match".into();
        map = core.map.or(map);
        mode = core.mode.or(mode);
        score = core.score;
        self_agent = core.self_agent;
        self_kda = core.self_kda;
        players = core.players;
    } else if let Some(pre) = fetch_pregame_board(&lock, &puuid) {
        phase = "pregame".into();
        map = pre.map.or(map);
        mode = pre.mode.or(mode);
        self_agent = pre.self_agent;
        players = pre.players;
    }

    let (details, state) = match phase.as_str() {
        "match" => (
            join(&[self_agent.as_deref(), map.as_deref()]).or_else(|| Some("VALORANT".into())),
            join(&[
                score.as_deref(),
                party.as_deref(),
                mode.as_deref(),
                self_kda.as_deref(),
            ]),
        ),
        "pregame" => (
            Some(
                join(&[self_agent.as_deref(), Some("Agent Select")])
                    .unwrap_or_else(|| "Agent Select".into()),
            ),
            join(&[mode.as_deref(), map.as_deref(), party.as_deref()]),
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
        map,
        mode,
        score,
        party,
        self_agent,
        self_kda,
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
    }))
}

struct BoardBits {
    map: Option<String>,
    mode: Option<String>,
    score: Option<String>,
    self_agent: Option<String>,
    self_kda: Option<String>,
    players: Vec<MatchPlayer>,
}

fn fetch_core_board(lock: &Lockfile, puuid: &str) -> Option<BoardBits> {
    let player = local_get(lock, &format!("/core-game/v1/players/{puuid}"))?;
    let match_id = str_field(&player, &["MatchID", "MatchId", "matchId"])?;
    let match_json = local_get(lock, &format!("/core-game/v1/matches/{match_id}"))?;
    let players_raw = match_json
        .get("Players")
        .and_then(|p| p.as_array())
        .cloned()
        .unwrap_or_default();
    let self_row = players_raw.iter().find(|p| {
        subject_of(p)
            .map(|s| s.eq_ignore_ascii_case(puuid))
            .unwrap_or(false)
    });
    let self_team = self_row.and_then(|p| team_id(p));
    let self_agent_id = self_row.and_then(|p| character_id(p));
    let self_agent = self_agent_id.as_ref().and_then(|id| agent_name(id));
    let self_kda = self_row.and_then(|p| kda_of(p));
    let score = score_hint(&match_json, self_team.as_deref());
    let map = str_field(&match_json, &["MapID", "MapId", "mapId"]).map(|m| map_display(&m));
    let mode = str_field(
        &match_json,
        &["QueueID", "QueueId", "queueId", "ModeID", "Mode"],
    )
    .map(|q| {
        // Mode paths → short id
        let last = q.split('/').filter(|s| !s.is_empty()).last().unwrap_or(&q);
        queue_label(last)
    });

    let puuids: Vec<String> = players_raw.iter().filter_map(subject_of).collect();
    let names = resolve_names(lock, &puuids);
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
        map,
        mode,
        score,
        self_agent,
        self_kda,
        players,
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
    let self_agent_id = self_row.and_then(|p| character_id(p));
    let self_agent = self_agent_id.as_ref().and_then(|id| agent_name(id));
    let map = str_field(&match_json, &["MapID", "MapId", "mapId"]).map(|m| map_display(&m));
    let mode = str_field(
        &match_json,
        &["QueueID", "QueueId", "queueId", "Mode", "ModeID"],
    )
    .map(|q| {
        let last = q.split('/').filter(|s| !s.is_empty()).last().unwrap_or(&q);
        queue_label(last)
    });

    let puuids: Vec<String> = players_raw.iter().filter_map(subject_of).collect();
    let names = resolve_names(lock, &puuids);
    // Pregame is usually ally-only; treat missing team as Ally
    let mut players: Vec<MatchPlayer> = players_raw
        .iter()
        .filter_map(|p| build_player(p, puuid, Some("Blue"), &names, false))
        .map(|mut mp| {
            // Prefame seats: everyone in AllyTeam is Ally
            mp.seat = "Ally".into();
            mp
        })
        .collect();
    players.sort_by(|a, b| b.is_self.cmp(&a.is_self).then(a.name.cmp(&b.name)));

    Some(BoardBits {
        map,
        mode,
        score: None,
        self_agent,
        self_kda: None,
        players,
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
