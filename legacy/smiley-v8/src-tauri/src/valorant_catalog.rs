//! Valorant map / queue / agent registries — mirrors electron/valorant-catalog.js (2026-07).
//! Static fallbacks + valorant-api.com cache (maps refresh daily).

use parking_lot::Mutex;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MapEntry {
    pub name: String,
    pub uuid: Option<String>,
}

const VALORANT_GAME_LOGO: &str =
    "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/cbf4460132cdfeb2a97fad5f9dd25ba0bc058f76-128x128.png";

pub fn valorant_game_logo() -> &'static str {
    VALORANT_GAME_LOGO
}

fn agent_names() -> &'static HashMap<&'static str, &'static str> {
    static MAP: OnceLock<HashMap<&'static str, &'static str>> = OnceLock::new();
    MAP.get_or_init(|| {
        HashMap::from([
            ("add6443a-41bd-e414-f6ad-e58d267f4e95", "Jett"),
            ("a3bfb853-43b2-7238-a4f1-ad90e9e46bcc", "Reyna"),
            ("569fdd95-4d10-43ab-ca70-79becc718b46", "Sage"),
            ("8e253930-4c05-31dd-1b6c-968525494517", "Omen"),
            ("707eab51-4836-f488-046a-cda6bf494859", "Viper"),
            ("eb93336a-449b-9c1b-0a54-a891f7921d69", "Phoenix"),
            ("320b2a48-4d9b-a075-30f1-1f93a9b638fa", "Sova"),
            ("117ed9e3-49f3-6512-3ccf-0cada7e3823b", "Cypher"),
            ("22697a3d-45bf-8dd7-4fec-84a9e28c69d7", "Chamber"),
            ("601dbbe7-43ce-be57-2a40-4abd24953621", "KAY/O"),
            ("6f2a04ca-43e0-be17-7f36-b3908627744d", "Skye"),
            ("1e58de9c-4950-5125-93e9-a0aee9f98746", "Killjoy"),
            ("41fb69c1-4189-7b37-f117-bcaf1e96f1bf", "Astra"),
            ("9f0d8ba9-4140-b941-57d3-a7ad57c6b417", "Brimstone"),
            ("f94c3b30-42be-e959-889c-5aa313dba261", "Raze"),
            ("5f8d3a7f-467b-97f3-062c-13acf203c006", "Breach"),
            ("dade69b4-4f5a-8528-247b-219e5a1facd6", "Fade"),
            ("95b78ed7-4637-86d9-7e41-71ba8c293152", "Harbor"),
            ("e370fa57-4757-3604-3648-499e1f642d3f", "Gekko"),
            ("cc8b64c8-4b25-4ff9-6e7f-37b4da43d235", "Deadlock"),
            ("bb2a4828-46eb-8cd1-e765-15848195d751", "Neon"),
            ("7f94d92c-4234-0a36-9646-3a87eb8b5c89", "Yoru"),
            ("0e38b510-41a8-5780-5e8f-568b2a4f2d6c", "Iso"),
            ("1dbf2edd-4729-0984-3115-daa5eed44993", "Clove"),
            ("b444168c-4e35-8076-db47-ef9bf368f384", "Tejo"),
            ("efba5359-4016-a1e5-7626-b1ae76895940", "Vyse"),
            ("df1cb487-4902-002e-5c17-d28e83e78588", "Waylay"),
            ("7c8a4701-4de6-9355-b254-e09bc2a34b72", "Miks"),
            ("92eeef5d-43b5-1d4a-8d03-b3927a09034b", "Veto"),
        ])
    })
}

