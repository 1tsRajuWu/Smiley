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
    /// Live Valorant match board (ally/enemy seats) — local Riot only.
    #[serde(default)]
    pub match_board: Option<crate::riot::MatchBoard>,
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
    /// Prefer static activity tiles (hover reveals GIF) — saves CPU.
    #[serde(default = "default_false")]
    pub static_tiles: bool,
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
            static_tiles: false,
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
                *gif = sanitize_gif_url(gif);
            }
        }
        self.idle_gif = sanitize_gif_url(&self.idle_gif);
        if !self.button_url.starts_with("https://") {
            self.button_url = default_btn_url();
        }
        if !["cozy", "comfy", "compact"].contains(&self.grid_density.as_str()) {
            self.grid_density = "cozy".into();
        }
        if self.theme_accent.trim().is_empty() {
            self.theme_accent = self.theme.clone();
        }
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

/// Tenor HTTPS only — Discord-safe + matches CSP img-src.
pub fn sanitize_gif_url(url: &str) -> String {
    let u = url.trim();
    let ok = (u.starts_with("https://media.tenor.com/")
        || u.starts_with("https://c.tenor.com/")
        || u.starts_with("https://media1.tenor.com/"))
        && !u.contains(['"', '\'', '<', '>', ' '])
        && u.len() < 500;
    if ok {
        u.into()
    } else {
        default_idle_gif()
    }
}

pub fn is_safe_donate_url(url: &str) -> bool {
    let u = url.trim();
    u == "https://paypal.me/1tsRaj" || u.starts_with("https://paypal.me/1tsRaj/")
}
