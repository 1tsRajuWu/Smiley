use crate::activities;
use crate::config;
use crate::discord::{Discord, Presence};
use crate::error::{AppError, AppResult};
use crate::models::{sanitize_gif_url, *};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

fn trunc(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max.saturating_sub(1)).collect::<String>() + "…"
    }
}

pub struct App {
    pub discord: Discord,
    pub config: Mutex<Config>,
    pub status: Mutex<Status>,
    pub started_at: Mutex<Option<u64>>,
    pub rotate_index: Mutex<usize>,
    pub last_set_at: Mutex<Option<Instant>>,
}

impl App {
    pub fn boot() -> AppResult<Arc<Self>> {
        let client_id = config::discord_client_id()?;
        let cfg = config::load().sanitize();
        Ok(Arc::new(Self {
            discord: Discord::start(client_id),
            config: Mutex::new(cfg),
            status: Mutex::new(Status {
                connected: false,
                message: "Ready".into(),
                activity_id: None,
                details: None,
                state: None,
                gif: None,
                paused: false,
                elapsed_secs: None,
                rotate_active: false,
                match_board: None,
            }),
            started_at: Mutex::new(None),
            rotate_index: Mutex::new(0),
            last_set_at: Mutex::new(None),
        }))
    }

    fn now_secs() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    fn parse_hhmm(s: &str) -> Option<(u32, u32)> {
        let mut parts = s.trim().split(':');
        let h = parts.next()?.parse::<u32>().ok()?;
        let m = parts.next()?.parse::<u32>().ok()?;
        if h < 24 && m < 60 {
            Some((h, m))
        } else {
            None
        }
    }

    fn in_quiet_hours(cfg: &Config) -> bool {
        if !cfg.quiet_hours_enabled {
            return false;
        }
        let Some((sh, sm)) = Self::parse_hhmm(&cfg.quiet_start) else {
            return false;
        };
        let Some((eh, em)) = Self::parse_hhmm(&cfg.quiet_end) else {
            return false;
        };
        let now = local_minutes();
        let start = sh * 60 + sm;
        let end = eh * 60 + em;
        if start == end {
            return false;
        }
        if start < end {
            now >= start && now < end
        } else {
            now >= start || now < end
        }
    }

    pub fn snapshot(&self) -> Snapshot {
        let mut categories = activities::categories();
        let cfg = self.config.lock().clone();
        let customs: Vec<Activity> = cfg
            .custom
            .iter()
            .map(|c| Activity {
                id: c.id.clone(),
                details: c.details.clone(),
                state: c.state.clone(),
                emoji: c.emoji.clone(),
                category: "custom".into(),
                color: "#bb9af7".into(),
                gif: c.gif.clone().unwrap_or_else(|| {
                    "https://media.tenor.com/_EzjRj8XOP4AAAAM/streaming-stream.gif".into()
                }),
            })
            .collect();
        categories.push(Category {
            id: "custom".into(),
            label: "My Activities".into(),
            emoji: "✨".into(),
            color: "#bb9af7".into(),
            activities: customs,
        });
        Snapshot {
            version: env!("CARGO_PKG_VERSION").into(),
            status: self.refresh_status_fields(),
            config: cfg,
            categories,
        }
    }

    fn refresh_status_fields(&self) -> Status {
        let cfg = self.config.lock().clone();
        let mut s = self.status.lock().clone();
        s.connected = *self.discord.connected.lock();
        if s.activity_id.is_some() {
            if let Some(start) = *self.started_at.lock() {
                s.elapsed_secs = Some(Self::now_secs().saturating_sub(start));
            }
        } else {
            s.elapsed_secs = None;
        }
        s.rotate_active = cfg.rotate_enabled && !s.paused;
        if let Some(board) = s.match_board.clone() {
            s.match_board = crate::privacy::sanitize_board(board, &cfg);
        }
        {
            let mut lock = self.status.lock();
            lock.connected = s.connected;
            lock.elapsed_secs = s.elapsed_secs;
            lock.rotate_active = s.rotate_active;
        }
        s
    }

    pub fn connect(&self) -> AppResult<Status> {
        match self.discord.connect() {
            Ok(()) => {
                {
                    let mut s = self.status.lock();
                    s.connected = true;
                    s.message = "Connected".into();
                }
                let (remember, id) = {
                    let cfg = self.config.lock();
                    (cfg.remember_last, cfg.last_activity_id.clone())
                };
                if remember {
                    if let Some(id) = id {
                        if self.resolve(id.as_str()).is_ok() {
                            let _ = self.set_activity(&id);
                        }
                    }
                }
                Ok(self.refresh_status_fields())
            }
            Err(e) => {
                let mut s = self.status.lock();
                s.connected = false;
                s.message = e.to_string();
                Err(e)
            }
        }
    }

