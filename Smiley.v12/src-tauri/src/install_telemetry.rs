//! Local install telemetry rollup — mirrors v7 `install-telemetry.js`.
//! Sanitized section/source counters persisted in config.json, synced to Supabase.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;

pub const SCHEMA_VERSION: u32 = 2;
pub const CONSENT_VERSION: &str = "2026-07-08";

const MAX_TITLE: usize = 160;
const MAX_STATE: usize = 160;
const MAX_KEY: usize = 64;
const MAX_LABEL: usize = 96;
const MAX_GROUP: usize = 48;
const MAX_META_KEYS: usize = 16;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstallTelemetry {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub sections: HashMap<String, TelemetrySection>,
    #[serde(default)]
    pub sources: HashMap<String, TelemetrySource>,
}

fn default_schema_version() -> u32 {
    SCHEMA_VERSION
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySection {
    pub section_key: String,
    pub section_label: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub launch_count: u32,
    #[serde(default)]
    pub seen_count: u32,
    #[serde(default)]
    pub last_source_key: Option<String>,
    #[serde(default)]
    pub last_source_label: Option<String>,
    #[serde(default)]
    pub last_source_group: Option<String>,
    #[serde(default)]
    pub last_title: Option<String>,
    #[serde(default)]
    pub last_state: Option<String>,
    #[serde(default)]
    pub first_seen_at: Option<String>,
    #[serde(default)]
    pub last_seen_at: Option<String>,
    #[serde(default)]
    pub last_metadata: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySource {
    pub section_key: String,
    pub source_key: String,
    pub source_label: String,
    #[serde(default)]
    pub source_group: Option<String>,
    #[serde(default)]
    pub launch_count: u32,
    #[serde(default)]
    pub seen_count: u32,
    #[serde(default)]
    pub last_title: Option<String>,
    #[serde(default)]
    pub last_state: Option<String>,
    #[serde(default)]
    pub first_seen_at: Option<String>,
    #[serde(default)]
    pub last_seen_at: Option<String>,
    #[serde(default)]
    pub last_metadata: Map<String, Value>,
}

#[derive(Debug, Clone, Default)]
pub struct LaunchInfo {
    pub app_version: String,
    pub platform: String,
    pub arch: String,
    pub channel: String,
    pub music_enabled: bool,
    pub game_enabled: bool,
    pub coding_enabled: bool,
}

#[derive(Debug, Clone, Default)]
pub struct ActivityHit {
    pub id: String,
    pub details: String,
    pub state: String,
    pub category: String,
    pub emoji: String,
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn limit_text(value: Option<&str>, max: usize) -> Option<String> {
    let text = value?.trim();
    if text.is_empty() {
        return None;
    }
    Some(text.chars().take(max).collect())
}

fn slugify(value: &str, fallback: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for ch in value.trim().to_ascii_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            last_dash = false;
        } else if !last_dash && !out.is_empty() {
            out.push('-');
            last_dash = true;
        }
    }
    let trimmed = out.trim_matches('-').chars().take(MAX_KEY).collect::<String>();
    if trimmed.is_empty() {
        fallback.chars().take(MAX_KEY).collect()
    } else {
        trimmed
    }
}

fn normalize_metadata(meta: &Map<String, Value>) -> Map<String, Value> {
    let mut out = Map::new();
    for (key, value) in meta.iter().take(MAX_META_KEYS) {
        let clean_key = match limit_text(Some(key), 32) {
            Some(k) => k,
            None => continue,
        };
        match value {
            Value::Bool(b) => {
                out.insert(clean_key, Value::Bool(*b));
            }
            Value::Number(n) => {
                out.insert(clean_key, Value::Number(n.clone()));
            }
            Value::String(s) => {
                if let Some(v) = limit_text(Some(s), 160) {
                    out.insert(clean_key, Value::String(v));
                }
            }
            _ => {}
        }
    }
    out
}

fn section_label(section_key: &str) -> &'static str {
    match section_key {
        "app" => "App Overview",
        "activity" => "Activity Presets",
        "music_sync" => "Music Sync",
        "game_sync" => "Game Sync",
        "coding_sync" => "Coding Sync",
        _ => "Section",
    }
}

