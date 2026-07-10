//! Install registry — mandatory usage telemetry to Supabase (see docs/INSTALL-DATABASE.md).

use crate::config;
use crate::error::{AppError, AppResult};
use crate::install_telemetry::{InstallTelemetry, LaunchInfo, CONSENT_VERSION};
use crate::log_file;
use parking_lot::Mutex;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::Deserialize;
use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use uuid::Uuid;

static REGISTRATION_IN_FLIGHT: AtomicBool = AtomicBool::new(false);
static SYNC_SCHEDULED: AtomicBool = AtomicBool::new(false);
static INSTALL_REGISTERED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone)]
struct RegistryConfig {
    supabase_url: String,
    supabase_anon_key: String,
}

#[derive(Debug, Deserialize)]
struct RegistryFile {
    #[serde(rename = "supabaseUrl")]
    supabase_url: String,
    #[serde(rename = "supabaseAnonKey")]
    supabase_anon_key: String,
}

pub struct InstallRegistry {
    client: Client,
    resource_dir: Mutex<Option<PathBuf>>,
}

impl InstallRegistry {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            resource_dir: Mutex::new(None),
        }
    }

    pub fn set_resource_dir(&self, dir: Option<PathBuf>) {
        *self.resource_dir.lock() = dir;
    }

    fn load_config(&self) -> Option<RegistryConfig> {
        if let (Ok(url), Ok(key)) = (
            std::env::var("SUPABASE_URL"),
            std::env::var("SUPABASE_ANON_KEY"),
        ) {
            let url = url.trim().trim_end_matches('/').to_string();
            let key = key.trim().to_string();
            if valid_registry(&url, &key) {
                return Some(RegistryConfig {
                    supabase_url: url,
                    supabase_anon_key: key,
                });
            }
        }

        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Some(dir) = self.resource_dir.lock().clone() {
            candidates.push(dir.join("downloads.registry.json"));
        }
        if let Ok(exe) = std::env::current_exe() {
            if let Some(mac_os) = exe.parent() {
                candidates.push(mac_os.join("../Resources/downloads.registry.json"));
            }
        }
        candidates.push(
            Path::new(env!("CARGO_MANIFEST_DIR")).join("downloads.registry.json"),
        );
        candidates.push(
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../legacy/electron-v7/downloads.registry.json"),
        );

        for path in candidates {
            if !path.is_file() {
                continue;
            }
            let raw = fs::read_to_string(&path).ok()?;
            let file: RegistryFile = serde_json::from_str(&raw).ok()?;
            let url = file.supabase_url.trim().trim_end_matches('/').to_string();
            let key = file.supabase_anon_key.trim().to_string();
            if valid_registry(&url, &key) {
                log_file::append(&format!(
                    "registry: loaded config from {}",
                    path.display()
                ));
                return Some(RegistryConfig {
                    supabase_url: url,
                    supabase_anon_key: key,
                });
            }
        }
        None
    }

    fn get_or_create_install_id(&self) -> Option<String> {
        let dir = config::data_dir().ok()?;
        let path = dir.join("install-id");
        if path.is_file() {
            if let Ok(raw) = fs::read_to_string(&path) {
                let id = raw.trim();
                if Uuid::parse_str(id).is_ok() {
                    return Some(id.into());
                }
            }
        }
        let id = Uuid::new_v4().to_string();
        if fs::write(&path, &id).is_ok() {
            Some(id)
        } else {
            None
        }
    }

    fn headers(cfg: &RegistryConfig) -> HeaderMap {
        let mut map = HeaderMap::new();
        let key = cfg.supabase_anon_key.trim();
        map.insert("apikey", HeaderValue::from_str(key).unwrap_or(HeaderValue::from_static("")));
        // JWT anon keys and new sb_publishable_ keys both expect Bearer.
        if let Ok(v) = HeaderValue::from_str(&format!("Bearer {key}")) {
            map.insert(AUTHORIZATION, v);
        }
        map.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        map
    }

    pub fn register_launch(&self, telemetry: &InstallTelemetry, launch: &LaunchInfo) {
        if REGISTRATION_IN_FLIGHT.swap(true, Ordering::SeqCst) {
            return;
        }
        let registry = match self.load_config() {
            Some(r) => r,
            None => {
                log_file::append("registry: no downloads.registry.json — heartbeat skipped");
                REGISTRATION_IN_FLIGHT.store(false, Ordering::SeqCst);
                return;
            }
        };
        let install_id = match self.get_or_create_install_id() {
            Some(id) => id,
            None => {
                log_file::append("registry: could not create install-id");
                REGISTRATION_IN_FLIGHT.store(false, Ordering::SeqCst);
                return;
            }
        };

        let row = build_install_row(&install_id, launch, telemetry);
        let endpoint = format!("{}/rest/v1/installs", registry.supabase_url);
        let headers = {
            let mut h = Self::headers(&registry);
            h.insert("Prefer", HeaderValue::from_static("return=minimal"));
            h
        };

        match self.client.post(&endpoint).headers(headers).json(&row).send() {
            Ok(resp) if resp.status().is_success() => {
                log_file::append(&format!(
                    "registry: install heartbeat ok ({})",
                    &install_id[..8.min(install_id.len())]
                ));
                INSTALL_REGISTERED.store(true, Ordering::SeqCst);
                let _ = self.enrich_geo(&registry, &install_id);
                let _ = self.sync_sections(&registry, &install_id, telemetry);
            }
            Ok(resp) if resp.status().as_u16() == 409 => {
                let patch_url = format!(
                    "{}/rest/v1/installs?install_id=eq.{}",
                    registry.supabase_url,
                    urlencoding_encode(&install_id)
                );
                let mut patch = row;
                patch.remove("install_id");
                match self
                    .client
                    .patch(&patch_url)
                    .headers(Self::headers(&registry))
                    .json(&patch)
                    .send()
                {
                    Ok(r) if r.status().is_success() => {
                        log_file::append("registry: install heartbeat patched");
                        INSTALL_REGISTERED.store(true, Ordering::SeqCst);
                        let _ = self.enrich_geo(&registry, &install_id);
                        let _ = self.sync_sections(&registry, &install_id, telemetry);
                    }
                    Ok(r) => {
                        log_file::append(&format!(
                            "registry: install patch failed HTTP {}",
                            r.status()
                        ));
                    }
                    Err(e) => log_file::append(&format!("registry: install patch error: {e}")),
                }
            }
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().unwrap_or_default();
                log_file::append(&format!(
                    "registry: install heartbeat HTTP {status} — {}",
                    body.chars().take(200).collect::<String>()
                ));
            }
            Err(e) => log_file::append(&format!("registry: install heartbeat error: {e}")),
        }
        REGISTRATION_IN_FLIGHT.store(false, Ordering::SeqCst);
    }

    pub fn schedule_sync(&self, telemetry: InstallTelemetry) {
        if !INSTALL_REGISTERED.load(Ordering::SeqCst) {
            return;
        }
        if SYNC_SCHEDULED.swap(true, Ordering::SeqCst) {
            return;
        }
        let registry = self.clone_for_thread();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(2500));
            SYNC_SCHEDULED.store(false, Ordering::SeqCst);
            if let Some(cfg) = registry.load_config() {
                if let Some(install_id) = registry.get_or_create_install_id() {
                    if let Err(e) = registry.sync_sections(&cfg, &install_id, &telemetry) {
                        log_file::append(&format!("registry: section sync failed: {e}"));
                    }
                }
            }
        });
    }

    fn clone_for_thread(&self) -> InstallRegistry {
        InstallRegistry {
            client: self.client.clone(),
            resource_dir: Mutex::new(self.resource_dir.lock().clone()),
        }
    }

    fn sync_sections(
        &self,
        registry: &RegistryConfig,
        install_id: &str,
        telemetry: &InstallTelemetry,
    ) -> AppResult<()> {
        let headers = {
            let mut h = Self::headers(registry);
            h.insert(
                "Prefer",
                HeaderValue::from_static("resolution=merge-duplicates,return=minimal"),
            );
            h
        };
        let section_rows = telemetry.section_rows(install_id);
        if !section_rows.is_empty() {
            let url = format!(
                "{}/rest/v1/install_sections?on_conflict=install_id,section_key",
                registry.supabase_url
            );
            self.client
                .post(&url)
                .headers(headers.clone())
                .json(&section_rows)
                .send()
                .map_err(|e| AppError::Msg(format!("registry sections: {e}")))?
                .error_for_status()
                .map_err(|e| AppError::Msg(format!("registry sections HTTP: {e}")))?;
        }
        let source_rows = telemetry.source_rows(install_id);
        if !source_rows.is_empty() {
            let url = format!(
                "{}/rest/v1/install_section_sources?on_conflict=install_id,section_key,source_key",
                registry.supabase_url
            );
            self.client
                .post(&url)
                .headers(headers)
                .json(&source_rows)
                .send()
                .map_err(|e| AppError::Msg(format!("registry sources: {e}")))?
                .error_for_status()
                .map_err(|e| AppError::Msg(format!("registry sources HTTP: {e}")))?;
        }
        log_file::append("registry: section telemetry synced");
        Ok(())
    }

    fn enrich_geo(&self, registry: &RegistryConfig, install_id: &str) -> AppResult<()> {
        let geo: Value = self
            .client
            .get("https://ipwho.is/")
            .timeout(Duration::from_secs(8))
            .send()
            .and_then(|r| r.json())
            .map_err(|e| AppError::Msg(format!("geo lookup: {e}")))?;
        if geo.get("success").and_then(Value::as_bool) != Some(true) {
            return Ok(());
        }
        let mut patch = Map::new();
        if let Some(v) = geo.get("country_code").and_then(Value::as_str) {
            patch.insert(
                "country_code".into(),
                Value::String(v.chars().take(8).collect::<String>().to_ascii_uppercase()),
            );
        }
        if let Some(v) = geo.get("country").and_then(Value::as_str) {
            patch.insert("country_name".into(), Value::String(v.chars().take(64).collect()));
        }
        if let Some(v) = geo
            .get("region")
            .and_then(Value::as_str)
            .or_else(|| geo.get("region_code").and_then(Value::as_str))
        {
            patch.insert("region".into(), Value::String(v.chars().take(64).collect()));
            patch.insert("region_name".into(), Value::String(v.chars().take(64).collect()));
        }
        if let Some(v) = geo.get("city").and_then(Value::as_str) {
            patch.insert("city".into(), Value::String(v.chars().take(64).collect()));
        }
        if let Some(v) = geo
            .pointer("/connection/isp")
            .and_then(Value::as_str)
        {
            patch.insert("isp".into(), Value::String(v.chars().take(128).collect()));
        }
        if let Some(v) = geo.pointer("/timezone/id").and_then(Value::as_str) {
            patch.insert(
                "geo_timezone".into(),
                Value::String(v.chars().take(64).collect()),
            );
        }
        if patch.is_empty() {
            return Ok(());
        }
        let url = format!(
            "{}/rest/v1/installs?install_id=eq.{}",
            registry.supabase_url,
            urlencoding_encode(install_id)
        );
        self.client
            .patch(&url)
            .headers(Self::headers(registry))
            .json(&patch)
            .send()
            .map_err(|e| AppError::Msg(format!("geo patch: {e}")))?;
        Ok(())
    }
}

