use crate::install_telemetry::InstallTelemetry;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub details: String,
    pub state: String,
    pub emoji: String,
    pub category: String,
    pub color: String,
    pub gif: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub label: String,
    pub emoji: String,
    pub color: String,
    pub activities: Vec<Activity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub connected: bool,
    pub message: String,
    pub activity_id: Option<String>,
    pub details: Option<String>,
    pub state: Option<String>,
    pub gif: Option<String>,
    pub paused: bool,
    #[serde(default)]
    pub elapsed_secs: Option<u64>,
    #[serde(default)]
    pub rotate_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomActivity {
    pub id: String,
    pub details: String,
    pub state: String,
    pub emoji: String,
    pub gif: Option<String>,
}

fn default_skin() -> String {
    "studio".into()
}
fn default_accent() -> String {
    "ember".into()
}
fn default_true() -> bool {
    true
}
fn default_false() -> bool {
    false
}
fn default_btn_label() -> String {
    "Download Smiley".into()
}
fn default_btn_url() -> String {
    "https://1tsrajuwu.github.io/Smiley/#download".into()
}
fn default_donate_url() -> String {
    "https://paypal.me/1tsRaj".into()
}
fn default_large_text() -> String {
    String::new()
}
fn default_cooldown() -> u32 {
    400
}
fn default_idle_details() -> String {
    "Away".into()
}
fn default_idle_state() -> String {
    "Be right back".into()
}
fn default_idle_gif() -> String {
    "https://media.tenor.com/_EzjRj8XOP4AAAAM/streaming-stream.gif".into()
}
fn default_rotate_secs() -> u32 {
    120
}
fn default_quiet_start() -> String {
    "23:00".into()
}
fn default_quiet_end() -> String {
    "08:00".into()
}
fn default_density() -> String {
    "cozy".into()
}
fn default_category() -> String {
    "food".into()
}
fn default_max_recents() -> u32 {
    8
}
fn default_theme() -> String {
    "ember".into()
}
fn default_gaming_presence_detail() -> String {
    "full".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default = "default_skin")]
    pub skin: String,
    #[serde(default = "default_accent")]
    pub theme_accent: String,
    #[serde(default = "default_true")]
    pub auto_connect: bool,
    #[serde(default = "default_true")]
    pub minimize_to_tray: bool,
    #[serde(default = "default_false")]
    pub launch_minimized: bool,
    #[serde(default = "default_false")]
    pub confirm_clear: bool,
    #[serde(default = "default_true")]
    pub favorites_first: bool,
    #[serde(default = "default_false")]
    pub reduce_motion: bool,
    #[serde(default = "default_true")]
    pub show_elapsed: bool,
    /// Discord profile button (Download) — safe default for end users
    #[serde(default = "default_true")]
    pub show_button: bool,
    #[serde(default = "default_btn_label")]
    pub button_label: String,
    #[serde(default = "default_btn_url")]
    pub button_url: String,
    #[serde(default = "default_large_text")]
    pub large_text: String,
    /// PayPal tip link (opens in browser — not a Discord bot)
    #[serde(default = "default_donate_url")]
    pub donation_url: String,
    #[serde(default = "default_true")]
    pub show_donate: bool,
    #[serde(default = "default_true")]
    pub wallpaper_enabled: bool,
    #[serde(default = "default_false")]
    pub gaming_probe: bool,
    /// Local Riot lockfile Valorant/LoL presence (no malware patterns).
    #[serde(default = "default_true")]
    pub live_gaming: bool,
    /// Spotify / Apple Music overlay while "Listening to music" is active.
    #[serde(default = "default_true")]
    pub music_now_playing: bool,
    /// Live editor / IDE overlay while "Coding" is active.
    #[serde(default = "default_true")]
    pub coding_now_playing: bool,
    /// Prefer static activity tiles (hover reveals GIF) — saves CPU.
    #[serde(default = "default_false")]
    pub static_tiles: bool,
    /// Share score / KDA / detailed lines on Discord (not just "In match").
    #[serde(default = "default_true")]
    pub share_valorant_stats_discord: bool,
    /// `full` | `minimal` — presets for Valorant Discord detail level.
    #[serde(default = "default_gaming_presence_detail")]
    pub gaming_presence_detail: String,
    #[serde(default = "default_false")]
    pub idle_enabled: bool,
    #[serde(default = "default_idle_details")]
    pub idle_details: String,
    #[serde(default = "default_idle_state")]
    pub idle_state: String,
    #[serde(default = "default_idle_gif")]
    pub idle_gif: String,
    #[serde(default = "default_false")]
    pub rotate_enabled: bool,
    #[serde(default = "default_rotate_secs")]
    pub rotate_seconds: u32,
    #[serde(default = "default_true")]
    pub rotate_favorites_only: bool,
    #[serde(default = "default_false")]
    pub quiet_hours_enabled: bool,
    #[serde(default = "default_quiet_start")]
    pub quiet_start: String,
    #[serde(default = "default_quiet_end")]
    pub quiet_end: String,
    #[serde(default = "default_density")]
    pub grid_density: String,
    #[serde(default = "default_category")]
    pub default_category: String,
    #[serde(default = "default_max_recents")]
    pub max_recents: u32,
    #[serde(default = "default_true")]
    pub toast_enabled: bool,
    #[serde(default = "default_false")]
    pub focus_search_on_open: bool,
    #[serde(default = "default_true")]
    pub remember_last: bool,
    #[serde(default = "default_cooldown")]
    pub presence_cooldown_ms: u32,
    #[serde(default)]
    pub favorites: Vec<String>,
    #[serde(default)]
    pub recents: Vec<String>,
    #[serde(default)]
    pub last_activity_id: Option<String>,
    #[serde(default)]
    pub custom: Vec<CustomActivity>,
    #[serde(default = "default_theme")]
    pub theme: String,
    /// Local rollup of install section telemetry — synced to Supabase on official builds.
    #[serde(default)]
    pub install_telemetry: InstallTelemetry,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            skin: default_skin(),
            theme_accent: default_accent(),
            auto_connect: true,
            minimize_to_tray: true,
            launch_minimized: false,
            confirm_clear: false,
            favorites_first: true,
            reduce_motion: false,
            show_elapsed: true,
            show_button: true,
            button_label: default_btn_label(),
            button_url: default_btn_url(),
            large_text: default_large_text(),
            donation_url: default_donate_url(),
            show_donate: true,
            wallpaper_enabled: true,
            gaming_probe: false,
            live_gaming: true,
            music_now_playing: true,
            coding_now_playing: true,
            static_tiles: false,
            share_valorant_stats_discord: true,
            gaming_presence_detail: default_gaming_presence_detail(),
            idle_enabled: false,
            idle_details: default_idle_details(),
            idle_state: default_idle_state(),
            idle_gif: default_idle_gif(),
            rotate_enabled: false,
            rotate_seconds: 120,
            rotate_favorites_only: true,
            quiet_hours_enabled: false,
            quiet_start: default_quiet_start(),
            quiet_end: default_quiet_end(),
            grid_density: default_density(),
            default_category: default_category(),
            max_recents: 8,
            toast_enabled: true,
            focus_search_on_open: false,
            remember_last: true,
            presence_cooldown_ms: 400,
            favorites: vec![],
            recents: vec![],
            last_activity_id: None,
            custom: vec![],
            theme: default_theme(),
            install_telemetry: InstallTelemetry::default(),
        }
    }
}