    fn resolve(&self, id: &str) -> AppResult<(String, String, String, String)> {
        let cfg = self.config.lock();
        if let Some(a) = activities::find(id) {
            Ok((a.details, a.state, a.emoji, a.gif))
        } else if let Some(c) = cfg.custom.iter().find(|c| c.id == id) {
            Ok((
                c.details.clone(),
                c.state.clone(),
                c.emoji.clone(),
                c.gif.clone().unwrap_or_else(|| {
                    "https://media.tenor.com/_EzjRj8XOP4AAAAM/streaming-stream.gif".into()
                }),
            ))
        } else {
            Err(AppError::Msg(format!("Unknown activity: {id}")))
        }
    }

    fn build_presence(
        &self,
        details: &str,
        state: &str,
        emoji: &str,
        gif: &str,
        start: Option<i64>,
    ) -> Presence {
        let cfg = self.config.lock();
        // Hover text = activity emoji / optional custom — never force "Smiley" brand
        let large_text = if cfg.large_text.trim().is_empty()
            || cfg.large_text.eq_ignore_ascii_case("smiley")
        {
            emoji.to_string()
        } else {
            format!("{emoji} {}", cfg.large_text.trim())
        };
        let (button_label, button_url) = if cfg.show_button {
            (Some(cfg.button_label.clone()), Some(cfg.button_url.clone()))
        } else {
            (None, None)
        };
        let start = if cfg.show_elapsed { start } else { None };
        Presence {
            details: details.into(),
            state: state.into(),
            large_image: gif.into(),
            large_text,
            start,
            button_label,
            button_url,
        }
    }

    pub fn set_activity(&self, id: &str) -> AppResult<Status> {
        let cfg_snap = self.config.lock().clone();
        if Self::in_quiet_hours(&cfg_snap) && !cfg_snap.idle_enabled {
            return Err(AppError::Msg(
                "Quiet hours — presence updates blocked".into(),
            ));
        }

        let (details, state, emoji, gif) = self.resolve(id)?;
        let start = Self::now_secs() as i64;
        let paused = self.status.lock().paused;

        // Debounce — same id = success no-op; different id within window = wait (avoid race).
        {
            let cooldown = Duration::from_millis(cfg_snap.presence_cooldown_ms as u64);
            let mut last = self.last_set_at.lock();
            if let Some(at) = *last {
                if at.elapsed() < cooldown {
                    let current = self.status.lock().activity_id.clone();
                    if current.as_deref() == Some(id) {
                        return Ok(self.refresh_status_fields());
                    }
                    return Err(AppError::Msg("Slow down — presence cooling".into()));
                }
            }
            *last = Some(Instant::now());
        }

        if !paused {
            if Self::in_quiet_hours(&cfg_snap) && cfg_snap.idle_enabled {
                self.apply_idle()?;
            } else {
                self.discord.set(self.build_presence(
                    &details,
                    &state,
                    &emoji,
                    &gif,
                    Some(start),
                ))?;
            }
        }

        {
            let mut cfg = self.config.lock();
            cfg.last_activity_id = Some(id.into());
            cfg.recents.retain(|x| x != id);
            cfg.recents.insert(0, id.into());
            let max = cfg.max_recents as usize;
            cfg.recents.truncate(max);
            let _ = config::save(&cfg);
        }

        *self.started_at.lock() = Some(Self::now_secs());

        {
            let mut s = self.status.lock();
            s.connected = *self.discord.connected.lock();
            s.activity_id = Some(id.into());
            s.details = Some(details);
            s.state = Some(state);
            s.gif = Some(gif);
            s.message = if paused {
                "Paused (selection saved)".into()
            } else if Self::in_quiet_hours(&cfg_snap) {
                "Quiet hours idle".into()
            } else {
                "Presence live".into()
            };
        }
        Ok(self.refresh_status_fields())
    }

    fn apply_idle(&self) -> AppResult<()> {
        let cfg = self.config.lock().clone();
        self.discord.set(self.build_presence(
            &cfg.idle_details,
            &cfg.idle_state,
            "💤",
            &cfg.idle_gif,
            None,
        ))
    }

    pub fn clear(&self) -> AppResult<Status> {
        let _ = self.discord.clear();
        *self.started_at.lock() = None;
        {
            let mut s = self.status.lock();
            s.activity_id = None;
            s.details = None;
            s.state = None;
            s.gif = None;
            s.elapsed_secs = None;
            s.match_board = None;
            s.message = if s.connected {
                "Cleared".into()
            } else {
                "Disconnected".into()
            };
        }
        Ok(self.refresh_status_fields())
    }