fn valid_registry(url: &str, key: &str) -> bool {
    if url.is_empty() || key.is_empty() {
        return false;
    }
    if !url.starts_with("https://") || !url.ends_with(".supabase.co") {
        return false;
    }
    true
}

fn urlencoding_encode(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

fn build_install_row(
    install_id: &str,
    launch: &LaunchInfo,
    telemetry: &InstallTelemetry,
) -> Map<String, Value> {
    let platform = match launch.platform.as_str() {
        "macos" => "darwin",
        "windows" => "win32",
        other => other,
    };
    let mut row = telemetry.summarize_for_install();
    row.insert("install_id".into(), Value::String(install_id.into()));
    row.insert("platform".into(), Value::String(platform.into()));
    row.insert("arch".into(), Value::String(launch.arch.chars().take(16).collect()));
    row.insert(
        "app_version".into(),
        Value::String(launch.app_version.chars().take(32).collect()),
    );
    row.insert(
        "os_version".into(),
        Value::String(os_release().chars().take(64).collect()),
    );
    row.insert("electron_version".into(), Value::String("tauri-2".into()));
    row.insert("runtime_kind".into(), Value::String("tauri".into()));
    row.insert("tauri_version".into(), Value::String("2".into()));
    row.insert(
        "host_os_name".into(),
        Value::String(host_os_name().chars().take(32).collect()),
    );
    row.insert(
        "locale".into(),
        Value::String(locale_name().chars().take(16).collect()),
    );
    row.insert(
        "timezone".into(),
        Value::String(timezone_name().chars().take(64).collect()),
    );
    row.insert(
        "channel".into(),
        Value::String(launch.channel.chars().take(32).collect()),
    );
    row.insert(
        "app_channel".into(),
        Value::String(launch.channel.chars().take(32).collect()),
    );
    row.insert("music_enabled".into(), Value::Bool(launch.music_enabled));
    row.insert("game_enabled".into(), Value::Bool(launch.game_enabled));
    row.insert("coding_enabled".into(), Value::Bool(launch.coding_enabled));
    row.insert(
        "user_agent".into(),
        Value::String(build_user_agent(launch)),
    );
    row.insert(
        "consent_version".into(),
        Value::String(CONSENT_VERSION.into()),
    );
    row.insert(
        "client_heartbeat_at".into(),
        Value::String(chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)),
    );

    if let Some(music) = telemetry.sections.get("music_sync") {
        if let Some(v) = music
            .last_source_label
            .as_ref()
            .or(music.last_source_key.as_ref())
        {
            row.insert("last_music_source".into(), Value::String(v.chars().take(96).collect()));
        }
        if let Some(v) = &music.last_title {
            row.insert("last_music_title".into(), Value::String(v.chars().take(160).collect()));
        }
        if let Some(v) = &music.last_seen_at {
            row.insert("last_music_seen_at".into(), Value::String(v.clone()));
        }
    }
    if let Some(game) = telemetry.sections.get("game_sync") {
        if let Some(v) = &game.last_title {
            row.insert("last_game_title".into(), Value::String(v.chars().take(160).collect()));
        }
        if let Some(v) = &game.last_state {
            row.insert("last_game_state".into(), Value::String(v.chars().take(160).collect()));
        }
        if let Some(v) = &game.last_seen_at {
            row.insert("last_game_seen_at".into(), Value::String(v.clone()));
        }
    }
    if let Some(coding) = telemetry.sections.get("coding_sync") {
        if let Some(v) = coding
            .last_source_label
            .as_ref()
            .or(coding.last_source_key.as_ref())
        {
            row.insert("last_coding_source".into(), Value::String(v.chars().take(96).collect()));
        }
        if let Some(v) = &coding.last_title {
            row.insert("last_coding_title".into(), Value::String(v.chars().take(160).collect()));
        }
        if let Some(v) = &coding.last_seen_at {
            row.insert("last_coding_seen_at".into(), Value::String(v.clone()));
        }
    }
    row
}