fn map_table() -> &'static HashMap<&'static str, MapEntry> {
    static MAP: OnceLock<HashMap<&'static str, MapEntry>> = OnceLock::new();
    MAP.get_or_init(|| {
        let m = |name: &str, uuid: &str| MapEntry {
            name: name.into(),
            uuid: Some(uuid.into()),
        };
        HashMap::from([
            ("ascent", m("Ascent", "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319")),
            ("split", m("Split", "d960549e-485c-e861-8d71-aa9d1aed12a2")),
            ("bonsai", m("Split", "d960549e-485c-e861-8d71-aa9d1aed12a2")),
            ("fracture", m("Fracture", "b529448b-4d60-346e-e89e-00a4c527a405")),
            ("canyon", m("Fracture", "b529448b-4d60-346e-e89e-00a4c527a405")),
            ("bind", m("Bind", "2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba")),
            ("duality", m("Bind", "2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba")),
            ("breeze", m("Breeze", "2fb9a4fd-47b8-4e7d-a969-74b4046ebd53")),
            ("foxtrot", m("Breeze", "2fb9a4fd-47b8-4e7d-a969-74b4046ebd53")),
            ("abyss", m("Abyss", "224b0a95-48b9-f703-1bd8-67aca101a61f")),
            ("infinity", m("Abyss", "224b0a95-48b9-f703-1bd8-67aca101a61f")),
            ("lotus", m("Lotus", "2fe4ed3a-450a-948b-6d6b-e89a78e680a9")),
            ("jam", m("Lotus", "2fe4ed3a-450a-948b-6d6b-e89a78e680a9")),
            ("sunset", m("Sunset", "92584fbe-486a-b1b2-9faa-39b0f486b498")),
            ("juliett", m("Sunset", "92584fbe-486a-b1b2-9faa-39b0f486b498")),
            ("pearl", m("Pearl", "fd267378-4d1d-484f-ff52-77821ed10dc2")),
            ("pitt", m("Pearl", "fd267378-4d1d-484f-ff52-77821ed10dc2")),
            ("icebox", m("Icebox", "e2ad5c54-4114-a870-9641-8ea21279579a")),
            ("port", m("Icebox", "e2ad5c54-4114-a870-9641-8ea21279579a")),
            ("haven", m("Haven", "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047")),
            ("triad", m("Haven", "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047")),
            ("corrode", m("Corrode", "1c18ab1f-420d-0d8b-71d0-77ad3c439115")),
            ("rook", m("Corrode", "1c18ab1f-420d-0d8b-71d0-77ad3c439115")),
            ("summit", m("Summit", "756da597-416b-c0f2-f47b-afbdf28670bc")),
            ("plummet", m("Summit", "756da597-416b-c0f2-f47b-afbdf28670bc")),
            ("range", m("The Range", "ee613ee9-28b7-4beb-9666-08db13bb2244")),
            ("rangev2", m("The Range", "5914d1e0-40c4-cfdd-6b88-eba06347686c")),
            ("poveglia", m("The Range", "ee613ee9-28b7-4beb-9666-08db13bb2244")),
            ("povegliav2", m("The Range", "5914d1e0-40c4-cfdd-6b88-eba06347686c")),
            ("district", m("District", "690b3ed2-4dff-945b-8223-6da834e30d24")),
            ("hurm_alley", m("District", "690b3ed2-4dff-945b-8223-6da834e30d24")),
            ("hurmalley", m("District", "690b3ed2-4dff-945b-8223-6da834e30d24")),
            ("kasbah", m("Kasbah", "12452a9d-48c3-0b02-e7eb-0381c3520404")),
            ("hurm_bowl", m("Kasbah", "12452a9d-48c3-0b02-e7eb-0381c3520404")),
            ("hurmbowl", m("Kasbah", "12452a9d-48c3-0b02-e7eb-0381c3520404")),
            ("drift", m("Drift", "2c09d728-42d5-30d8-43dc-96a05cc7ee9d")),
            ("hurm_helix", m("Drift", "2c09d728-42d5-30d8-43dc-96a05cc7ee9d")),
            ("hurmhelix", m("Drift", "2c09d728-42d5-30d8-43dc-96a05cc7ee9d")),
            ("glitch", m("Glitch", "d6336a5a-428f-c591-98db-c8a291159134")),
            ("hurm_hightide", m("Glitch", "d6336a5a-428f-c591-98db-c8a291159134")),
            ("hurmhightide", m("Glitch", "d6336a5a-428f-c591-98db-c8a291159134")),
            ("piazza", m("Piazza", "de28aa9b-4cbe-1003-320e-6cb3ec309557")),
            ("hurm_yard", m("Piazza", "de28aa9b-4cbe-1003-320e-6cb3ec309557")),
            ("hurmyard", m("Piazza", "de28aa9b-4cbe-1003-320e-6cb3ec309557")),
        ])
    })
}