    pub fn set_paused(&self, paused: bool) -> AppResult<Status> {
        {
            let mut s = self.status.lock();
            s.paused = paused;
        }
        if paused {
            let _ = self.discord.clear();
            {
                let mut s = self.status.lock();
                s.message = "Paused".into();
                s.match_board = None;
            }
            Ok(self.refresh_status_fields())
        } else if let Some(id) = self.status.lock().activity_id.clone() {
            self.set_activity(&id)
        } else {
            {
                let mut s = self.status.lock();
                s.message = if s.connected {
                    "Connected".into()
                } else {
                    "Ready".into()
                };
            }
            Ok(self.refresh_status_fields())
        }
    }

    pub fn set_idle_now(&self) -> AppResult<Status> {
        self.apply_idle()?;
        let cfg = self.config.lock().clone();
        {
            let mut s = self.status.lock();
            s.message = "Idle presence set".into();
            s.details = Some(cfg.idle_details);
            s.state = Some(cfg.idle_state);
            s.gif = Some(cfg.idle_gif);
        }
        Ok(self.refresh_status_fields())
    }

    pub fn rotate_tick(&self) -> AppResult<Option<Status>> {
        let cfg = self.config.lock().clone();
        if !cfg.rotate_enabled || self.status.lock().paused {
            return Ok(None);
        }
        if Self::in_quiet_hours(&cfg) {
            return Ok(None);
        }

        let pool: Vec<String> = if cfg.rotate_favorites_only && !cfg.favorites.is_empty() {
            cfg.favorites.clone()
        } else {
            let snap = activities::categories();
            let mut ids: Vec<String> = snap
                .into_iter()
                .flat_map(|c| c.activities)
                .map(|a| a.id)
                .collect();
            for c in &cfg.custom {
                ids.push(c.id.clone());
            }
            ids
        };
        if pool.is_empty() {
            return Ok(None);
        }

        let mut idx = self.rotate_index.lock();
        *idx = (*idx + 1) % pool.len();
        let id = pool[*idx].clone();
        drop(idx);
        Ok(Some(self.set_activity(&id)?))
    }

    pub fn save_config(&self, next: Config) -> AppResult<Config> {
        let mut next = next.sanitize();
        // Guard: never let a partial settings write erase customs accidentally.
        {
            let live = self.config.lock();
            if next.custom.is_empty() && !live.custom.is_empty() {
                next.custom = live.custom.clone();
            }
            if next.last_activity_id.is_none() {
                next.last_activity_id = live.last_activity_id.clone();
            }
        }
        next = next.sanitize();
        config::save(&next)?;
        *self.config.lock() = next.clone();
        Ok(next)
    }

    pub fn replace_config(&self, next: Config) -> AppResult<Config> {
        let next = next.sanitize();
        config::save(&next)?;
        *self.config.lock() = next.clone();
        Ok(next)
    }

    pub fn reset_config(&self) -> AppResult<Config> {
        self.replace_config(Config::default())
    }

    pub fn toggle_favorite(&self, id: &str) -> AppResult<Config> {
        let mut cfg = self.config.lock().clone();
        if cfg.favorites.iter().any(|x| x == id) {
            cfg.favorites.retain(|x| x != id);
        } else {
            cfg.favorites.push(id.into());
            cfg.favorites.truncate(40);
        }
        self.save_config(cfg)
    }

    pub fn add_custom(&self, mut act: CustomActivity) -> AppResult<Config> {
        if act.details.trim().is_empty() {
            return Err(AppError::Msg("Details required".into()));
        }
        if act.id.is_empty() {
            act.id = format!("custom-{}", Uuid::new_v4());
        }
        if act.emoji.is_empty() {
            act.emoji = "✨".into();
        }
        if let Some(gif) = act.gif.as_ref() {
            act.gif = Some(sanitize_gif_url(gif));
        }
        act.details = act.details.chars().filter(|c| !c.is_control()).take(128).collect();
        act.state = act.state.chars().filter(|c| !c.is_control()).take(128).collect();
        let mut cfg = self.config.lock().clone();
        cfg.custom.retain(|c| c.id != act.id);
        cfg.custom.push(act);
        cfg.custom.truncate(40);
        self.save_config(cfg)
    }