impl InstallTelemetry {
    pub fn normalize(mut self) -> Self {
        self.schema_version = SCHEMA_VERSION;
        let sections = std::mem::take(&mut self.sections);
        for (key, section) in sections {
            let sk = slugify(&key, "");
            if sk.is_empty() {
                continue;
            }
            self.sections.insert(
                sk.clone(),
                TelemetrySection {
                    section_key: sk,
                    section_label: section.section_label,
                    enabled: section.enabled,
                    launch_count: section.launch_count,
                    seen_count: section.seen_count,
                    last_source_key: limit_text(section.last_source_key.as_deref(), MAX_KEY),
                    last_source_label: limit_text(section.last_source_label.as_deref(), MAX_LABEL),
                    last_source_group: limit_text(section.last_source_group.as_deref(), MAX_GROUP),
                    last_title: limit_text(section.last_title.as_deref(), MAX_TITLE),
                    last_state: limit_text(section.last_state.as_deref(), MAX_STATE),
                    first_seen_at: limit_text(section.first_seen_at.as_deref(), 40),
                    last_seen_at: limit_text(section.last_seen_at.as_deref(), 40),
                    last_metadata: normalize_metadata(&section.last_metadata),
                },
            );
        }
        let sources = std::mem::take(&mut self.sources);
        for (compound, source) in sources {
            let section_key = slugify(
                source
                    .section_key
                    .as_str()
                    .is_empty()
                    .then(|| compound.split(':').next().unwrap_or(""))
                    .unwrap_or(source.section_key.as_str()),
                "",
            );
            let source_key = slugify(
                source
                    .source_key
                    .as_str()
                    .is_empty()
                    .then(|| compound.split(':').nth(1).unwrap_or(""))
                    .unwrap_or(source.source_key.as_str()),
                "",
            );
            if section_key.is_empty() || source_key.is_empty() {
                continue;
            }
            let map_key = format!("{section_key}:{source_key}");
            self.sources.insert(
                map_key,
                TelemetrySource {
                    section_key,
                    source_key: source_key.clone(),
                    source_label: limit_text(Some(&source.source_label), MAX_LABEL)
                        .unwrap_or(source_key),
                    source_group: limit_text(source.source_group.as_deref(), MAX_GROUP),
                    launch_count: source.launch_count,
                    seen_count: source.seen_count,
                    last_title: limit_text(source.last_title.as_deref(), MAX_TITLE),
                    last_state: limit_text(source.last_state.as_deref(), MAX_STATE),
                    first_seen_at: limit_text(source.first_seen_at.as_deref(), 40),
                    last_seen_at: limit_text(source.last_seen_at.as_deref(), 40),
                    last_metadata: normalize_metadata(&source.last_metadata),
                },
            );
        }
        self
    }