fn mode_uuid_table() -> &'static HashMap<&'static str, &'static str> {
    static MAP: OnceLock<HashMap<&'static str, &'static str>> = OnceLock::new();
    MAP.get_or_init(|| {
        HashMap::from([
            ("competitive", "96bd3920-4f36-d026-2b28-c683eb0bcac5"),
            ("unrated", "96bd3920-4f36-d026-2b28-c683eb0bcac5"),
            ("swiftplay", "5d0f264b-4ebe-cc63-c147-809e1374484b"),
            ("deathmatch", "a8790ec5-4237-f2f0-e93b-08a8e89865b2"),
            ("spikerush", "e921d1e6-416b-c31f-1291-74930c330b7b"),
            ("ggteam", "a4ed6518-4741-6dcb-35bd-f884aecdc859"),
            ("hurm", "e086db66-47fd-e791-ca81-06a645ac7661"),
            ("onefa", "e086db66-47fd-e791-ca81-06a645ac7661"),
            ("fortcollins", "75b7b658-472c-0264-cbe6-049abf14f54b"),
            ("retake", "75b7b658-472c-0264-cbe6-049abf14f54b"),
            ("replication", "4744698a-4513-dc96-9c22-a9aa437e4a58"),
            ("snowball", "57038d6d-49b1-3a74-c5ef-3395d9f23a97"),
            ("custom", "96bd3920-4f36-d026-2b28-c683eb0bcac5"),
            ("premier", "96bd3920-4f36-d026-2b28-c683eb0bcac5"),
        ])
    })
}

fn slugify(token: &str) -> String {
    token
        .trim()
        .to_lowercase()
        .replace(' ', "")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect()
}

const API_TTL: Duration = Duration::from_secs(86_400);

struct ApiMapCache {
    at: Instant,
    by_slug: HashMap<String, MapEntry>,
    by_uuid: HashMap<String, MapEntry>,
}

static API_MAPS: OnceLock<Mutex<ApiMapCache>> = OnceLock::new();
static HTTP: OnceLock<reqwest::blocking::Client> = OnceLock::new();

fn api_maps() -> &'static Mutex<ApiMapCache> {
    API_MAPS.get_or_init(|| {
        Mutex::new(ApiMapCache {
            at: Instant::now() - API_TTL,
            by_slug: HashMap::new(),
            by_uuid: HashMap::new(),
        })
    })
}

fn http_client() -> &'static reqwest::blocking::Client {
    HTTP.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .expect("valorant-api client")
    })
}

fn ingest_api_map(map: &Value, by_slug: &mut HashMap<String, MapEntry>, by_uuid: &mut HashMap<String, MapEntry>) {
    let Some(uuid) = map.get("uuid").and_then(|v| v.as_str()) else {
        return;
    };
    let name = map
        .get("displayName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if name.is_empty() {
        return;
    }
    let entry = MapEntry {
        name: name.clone(),
        uuid: Some(uuid.to_string()),
    };
    by_uuid.insert(uuid.to_lowercase(), entry.clone());
    let mut slugs = Vec::new();
    if let Some(url) = map.get("mapUrl").and_then(|v| v.as_str()) {
        if let Some(last) = url.split('/').filter(|s| !s.is_empty()).last() {
            slugs.push(slugify(last));
        }
    }
    if let Some(path) = map.get("assetPath").and_then(|v| v.as_str()) {
        if let Some(last) = path.split('/').filter(|s| !s.is_empty()).last() {
            let tail = last.trim_end_matches("_PrimaryAsset");
            slugs.push(slugify(tail));
        }
    }
    slugs.push(slugify(&name));
    for slug in slugs {
        if !slug.is_empty() {
            by_slug.insert(slug, entry.clone());
        }
    }
}