    /// Overlay live Valorant/Riot or music onto Discord when those modes are active.
    /// Safe: local lockfile / timed osascript only. Never blocks the UI (bg thread).
    pub fn live_tick(&self) -> AppResult<()> {
        let cfg = self.config.lock().clone();
        let status = self.status.lock().clone();
        if !status.connected || status.paused {
            return Ok(());
        }
        if Self::in_quiet_hours(&cfg) {
            return Ok(());
        }

        // Music overlay while listening template is selected (probe every ~12s)
        static MUSIC_TICK: AtomicU32 = AtomicU32::new(0);
        if cfg.music_now_playing && status.activity_id.as_deref() == Some("listening") {
            let tick = MUSIC_TICK.fetch_add(1, Ordering::Relaxed);
            if tick % 3 == 0 {
                if let Ok(Some(track)) = crate::music::probe_now_playing() {
                    let details = trunc(&track.title, 128);
                    let state = trunc(
                        &format!("{} · {}", track.artist, track.app),
                        128,
                    );
                    let gif = status.gif.clone().unwrap_or_else(|| {
                        "https://media.tenor.com/dN976uhxB0kAAAAM/aimoto-rinku-listening-to-music.gif"
                            .into()
                    });
                    self.discord.set(self.build_presence(
                        &details,
                        &state,
                        "🎧",
                        &gif,
                        None,
                    ))?;
                    {
                        let mut s = self.status.lock();
                        s.details = Some(details);
                        s.state = Some(state);
                        s.message = "Music live".into();
                    }
                }
            }
            // Stay on listening slot even if no track yet — don't let gaming steal it
            return Ok(());
        }

        // Always refresh match board when live gaming is on (Valshy-style UI)
        if cfg.live_gaming {
            let riot_opts = crate::riot::RiotProbeOptions {
                resolve_names: cfg.show_other_riot_ids,
            };
            match crate::riot::probe_riot_presence_opts(riot_opts) {
                Ok(Some(live)) if live.product == "valorant" || live.board.active => {
                    let cfg_snap = cfg.clone();
                    {
                        let mut s = self.status.lock();
                        s.match_board = Some(live.board.clone());
                    }
                    let activity = status.activity_id.as_deref().unwrap_or("");
                    let gaming_slot = activity.is_empty()
                        || activity.starts_with("live-")
                        || matches!(
                            activity,
                            "gaming" | "ranked" | "coop" | "retro" | "speedrun" | "vr-gaming"
                        );
                    if gaming_slot {
                        let (details, state) =
                            crate::privacy::valorant_discord_lines(&live, &cfg_snap);
                        let gif = "https://media.tenor.com/yjGe52tfF-wAAAAM/gaming-gamer.gif";
                        let start = Some(Self::now_secs() as i64);
                        self.discord.set(self.build_presence(
                            &details,
                            &state,
                            "🎮",
                            gif,
                            start,
                        ))?;
                        {
                            let mut s = self.status.lock();
                            s.activity_id = Some(format!("live-{}", live.product));
                            s.details = Some(details);
                            s.state = Some(state);
                            s.gif = Some(gif.into());
                            s.message = format!("Live {}", live.title);
                        }
                    }
                    return Ok(());
                }
                _ => {
                    let mut s = self.status.lock();
                    if s.match_board.is_some() {
                        s.match_board = None;
                    }
                }
            }
        }

        // Optional process probe — only when gaming slot
        let activity = status.activity_id.as_deref().unwrap_or("");
        let gaming_slot = activity.is_empty()
            || activity.starts_with("live-")
            || matches!(
                activity,
                "gaming" | "ranked" | "coop" | "retro" | "speedrun" | "vr-gaming"
            );
        if gaming_slot && cfg.gaming_probe {
            if let Ok(Some(hit)) = crate::gaming::probe_foreground_game() {
                let gif = "https://media.tenor.com/yjGe52tfF-wAAAAM/gaming-gamer.gif";
                self.discord.set(self.build_presence(
                    &hit.details,
                    &hit.state,
                    "🎮",
                    gif,
                    Some(Self::now_secs() as i64),
                ))?;
                {
                    let mut s = self.status.lock();
                    s.activity_id = Some(format!("live-{}", hit.id));
                    s.details = Some(hit.details);
                    s.state = Some(hit.state);
                    s.gif = Some(gif.into());
                    s.message = format!("Live {}", hit.title);
                }
            }
        }
        Ok(())
    }

    pub fn remove_custom(&self, id: &str) -> AppResult<Config> {
        let mut cfg = self.config.lock().clone();
        cfg.custom.retain(|c| c.id != id);
        cfg.favorites.retain(|x| x != id);
        cfg.recents.retain(|x| x != id);
        if cfg.last_activity_id.as_deref() == Some(id) {
            cfg.last_activity_id = None;
        }
        self.save_config(cfg)
    }

    pub fn get_status(&self) -> Status {
        self.refresh_status_fields()
    }
}

fn local_minutes() -> u32 {
    use chrono::{Local, Timelike};
    let t = Local::now();
    t.hour() * 60 + t.minute()
}