    fn touch_section(&mut self, section_key: &str, patch: SectionPatch<'_>) {
        let seen_at = patch
            .seen_at
            .map(str::to_string)
            .unwrap_or_else(now_iso);
        let entry = self
            .sections
            .entry(section_key.to_string())
            .or_insert_with(|| TelemetrySection {
                section_key: section_key.into(),
                section_label: section_label(section_key).into(),
                enabled: false,
                launch_count: 0,
                seen_count: 0,
                last_source_key: None,
                last_source_label: None,
                last_source_group: None,
                last_title: None,
                last_state: None,
                first_seen_at: None,
                last_seen_at: None,
                last_metadata: Map::new(),
            });

        if let Some(label) = patch.section_label {
            entry.section_label = label.to_string();
        }
        if let Some(enabled) = patch.enabled {
            entry.enabled = enabled;
        }
        if let Some(n) = patch.launch_increment {
            entry.launch_count = entry.launch_count.saturating_add(n);
        }
        if let Some(n) = patch.seen_increment {
            entry.seen_count = entry.seen_count.saturating_add(n);
        }
        if let Some(v) = patch.source_key {
            entry.last_source_key = Some(v.to_string());
        }
        if let Some(v) = patch.source_label {
            entry.last_source_label = Some(v.to_string());
        }
        if let Some(v) = patch.source_group {
            entry.last_source_group = Some(v.to_string());
        }
        if let Some(v) = patch.title {
            entry.last_title = Some(v.to_string());
        }
        if let Some(v) = patch.state_text {
            entry.last_state = Some(v.to_string());
        }
        if entry.first_seen_at.is_none() && patch.seen_increment.unwrap_or(0) > 0 {
            entry.first_seen_at = Some(seen_at.clone());
        }
        if patch.seen_increment.unwrap_or(0) > 0
            || patch.launch_increment.unwrap_or(0) > 0
            || patch.enabled == Some(true)
        {
            entry.last_seen_at = Some(seen_at);
        }
        if let Some(meta) = patch.metadata {
            entry.last_metadata = normalize_metadata(meta);
        }
    }

    fn touch_source(&mut self, patch: SourcePatch<'_>) {
        let section_key = slugify(patch.section_key, "");
        let source_key = slugify(patch.source_key, "");
        if section_key.is_empty() || source_key.is_empty() {
            return;
        }
        let map_key = format!("{section_key}:{source_key}");
        let seen_at = patch
            .seen_at
            .map(str::to_string)
            .unwrap_or_else(now_iso);
        let entry = self
            .sources
            .entry(map_key)
            .or_insert_with(|| TelemetrySource {
                section_key: section_key.clone(),
                source_key: source_key.clone(),
                source_label: source_key.clone(),
                source_group: None,
                launch_count: 0,
                seen_count: 0,
                last_title: None,
                last_state: None,
                first_seen_at: None,
                last_seen_at: None,
                last_metadata: Map::new(),
            });

        if let Some(v) = patch.source_label {
            entry.source_label = v.to_string();
        }
        if let Some(v) = patch.source_group {
            entry.source_group = Some(v.to_string());
        }
        if let Some(n) = patch.launch_increment {
            entry.launch_count = entry.launch_count.saturating_add(n);
        }
        if let Some(n) = patch.seen_increment {
            entry.seen_count = entry.seen_count.saturating_add(n);
        }
        if let Some(v) = patch.title {
            entry.last_title = Some(v.to_string());
        }
        if let Some(v) = patch.state_text {
            entry.last_state = Some(v.to_string());
        }
        if entry.first_seen_at.is_none() && patch.seen_increment.unwrap_or(0) > 0 {
            entry.first_seen_at = Some(seen_at.clone());
        }
        if patch.seen_increment.unwrap_or(0) > 0 || patch.launch_increment.unwrap_or(0) > 0 {
            entry.last_seen_at = Some(seen_at);
        }
        if let Some(meta) = patch.metadata {
            entry.last_metadata = normalize_metadata(meta);
        }
    }

    fn observe(&mut self, section_key: &str, data: ObserveData<'_>) {
        let safe = slugify(section_key, section_key);
        let source_key = data
            .source_key
            .map(|s| slugify(s, ""))
            .filter(|s| !s.is_empty());
        let seen_at = data.seen_at.unwrap_or_else(now_iso);
        self.touch_section(
            &safe,
            SectionPatch {
                section_label: data
                    .section_label
                    .or_else(|| Some(section_label(&safe))),
                enabled: data.enabled,
                launch_increment: data.launch_increment,
                seen_increment: data.seen_increment.or(Some(1)),
                source_key: source_key.as_deref(),
                source_label: data.source_label,
                source_group: data.source_group,
                title: data.title,
                state_text: data.state_text,
                metadata: data.metadata,
                seen_at: Some(&seen_at),
            },
        );
        if let Some(sk) = source_key.as_deref() {
            self.touch_source(SourcePatch {
                section_key: &safe,
                source_key: sk,
                source_label: data.source_label.or(Some(sk)),
                source_group: data.source_group,
                launch_increment: data.source_launch_increment,
                seen_increment: data
                    .source_seen_increment
                    .or(data.seen_increment)
                    .or(Some(1)),
                title: data.title,
                state_text: data.state_text,
                metadata: data.metadata,
                seen_at: Some(&seen_at),
            });
        }
    }