impl Config {
    pub fn sanitize(mut self) -> Self {
        let skins = ["studio", "arcade", "terminal", "zen"];
        if !skins.contains(&self.skin.as_str()) {
            // Migrate previous skin names
            self.skin = match self.skin.as_str() {
                "pulse" => "studio".into(),
                "cabinet" => "arcade".into(),
                "console" => "terminal".into(),
                "signal" | "ink" => "terminal".into(),
                "mint" | "moss" => "arcade".into(),
                _ => match self.theme.as_str() {
                    "signal" | "ink" => "terminal".into(),
                    "mint" | "moss" => "arcade".into(),
                    _ => "studio".into(),
                },
            };
        }
        // Hover text should never force the app brand onto Discord
        if self.large_text.eq_ignore_ascii_case("smiley") {
            self.large_text.clear();
        }
        // Migrate old PayPal-as-RPC-button names to Download
        if self.button_label.eq_ignore_ascii_case("get smiley") {
            self.button_label = default_btn_label();
            self.button_url = default_btn_url();
        }
        if self.button_label.trim().is_empty() {
            self.button_label = default_btn_label();
        }
        if self.button_url.trim().is_empty() {
            self.button_url = default_btn_url();
        }
        if self.donation_url.trim().is_empty() {
            self.donation_url = default_donate_url();
        }
        // Always keep author PayPal for official builds (matches Electron v7)
        self.donation_url = default_donate_url();
        self.rotate_seconds = self.rotate_seconds.clamp(30, 3600);
        self.max_recents = self.max_recents.clamp(3, 20);
        self.presence_cooldown_ms = self.presence_cooldown_ms.clamp(200, 10_000);
        for c in &mut self.custom {
            c.details = sanitize_text(&c.details, 128);
            c.state = sanitize_text(&c.state, 128);
            c.emoji = sanitize_text(&c.emoji, 8);
            if let Some(gif) = c.gif.as_mut() {
                *gif = sanitize_gif_url_or(gif, CUSTOM_GIF_FALLBACK);
            }
        }
        let prev_idle = self.idle_gif.trim().to_string();
        self.idle_gif = if prev_idle.is_empty() {
            default_idle_gif()
        } else {
            sanitize_gif_url(&prev_idle).unwrap_or(prev_idle)
        };
        if !self.button_url.starts_with("https://") || !is_safe_button_url(&self.button_url) {
            self.button_url = default_btn_url();
        }
        if !["cozy", "comfy", "compact"].contains(&self.grid_density.as_str()) {
            self.grid_density = "cozy".into();
        }
        if !["full", "minimal"].contains(&self.gaming_presence_detail.as_str()) {
            self.gaming_presence_detail = if self.share_valorant_stats_discord {
                "full".into()
            } else {
                "minimal".into()
            };
        }
        if self.gaming_presence_detail == "minimal" {
            self.share_valorant_stats_discord = false;
        } else {
            self.share_valorant_stats_discord = true;
        }
        if self.theme_accent.trim().is_empty() {
            self.theme_accent = self.theme.clone();
        }
        self.install_telemetry = self.install_telemetry.clone().normalize();
        if !["ember", "ink", "moss", "violet", "gold"].contains(&self.theme_accent.as_str()) {
            self.theme_accent = match self.theme_accent.as_str() {
                "signal" | "rose" => "ember".into(),
                "mint" => "moss".into(),
                _ => "ember".into(),
            };
        }
        self.theme = self.theme_accent.clone();
        self.favorites.truncate(40);
        self.recents.truncate(self.max_recents as usize);
        self.custom.truncate(40);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub version: String,
    pub status: Status,
    pub config: Config,
    pub categories: Vec<Category>,
}

fn sanitize_text(s: &str, max: usize) -> String {
    s.chars()
        .filter(|c| !c.is_control())
        .take(max)
        .collect::<String>()
        .trim()
        .to_string()
}

const CUSTOM_GIF_FALLBACK: &str =
    "https://media.tenor.com/_EzjRj8XOP4AAAAM/streaming-stream.gif";

/// Normalize Tenor CDN variants (media1, media2, http) to Discord-safe HTTPS.
pub fn normalize_gif_url(url: &str) -> String {
    let mut u = url.trim().to_string();
    if u.is_empty() {
        return u;
    }
    if !u.starts_with("http://") && !u.starts_with("https://") && u.contains("tenor.com") {
        u = format!("https://{u}");
    }
    if u.starts_with("http://") {
        u = u.replacen("http://", "https://", 1);
    }
    if let Some(rest) = u.strip_prefix("https://media1.tenor.com/m/") {
        let mut parts = rest.splitn(2, '/');
        if let (Some(id), Some(file)) = (parts.next(), parts.next()) {
            let id = if id.ends_with("AAAAC") {
                format!("{}AAAAM", &id[..id.len().saturating_sub(5)])
            } else {
                id.to_string()
            };
            return format!("https://media.tenor.com/{id}/{file}");
        }
        u = u.replace("https://media1.tenor.com", "https://media.tenor.com");
    }
    if u.starts_with("https://media1.tenor.com/") {
        u = u.replace("https://media1.tenor.com", "https://media.tenor.com");
    }
    u
}

fn is_valid_tenor_gif_url(url: &str) -> bool {
    let u = url.trim();
    if u.is_empty() || u.len() >= 500 {
        return false;
    }
    if u.contains(['"', '\'', '<', '>', ' ']) {
        return false;
    }
    let host = u
        .strip_prefix("https://")
        .and_then(|rest| rest.split('/').next());
    let Some(host) = host else {
        return false;
    };
    host == "media.tenor.com"
        || host == "c.tenor.com"
        || host == "media1.tenor.com"
        || (host.starts_with("media") && host.ends_with(".tenor.com"))
}

/// Tenor HTTPS only — Discord-safe + matches CSP img-src.
pub fn sanitize_gif_url(url: &str) -> Option<String> {
    let u = normalize_gif_url(url);
    if is_valid_tenor_gif_url(&u) {
        Some(u)
    } else {
        None
    }
}

/// HTTPS CDN URLs Discord can proxy (Valorant / Riot / Steam / Tenor GIFs).
pub fn sanitize_rpc_image_url(url: &str) -> Option<String> {
    let u = url.trim();
    if u.is_empty() || u.len() >= 512 {
        return None;
    }
    if u.contains(['"', '\'', '<', '>', ' ']) {
        return None;
    }
    if let Some(gif) = sanitize_gif_url(u) {
        return Some(gif);
    }
    let host = u
        .strip_prefix("https://")
        .and_then(|rest| rest.split('/').next())?;
    let ok = matches!(
        host,
        "media.valorant-api.com"
            | "cmsassets.rgpub.io"
            | "ddragon.leagueoflegends.com"
            | "cdn.cloudflare.steamstatic.com"
            | "cdn.steamstatic.com"
            | "static-cdn.jtvnw.net"
            | "raw.githubusercontent.com"
    );
    if ok && u.starts_with("https://") {
        Some(u.to_string())
    } else {
        None
    }
}

pub fn sanitize_gif_url_or(url: &str, fallback: &str) -> String {
    sanitize_gif_url(url).unwrap_or_else(|| fallback.to_string())
}

pub fn is_safe_donate_url(url: &str) -> bool {
    let u = url.trim();
    u == "https://paypal.me/1tsRaj" || u.starts_with("https://paypal.me/1tsRaj/")
}

/// Discord RPC button URL — GitHub download page only.
pub fn is_safe_button_url(url: &str) -> bool {
    let u = url.trim();
    u == "https://github.com/1tsRajuWu/Smiley/releases/latest"
        || u.starts_with("https://github.com/1tsRajuWu/Smiley/releases/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_media1_tenor_path() {
        let raw = "https://media1.tenor.com/m/AbCdEfAAAAC/taco.gif";
        let out = normalize_gif_url(raw);
        assert_eq!(out, "https://media.tenor.com/AbCdEfAAAAM/taco.gif");
    }

    #[test]
    fn accepts_media2_tenor_host() {
        let url = "https://media2.tenor.com/abc/def.gif";
        assert!(sanitize_gif_url(url).is_some());
    }

    #[test]
    fn upgrades_http_tenor() {
        let url = "http://media.tenor.com/abc/def.gif";
        let out = sanitize_gif_url(url).expect("valid");
        assert!(out.starts_with("https://media.tenor.com/"));
    }

    #[test]
    fn idle_gif_roundtrip_survives_sanitize() {
        let custom = "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif";
        let mut cfg = Config::default();
        cfg.idle_gif = custom.into();
        let saved = cfg.sanitize();
        assert_eq!(saved.idle_gif, custom);
    }

    #[test]
    fn normalize_protocol_less_tenor_cdn() {
        let raw = "media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif";
        let out = normalize_gif_url(raw);
        assert_eq!(out, "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif");
        assert!(sanitize_gif_url(&out).is_some());
    }

    #[test]
    fn idle_gif_json_roundtrip_on_disk() {
        let custom = "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif";
        let mut cfg = Config::default();
        cfg.idle_gif = custom.into();
        let cfg = cfg.sanitize();
        let raw = serde_json::to_string_pretty(&cfg).expect("serialize");
        assert!(raw.contains("idleGif"), "JSON must use camelCase idleGif field");
        assert!(raw.contains(custom), "JSON must contain saved idle GIF URL");
        let loaded: Config = serde_json::from_str(&raw).expect("deserialize");
        assert_eq!(loaded.sanitize().idle_gif, custom);
    }

    #[test]
    fn idle_gif_deserializes_from_camel_case_payload() {
        let custom = "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif";
        let json = format!(r#"{{"skin":"studio","idleGif":"{custom}"}}"#);
        let cfg: Config = serde_json::from_str(&json).expect("parse frontend payload");
        assert_eq!(cfg.idle_gif, custom);
        assert_eq!(cfg.sanitize().idle_gif, custom);
    }
}