/// Refresh map registry from valorant-api.com (no-op if cached < 24h).
pub fn refresh_maps_from_api() {
    let mut cache = api_maps().lock();
    if cache.at.elapsed() < API_TTL && !cache.by_uuid.is_empty() {
        return;
    }
    let Ok(res) = http_client()
        .get("https://valorant-api.com/v1/maps")
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
    let mut by_slug = HashMap::new();
    let mut by_uuid = HashMap::new();
    if let Some(arr) = data.get("data").and_then(|d| d.as_array()) {
        for map in arr {
            ingest_api_map(map, &mut by_slug, &mut by_uuid);
        }
    }
    if !by_uuid.is_empty() {
        cache.by_slug = by_slug;
        cache.by_uuid = by_uuid;
        cache.at = Instant::now();
    }
}

fn lookup_api_slug(slug: &str) -> Option<MapEntry> {
    refresh_maps_from_api();
    api_maps().lock().by_slug.get(slug).cloned()
}

fn lookup_api_uuid(uuid: &str) -> Option<MapEntry> {
    refresh_maps_from_api();
    api_maps().lock().by_uuid.get(&uuid.to_lowercase()).cloned()
}

pub fn agent_display_name(id: &str) -> Option<String> {
    let key = id.trim().to_lowercase();
    if key.is_empty() {
        return None;
    }
    agent_names().get(key.as_str()).map(|s| (*s).to_string())
}

pub fn queue_label(id: &str) -> String {
    let key = id.trim().to_lowercase();
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
        "replication" => "Replication".into(),
        "snowball" => "Snowball Fight".into(),
        "custom" => "Custom".into(),
        "newmap" => "New Map".into(),
        "valaram" => "All Random One Site".into(),
        "dodgeball" | "knockout" => "Knockout".into(),
        other if other.len() < 32 && other.chars().all(|c| c.is_ascii_alphanumeric()) => {
            other.to_string()
        }
        _ => id.to_string(),
    }
}

pub fn is_team_deathmatch_queue(id: &str) -> bool {
    let raw = id.trim();
    if raw.is_empty() {
        return false;
    }
    let k = normalize_queue_key(raw).to_lowercase().replace([' ', '_', '-'], "");
    if k == "hurm" || k == "onefa" || k == "teamdeathmatch" {
        return true;
    }
    let lower = raw.to_lowercase();
    lower.contains("hurm")
        || lower.contains("onefa")
        || lower.contains("teamdeath")
}

pub fn is_ffa_deathmatch_queue(id: &str) -> bool {
    if is_team_deathmatch_queue(id) {
        return false;
    }
    normalize_queue_key(id) == "deathmatch"
}

fn normalize_queue_key(id: &str) -> String {
    let k = id.trim();
    if k.is_empty() {
        return String::new();
    }
    let lower = k.to_lowercase();
    if queue_label(&lower) != lower || matches!(
        lower.as_str(),
        "competitive" | "unrated" | "deathmatch" | "hurm" | "onefa" | "spikerush" | "ggteam"
    ) {
        return lower;
    }
    lower
}

/// Extract queue id from core-game / pregame match JSON.
pub fn match_queue_id(match_json: &serde_json::Value) -> Option<String> {
    let raw = match_json
        .get("QueueID")
        .or_else(|| match_json.get("QueueId"))
        .or_else(|| match_json.get("queueId"))
        .or_else(|| match_json.get("MatchmakingData").and_then(|m| m.get("QueueID")))
        .or_else(|| match_json.get("ModeID"))
        .or_else(|| match_json.get("Mode"))
        .and_then(|v| v.as_str())?;
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }
    let last = s.split('/').filter(|p| !p.is_empty()).last().unwrap_or(s);
    let key = last
        .replace("GameMode", "")
        .replace("_PrimaryAsset", "")
        .replace("Mode", "")
        .trim()
        .to_string();
    let combined = format!("{s} {key}");
    if is_team_deathmatch_queue(&combined) || is_team_deathmatch_queue(&key) {
        return Some("hurm".into());
    }
    if (key.eq_ignore_ascii_case("deathmatch") || s.to_lowercase().contains("/deathmatch"))
        && !combined.to_lowercase().contains("teamdeath")
    {
        return Some("deathmatch".into());
    }
    if key.to_lowercase().contains("swiftplay") || s.to_lowercase().contains("swiftplay") {
        return Some("swiftplay".into());
    }
    if key.to_lowercase().contains("spikerush") || s.contains("SpikeRush") {
        return Some("spikerush".into());
    }
    if s.len() < 32 && s.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Some(s.to_lowercase());
    }
    None
}