    pub fn record_launch(mut self, info: &LaunchInfo) -> Self {
        let mut meta = Map::new();
        meta.insert(
            "appVersion".into(),
            Value::String(info.app_version.clone()),
        );
        meta.insert("platform".into(), Value::String(info.platform.clone()));
        meta.insert("arch".into(), Value::String(info.arch.clone()));
        meta.insert("channel".into(), Value::String(info.channel.clone()));
        self.observe(
            "app",
            ObserveData {
                enabled: Some(true),
                launch_increment: Some(1),
                seen_increment: Some(1),
                source_key: Some(&info.channel),
                source_label: Some(&info.channel),
                source_group: Some("channel"),
                title: Some(&info.app_version),
                state_text: Some(&info.platform),
                metadata: Some(&meta),
                source_launch_increment: Some(1),
                source_seen_increment: Some(1),
                ..Default::default()
            },
        );
        for (section, enabled) in [
            ("music_sync", info.music_enabled),
            ("game_sync", info.game_enabled),
            ("coding_sync", info.coding_enabled),
        ] {
            let mut section_meta = Map::new();
            section_meta.insert("enabled".into(), Value::Bool(enabled));
            section_meta.insert("channel".into(), Value::String(info.channel.clone()));
            section_meta.insert(
                "appVersion".into(),
                Value::String(info.app_version.clone()),
            );
            self.observe(
                section,
                ObserveData {
                    enabled: Some(enabled),
                    launch_increment: if enabled { Some(1) } else { Some(0) },
                    seen_increment: Some(0),
                    metadata: Some(&section_meta),
                    ..Default::default()
                },
            );
        }
        self.normalize()
    }

    pub fn record_activity(mut self, activity: &ActivityHit) -> Self {
        let source_key = slugify(
            if activity.id.is_empty() {
                activity.details.as_str()
            } else {
                activity.id.as_str()
            },
            "activity",
        );
        let mut meta = Map::new();
        meta.insert(
            "category".into(),
            Value::String(activity.category.clone()),
        );
        if !activity.emoji.is_empty() {
            meta.insert("emoji".into(), Value::String(activity.emoji.clone()));
        }
        self.observe(
            "activity",
            ObserveData {
                enabled: Some(true),
                source_key: Some(&source_key),
                source_label: Some(
                    if activity.details.is_empty() {
                        activity.id.as_str()
                    } else {
                        activity.details.as_str()
                    },
                ),
                source_group: Some(
                    if activity.category.is_empty() {
                        "activity"
                    } else {
                        activity.category.as_str()
                    },
                ),
                title: Some(activity.details.as_str()),
                state_text: Some(activity.state.as_str()),
                metadata: Some(&meta),
                ..Default::default()
            },
        );
        self.normalize()
    }

    pub fn record_music(mut self, track: &crate::music::TrackHit) -> Self {
        if track.title.trim().is_empty() {
            return self.normalize();
        }
        let mut meta = Map::new();
        if !track.album.is_empty() {
            meta.insert("album".into(), Value::String(track.album.clone()));
        }
        meta.insert("isPlaying".into(), Value::Bool(track.playing));
        let state = if track.playing {
            if !track.artist.is_empty() {
                track.artist.clone()
            } else {
                "Playing".into()
            }
        } else if !track.artist.is_empty() {
            format!("Paused · {}", track.artist)
        } else {
            "Paused".into()
        };
        self.observe(
            "music_sync",
            ObserveData {
                enabled: Some(true),
                source_key: Some(track.app.as_str()),
                source_label: Some(track.app.as_str()),
                source_group: Some("player"),
                title: Some(track.title.as_str()),
                state_text: Some(state.as_str()),
                metadata: Some(&meta),
                ..Default::default()
            },
        );
        self.normalize()
    }

