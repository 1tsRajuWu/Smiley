use crate::activities;
use crate::config;
use crate::discord::{Discord, Presence, RpcActivityType, resolve_rpc_image};
use crate::error::{AppError, AppResult};
use crate::models::{sanitize_gif_url, sanitize_gif_url_or, *};
use parking_lot::Mutex;
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
    /// Last pushed music track signature — skip Discord when unchanged.
    pub last_music_sig: Mutex<String>,
    /// Last pushed coding session signature — skip Discord when unchanged.
    pub last_coding_sig: Mutex<String>,
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
            last_music_sig: Mutex::new(String::new()),
            last_coding_sig: Mutex::new(String::new()),
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
        self.build_presence_typed(details, state, emoji, gif, start, None)
    }

    fn build_presence_typed(
        &self,
        details: &str,
        state: &str,
        emoji: &str,
        gif: &str,
        start: Option<i64>,
        activity_type: Option<RpcActivityType>,
    ) -> Presence {
        let cfg = self.config.lock();
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
        let fallback =
            "https://media.tenor.com/_EzjRj8XOP4AAAAM/streaming-stream.gif";
        Presence {
            details: details.into(),
            state: state.into(),
            large_image: resolve_rpc_image(gif, fallback),
            large_text,
            small_image: None,
            small_text: None,
            start,
            button_label,
            button_url,
            activity_type,
        }
    }

    fn build_valorant_presence(
        &self,
        live: &crate::riot::RiotLive,
        details: &str,
        state: &str,
        start: Option<i64>,
    ) -> Presence {
        let cfg = self.config.lock();
        let art = crate::valorant_assets::resolve_art(live);
        let (button_label, button_url) = if cfg.show_button {
            (Some(cfg.button_label.clone()), Some(cfg.button_url.clone()))
        } else {
            (None, None)
        };
        let start = if cfg.show_elapsed { start } else { None };
        Presence {
            details: details.into(),
            state: state.into(),
            large_image: art.large_image,
            large_text: art.large_text,
            small_image: art.small_image,
            small_text: art.small_text,
            start,
            button_label,
            button_url,
            activity_type: Some(RpcActivityType::Playing),
        }
    }

    fn activity_gif(&self, activity_id: &str, status_gif: Option<&str>) -> String {
        const FALLBACK: &str =
            "https://media.tenor.com/_EzjRj8XOP4AAAAM/streaming-stream.gif";
        if let Some(gif) = status_gif {
            if sanitize_gif_url(gif).is_some() {
                return resolve_rpc_image(gif, FALLBACK);
            }
        }
        if let Ok((_, _, _, gif)) = self.resolve(activity_id) {
            return resolve_rpc_image(&gif, FALLBACK);
        }
        FALLBACK.into()
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
                let rpc_type = if id == "listening" {
                    Some(RpcActivityType::Listening)
                } else {
                    None
                };
                self.discord.set(self.build_presence_typed(
                    &details,
                    &state,
                    &emoji,
                    &gif,
                    Some(start),
                    rpc_type,
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
        *self.last_music_sig.lock() = String::new();
        *self.last_coding_sig.lock() = String::new();

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

        let current = self.status.lock().activity_id.clone();
        let start = current
            .as_ref()
            .and_then(|id| pool.iter().position(|x| x == id))
            .unwrap_or(usize::MAX);
        let next_idx = if start == usize::MAX {
            0
        } else {
            (start + 1) % pool.len()
        };
        *self.rotate_index.lock() = next_idx;
        let id = pool[next_idx].clone();
        Ok(Some(self.set_activity(&id)?))
    }

    pub fn save_config(&self, next: Config) -> AppResult<Config> {
        let raw_idle = next.idle_gif.trim().to_string();
        if !raw_idle.is_empty() && sanitize_gif_url(&raw_idle).is_none() {
            return Err(AppError::Msg(
                "Idle GIF must be a Tenor HTTPS URL (https://media.tenor.com/…)".into(),
            ));
        }
        let mut next = next.sanitize();
        // Guard: never let a partial settings write erase persisted lists.
        {
            let live = self.config.lock();
            if next.custom.is_empty() && !live.custom.is_empty() {
                next.custom = live.custom.clone();
            }
            if next.favorites.is_empty() && !live.favorites.is_empty() {
                next.favorites = live.favorites.clone();
            }
            if next.recents.is_empty() && !live.recents.is_empty() {
                next.recents = live.recents.clone();
            }
            if next.last_activity_id.is_none() {
                next.last_activity_id = live.last_activity_id.clone();
            }
            if !raw_idle.is_empty() {
                next.idle_gif = sanitize_gif_url(&raw_idle).unwrap_or(raw_idle);
            } else if live.idle_gif != next.idle_gif {
                next.idle_gif = live.idle_gif.clone();
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
            act.gif = Some(sanitize_gif_url_or(
                gif,
                "https://media.tenor.com/_EzjRj8XOP4AAAAM/streaming-stream.gif",
            ));
        }
        act.details = act.details.chars().filter(|c| !c.is_control()).take(128).collect();
        act.state = act.state.chars().filter(|c| !c.is_control()).take(128).collect();
        let mut cfg = self.config.lock().clone();
        cfg.custom.retain(|c| c.id != act.id);
        cfg.custom.push(act);
        cfg.custom.truncate(40);
        self.save_config(cfg)
    }

    pub fn music_listening_active(&self) -> bool {
        let cfg = self.config.lock();
        let status = self.status.lock();
        status.connected
            && !status.paused
            && cfg.music_now_playing
            && status.activity_id.as_deref() == Some("listening")
    }

    pub fn coding_live_active(&self) -> bool {
        let cfg = self.config.lock();
        let status = self.status.lock();
        status.connected
            && !status.paused
            && cfg.coding_now_playing
            && status.activity_id.as_deref() == Some("coding")
    }

    /// Apply now-playing track to Discord (event-driven or polled). Shows idle listening when no track.
    pub fn music_apply_track(&self, track: Option<crate::music::TrackHit>) -> AppResult<()> {
        let cfg = self.config.lock().clone();
        let status = self.status.lock().clone();
        if !status.connected || status.paused {
            *self.last_music_sig.lock() = String::new();
            return Ok(());
        }
        if Self::in_quiet_hours(&cfg) {
            return Ok(());
        }
        if !cfg.music_now_playing || status.activity_id.as_deref() != Some("listening") {
            *self.last_music_sig.lock() = String::new();
            return Ok(());
        }

        const LISTENING_GIF: &str =
            "https://media.tenor.com/dN976uhxB0kAAAAM/aimoto-rinku-listening-to-music.gif";
        let gif = self.activity_gif("listening", status.gif.as_deref());

        if let Some(track) = track.filter(|t| t.playing) {
            let sig = crate::music::track_signature(&track);
            if sig == *self.last_music_sig.lock() {
                return Ok(());
            }
            *self.last_music_sig.lock() = sig;

            let details = trunc(&track.title, 128);
            let state = trunc(&format!("{} · {}", track.artist, track.app), 128);
            self.discord.set(self.build_presence_typed(
                &details,
                &state,
                "🎧",
                &gif,
                None,
                Some(RpcActivityType::Listening),
            ))?;
            {
                let mut s = self.status.lock();
                s.details = Some(details);
                s.state = Some(state);
                s.gif = Some(gif);
                s.message = "Music live".into();
            }
        } else {
            let sig = format!("idle-listening\0{gif}");
            if sig == *self.last_music_sig.lock() {
                return Ok(());
            }
            *self.last_music_sig.lock() = sig;
            let (details, state) = self
                .resolve("listening")
                .map(|(d, st, _, _)| (d, st))
                .unwrap_or_else(|_| ("Listening to music".into(), "Vibes on 🎵".into()));
            self.discord.set(self.build_presence_typed(
                &details,
                &state,
                "🎧",
                &gif,
                self.started_at.lock().map(|s| s as i64),
                Some(RpcActivityType::Listening),
            ))?;
            {
                let mut s = self.status.lock();
                s.details = Some(details);
                s.state = Some(state);
                s.gif = Some(resolve_rpc_image(&gif, LISTENING_GIF));
                s.message = "Listening".into();
            }
        }
        Ok(())
    }

    /// One-shot music probe (manual / tests).
    pub fn music_tick(&self) -> AppResult<()> {
        let track = crate::music::probe_now_playing().ok().flatten();
        self.music_apply_track(track)
    }

    /// Live coding overlay — foreground editor detection (macOS osascript).
    pub fn coding_tick(&self) -> AppResult<()> {
        let cfg = self.config.lock().clone();
        let status = self.status.lock().clone();
        if !status.connected || status.paused {
            *self.last_coding_sig.lock() = String::new();
            return Ok(());
        }
        if Self::in_quiet_hours(&cfg) {
            return Ok(());
        }
        if !cfg.coding_now_playing || status.activity_id.as_deref() != Some("coding") {
            *self.last_coding_sig.lock() = String::new();
            return Ok(());
        }

        const CODING_GIF: &str =
            "https://media.tenor.com/QLh0PhunTj8AAAAM/anime-typing.gif";
        let gif = self.activity_gif("coding", status.gif.as_deref());
        let fallback_state = status
            .state
            .clone()
            .unwrap_or_else(|| "Building something cool".into());

        let (details, state, sig_key) = match crate::coding::probe_foreground_coding()? {
            Some(session) => {
                let sig = crate::coding::session_signature(&session);
                let details = trunc(&session.app_name, 128);
                let state = trunc(
                    session
                        .live_line
                        .as_deref()
                        .unwrap_or(fallback_state.as_str()),
                    128,
                );
                (details, state, sig)
            }
            None => {
                let details = status
                    .details
                    .clone()
                    .unwrap_or_else(|| "Coding".into());
                let state = fallback_state.clone();
                (details, state, format!("static-coding\0{fallback_state}"))
            }
        };

        if sig_key == *self.last_coding_sig.lock() {
            return Ok(());
        }
        *self.last_coding_sig.lock() = sig_key;

        let start = self.started_at.lock().map(|s| s as i64);
        self.discord.set(self.build_presence_typed(
            &details,
            &state,
            "💻",
            &gif,
            start,
            None,
        ))?;
        {
            let mut s = self.status.lock();
            s.details = Some(details);
            s.state = Some(state);
            s.gif = Some(resolve_rpc_image(&gif, CODING_GIF));
            s.message = "Coding live".into();
        }
        Ok(())
    }

    /// Overlay live Valorant/Riot onto Discord when gaming modes are active.
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

        // Music has its own fast thread — don't let gaming steal the listening slot.
        if cfg.music_now_playing && status.activity_id.as_deref() == Some("listening") {
            return Ok(());
        }

        // Coding has its own poll thread — don't let gaming steal the coding slot.
        if cfg.coding_now_playing && status.activity_id.as_deref() == Some("coding") {
            return Ok(());
        }

        // Always refresh match board when live gaming is on
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
                        let start = Some(Self::now_secs() as i64);
                        if live.product == "valorant" {
                            self.discord.set(self.build_valorant_presence(
                                &live,
                                &details,
                                &state,
                                start,
                            ))?;
                        } else {
                            let gif = status
                                .activity_id
                                .as_deref()
                                .and_then(|id| self.resolve(id).ok())
                                .map(|(_, _, _, g)| g)
                                .unwrap_or_else(|| {
                                    "https://media.tenor.com/yjGe52tfF-wAAAAM/gaming-gamer.gif"
                                        .into()
                                });
                            self.discord.set(self.build_presence(
                                &details,
                                &state,
                                "🎮",
                                &gif,
                                start,
                            ))?;
                        }
                        {
                            let mut s = self.status.lock();
                            s.activity_id = Some(format!("live-{}", live.product));
                            s.details = Some(details);
                            s.state = Some(state);
                            if live.product == "valorant" {
                                s.gif = Some(crate::valorant_catalog::valorant_game_logo().into());
                            }
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