pub fn resolve_map(map_ref: &str) -> MapEntry {
    let raw = map_ref.trim();
    if raw.is_empty() {
        return MapEntry {
            name: String::new(),
            uuid: None,
        };
    }
    if raw.len() == 36 && raw.chars().filter(|c| *c == '-').count() == 4 {
        for entry in map_table().values() {
            if entry.uuid.as_deref().map(|u| u.eq_ignore_ascii_case(raw)) == Some(true) {
                return entry.clone();
            }
        }
        if let Some(entry) = lookup_api_uuid(raw) {
            return entry;
        }
        return MapEntry {
            name: String::new(),
            uuid: Some(raw.to_string()),
        };
    }
    let parts: Vec<&str> = raw.split(['/', '\\']).filter(|s| !s.is_empty()).collect();
    let mut candidates: Vec<String> = Vec::new();
    if let Some(last) = parts.last() {
        candidates.push(slugify(last));
    }
    if parts.len() >= 2 {
        candidates.push(slugify(parts[parts.len() - 2]));
    }
    candidates.push(slugify(raw));
    for slug in candidates {
        if let Some(entry) = map_table().get(slug.as_str()) {
            return entry.clone();
        }
        if let Some(entry) = lookup_api_slug(&slug) {
            return entry;
        }
    }
    let last = parts.last().copied().unwrap_or(raw);
    let friendly = last
        .trim_start_matches("HURM_")
        .trim_start_matches("hurm_")
        .replace('_', " ");
    MapEntry {
        name: if friendly.is_empty() {
            raw.to_string()
        } else {
            friendly
        },
        uuid: None,
    }
}

pub fn map_display(map_ref: &str) -> String {
    let entry = resolve_map(map_ref);
    if entry.name.is_empty() {
        map_ref.to_string()
    } else {
        entry.name
    }
}

pub fn map_icon_url(map_ref: &str) -> Option<String> {
    let entry = resolve_map(map_ref);
    let uuid = entry.uuid.or_else(|| {
        if map_ref.len() == 36 {
            Some(map_ref.to_string())
        } else {
            None
        }
    })?;
    Some(format!(
        "https://media.valorant-api.com/maps/{}/listviewicon.png",
        uuid.to_lowercase()
    ))
}

pub fn agent_icon_url(agent_id: &str) -> Option<String> {
    let id = agent_id.trim();
    if id.len() != 36 {
        return None;
    }
    Some(format!(
        "https://media.valorant-api.com/agents/{}/displayicon.png",
        id.to_lowercase()
    ))
}

pub fn mode_icon_url(queue_id: &str) -> Option<String> {
    let key = normalize_queue_key(queue_id);
    let uuid = mode_uuid_table().get(key.as_str()).copied()?;
    Some(format!(
        "https://media.valorant-api.com/gamemodes/{}/displayicon.png",
        uuid
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hurm_bowl_is_kasbah() {
        let m = resolve_map("/Game/Maps/HURM/HURM_Bowl/HURM_Bowl");
        assert_eq!(m.name, "Kasbah");
    }

    #[test]
    fn rangev2_is_the_range() {
        let m = resolve_map("/Game/Maps/PovegliaV2/RangeV2");
        assert_eq!(m.name, "The Range");
    }

    #[test]
    fn tdm_queue_detection() {
        assert!(is_team_deathmatch_queue("hurm"));
        assert!(is_team_deathmatch_queue("/Game/GameModes/HURM/TeamDeathmatch"));
        assert!(!is_ffa_deathmatch_queue("hurm"));
        assert!(is_ffa_deathmatch_queue("deathmatch"));
    }

    #[test]
    fn agent_offline_fallback() {
        assert_eq!(
            agent_display_name("add6443a-41bd-e414-f6ad-e58d267f4e95").as_deref(),
            Some("Jett")
        );
    }
}