fn host_os_name() -> String {
    match std::env::consts::OS {
        "macos" => "macOS".into(),
        "windows" => "Windows".into(),
        "linux" => {
            if let Ok(raw) = fs::read_to_string("/etc/os-release") {
                for line in raw.lines() {
                    if let Some(rest) = line.strip_prefix("NAME=") {
                        return rest.trim_matches('"').chars().take(32).collect();
                    }
                }
            }
            "Linux".into()
        }
        other => other.into(),
    }
}

fn build_user_agent(launch: &LaunchInfo) -> String {
    format!(
        "Smiley/{} Tauri/2 {}/{} {}",
        launch.app_version.chars().take(32).collect::<String>(),
        launch.platform,
        os_release().chars().take(64).collect::<String>(),
        launch.arch.chars().take(16).collect::<String>(),
    )
    .chars()
    .take(256)
    .collect()
}

fn locale_name() -> String {
    std::env::var("LANG")
        .or_else(|_| std::env::var("LC_ALL"))
        .unwrap_or_else(|_| "en-US".into())
        .split('.')
        .next()
        .unwrap_or("en-US")
        .replace('_', "-")
}

fn timezone_name() -> String {
    std::env::var("TZ").unwrap_or_else(|_| {
        #[cfg(target_os = "macos")]
        {
            if let Ok(out) = std::process::Command::new("readlink")
                .arg("/etc/localtime")
                .output()
            {
                let path = String::from_utf8_lossy(&out.stdout);
                if let Some(tz) = path.split("zoneinfo/").nth(1) {
                    return tz.trim().to_string();
                }
            }
        }
        "UTC".into()
    })
}

fn os_release() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("sw_vers")
            .arg("-productVersion")
            .output()
        {
            let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !v.is_empty() {
                return v;
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(v) = std::env::var("OS") {
            return v;
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(raw) = fs::read_to_string("/etc/os-release") {
            for line in raw.lines() {
                if let Some(rest) = line.strip_prefix("VERSION_ID=") {
                    return rest.trim_matches('"').to_string();
                }
            }
        }
    }
    "unknown".into()
}

pub fn launch_info_from_config(cfg: &crate::models::Config) -> LaunchInfo {
    LaunchInfo {
        app_version: env!("CARGO_PKG_VERSION").into(),
        platform: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        channel: "release".into(),
        music_enabled: cfg.music_now_playing,
        game_enabled: cfg.live_gaming || cfg.gaming_probe,
        coding_enabled: cfg.coding_now_playing,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_registry_accepts_https_supabase() {
        assert!(valid_registry(
            "https://abc.supabase.co",
            "eyJhbGciOiJIUzI1NiJ9"
        ));
        assert!(!valid_registry("http://abc.supabase.co", "key"));
    }
}