    pub fn record_game(mut self, title: &str, state: &str, provider: &str) -> Self {
        if title.trim().is_empty() {
            return self.normalize();
        }
        self.observe(
            "game_sync",
            ObserveData {
                enabled: Some(true),
                source_key: Some(provider),
                source_label: Some(provider),
                source_group: Some("provider"),
                title: Some(title),
                state_text: Some(state),
                ..Default::default()
            },
        );
        self.normalize()
    }

    pub fn record_coding(mut self, app_name: &str, title: &str, state: &str) -> Self {
        if app_name.trim().is_empty() {
            return self.normalize();
        }
        self.observe(
            "coding_sync",
            ObserveData {
                enabled: Some(true),
                source_key: Some(app_name),
                source_label: Some(app_name),
                source_group: Some("editor"),
                title: Some(title),
                state_text: Some(state),
                ..Default::default()
            },
        );
        self.normalize()
    }

    pub fn summarize_for_install(&self) -> Map<String, Value> {
        let mut sections: Vec<&TelemetrySection> = self
            .sections
            .values()
            .filter(|s| s.seen_count > 0)
            .collect();
        sections.sort_by(|a, b| b.last_seen_at.cmp(&a.last_seen_at));
        let latest = sections.first();
        let mut overview = Map::new();
        for section in &sections {
            let mut row = Map::new();
            row.insert(
                "seen_count".into(),
                Value::Number(section.seen_count.into()),
            );
            row.insert(
                "launch_count".into(),
                Value::Number(section.launch_count.into()),
            );
            row.insert(
                "latest_source".into(),
                Value::String(
                    section
                        .last_source_label
                        .clone()
                        .or_else(|| section.last_source_key.clone())
                        .unwrap_or_default(),
                ),
            );
            overview.insert(section.section_key.clone(), Value::Object(row));
        }
        let mut out = Map::new();
        if let Some(latest) = latest {
            out.insert(
                "last_activity_section".into(),
                Value::String(latest.section_key.clone()),
            );
            out.insert(
                "last_activity_source".into(),
                Value::String(
                    latest
                        .last_source_label
                        .clone()
                        .or_else(|| latest.last_source_key.clone())
                        .unwrap_or_default(),
                ),
            );
            if let Some(ts) = &latest.last_seen_at {
                out.insert("last_activity_seen_at".into(), Value::String(ts.clone()));
            }
        }
        out.insert(
            "active_sections".into(),
            Value::Number(sections.len().into()),
        );
        out.insert("section_overview".into(), Value::Object(overview));
        out
    }

    pub fn section_rows(&self, install_id: &str) -> Vec<Map<String, Value>> {
        self.sections
            .values()
            .map(|section| {
                let mut row = Map::new();
                row.insert("install_id".into(), Value::String(install_id.into()));
                row.insert(
                    "section_key".into(),
                    Value::String(section.section_key.clone()),
                );
                row.insert(
                    "section_label".into(),
                    Value::String(section.section_label.clone()),
                );
                row.insert("enabled".into(), Value::Bool(section.enabled));
                row.insert(
                    "launch_count".into(),
                    Value::Number(section.launch_count.into()),
                );
                row.insert(
                    "seen_count".into(),
                    Value::Number(section.seen_count.into()),
                );
                if let Some(v) = &section.last_source_key {
                    row.insert("last_source_key".into(), Value::String(v.clone()));
                }
                if let Some(v) = &section.last_source_label {
                    row.insert("last_source_label".into(), Value::String(v.clone()));
                }
                if let Some(v) = &section.last_source_group {
                    row.insert("last_source_group".into(), Value::String(v.clone()));
                }
                if let Some(v) = &section.last_title {
                    row.insert("last_title".into(), Value::String(v.clone()));
                }
                if let Some(v) = &section.last_state {
                    row.insert("last_state".into(), Value::String(v.clone()));
                }
                row.insert(
                    "last_metadata".into(),
                    Value::Object(section.last_metadata.clone()),
                );
                if let Some(v) = &section.first_seen_at {
                    row.insert("first_seen_at".into(), Value::String(v.clone()));
                }
                if let Some(v) = &section.last_seen_at {
                    row.insert("last_seen_at".into(), Value::String(v.clone()));
                }
                row
            })
            .collect()
    }

    pub fn source_rows(&self, install_id: &str) -> Vec<Map<String, Value>> {
        self.sources
            .values()
            .map(|source| {
                let mut row = Map::new();
                row.insert("install_id".into(), Value::String(install_id.into()));
                row.insert(
                    "section_key".into(),
                    Value::String(source.section_key.clone()),
                );
                row.insert(
                    "source_key".into(),
                    Value::String(source.source_key.clone()),
                );
                row.insert(
                    "source_label".into(),
                    Value::String(source.source_label.clone()),
                );
                if let Some(v) = &source.source_group {
                    row.insert("source_group".into(), Value::String(v.clone()));
                }
                row.insert(
                    "launch_count".into(),
                    Value::Number(source.launch_count.into()),
                );
                row.insert(
                    "seen_count".into(),
                    Value::Number(source.seen_count.into()),
                );
                if let Some(v) = &source.last_title {
                    row.insert("last_title".into(), Value::String(v.clone()));
                }
                if let Some(v) = &source.last_state {
                    row.insert("last_state".into(), Value::String(v.clone()));
                }
                row.insert(
                    "last_metadata".into(),
                    Value::Object(source.last_metadata.clone()),
                );
                if let Some(v) = &source.first_seen_at {
                    row.insert("first_seen_at".into(), Value::String(v.clone()));
                }
                if let Some(v) = &source.last_seen_at {
                    row.insert("last_seen_at".into(), Value::String(v.clone()));
                }
                row
            })
            .collect()
    }
}

struct SectionPatch<'a> {
    section_label: Option<&'a str>,
    enabled: Option<bool>,
    launch_increment: Option<u32>,
    seen_increment: Option<u32>,
    source_key: Option<&'a str>,
    source_label: Option<&'a str>,
    source_group: Option<&'a str>,
    title: Option<&'a str>,
    state_text: Option<&'a str>,
    metadata: Option<&'a Map<String, Value>>,
    seen_at: Option<&'a str>,
}

struct SourcePatch<'a> {
    section_key: &'a str,
    source_key: &'a str,
    source_label: Option<&'a str>,
    source_group: Option<&'a str>,
    launch_increment: Option<u32>,
    seen_increment: Option<u32>,
    title: Option<&'a str>,
    state_text: Option<&'a str>,
    metadata: Option<&'a Map<String, Value>>,
    seen_at: Option<&'a str>,
}

#[derive(Default)]
struct ObserveData<'a> {
    enabled: Option<bool>,
    launch_increment: Option<u32>,
    seen_increment: Option<u32>,
    source_key: Option<&'a str>,
    source_label: Option<&'a str>,
    source_group: Option<&'a str>,
    title: Option<&'a str>,
    state_text: Option<&'a str>,
    metadata: Option<&'a Map<String, Value>>,
    seen_at: Option<String>,
    source_launch_increment: Option<u32>,
    source_seen_increment: Option<u32>,
    section_label: Option<&'a str>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launch_records_app_section() {
        let t = InstallTelemetry::default().record_launch(&LaunchInfo {
            app_version: "12.0.5".into(),
            platform: "darwin".into(),
            arch: "arm64".into(),
            channel: "release".into(),
            music_enabled: true,
            game_enabled: false,
            coding_enabled: false,
        });
        let app = t.sections.get("app").expect("app section");
        assert!(app.launch_count >= 1);
        assert!(app.seen_count >= 1);
    }
}
