//! Discord IPC on its own thread — never blocks the UI.

use crate::error::{AppError, AppResult};
use discord_rich_presence::{
    activity::{Activity, Assets, Button, Timestamps},
    DiscordIpc, DiscordIpcClient,
};
use parking_lot::Mutex;
use std::sync::mpsc::{self, Receiver, SyncSender};
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct Presence {
    pub details: String,
    pub state: String,
    pub large_image: String,
    pub large_text: String,
    pub start: Option<i64>,
    pub button_label: Option<String>,
    pub button_url: Option<String>,
}

enum Job {
    Connect { reply: SyncSender<AppResult<()>> },
    Set { p: Presence, reply: SyncSender<AppResult<()>> },
    Clear { reply: SyncSender<AppResult<()>> },
}

pub struct Discord {
    tx: SyncSender<Job>,
    pub connected: Mutex<bool>,
}

impl Discord {
    pub fn start(client_id: String) -> Self {
        let (tx, rx) = mpsc::sync_channel(4);
        std::thread::Builder::new()
            .name("discord-ipc".into())
            .spawn(move || worker(client_id, rx))
            .expect("discord thread");
        Self {
            tx,
            connected: Mutex::new(false),
        }
    }

    pub fn connect(&self) -> AppResult<()> {
        let (tx, rx) = mpsc::sync_channel(1);
        self.tx
            .send(Job::Connect { reply: tx })
            .map_err(|_| AppError::Msg("Discord worker dead".into()))?;
        match rx.recv_timeout(Duration::from_secs(2)) {
            Ok(Ok(())) => {
                *self.connected.lock() = true;
                Ok(())
            }
            Ok(Err(e)) => {
                *self.connected.lock() = false;
                Err(e)
            }
            Err(_) => {
                *self.connected.lock() = false;
                Err(AppError::Msg(
                    "Discord connect timed out — open Discord desktop".into(),
                ))
            }
        }
    }

    pub fn set(&self, p: Presence) -> AppResult<()> {
        let (tx, rx) = mpsc::sync_channel(1);
        self.tx
            .send(Job::Set { p, reply: tx })
            .map_err(|_| AppError::Msg("Discord worker dead".into()))?;
        match rx.recv_timeout(Duration::from_secs(2)) {
            Ok(Ok(())) => {
                *self.connected.lock() = true;
                Ok(())
            }
            Ok(Err(e)) => {
                *self.connected.lock() = false;
                Err(e)
            }
            Err(_) => {
                *self.connected.lock() = false;
                Err(AppError::Msg("Discord set timed out".into()))
            }
        }
    }

    pub fn clear(&self) -> AppResult<()> {
        let (tx, rx) = mpsc::sync_channel(1);
        let _ = self.tx.send(Job::Clear { reply: tx });
        let _ = rx.recv_timeout(Duration::from_secs(1));
        Ok(())
    }
}

fn worker(client_id: String, rx: Receiver<Job>) {
    let mut client: Option<DiscordIpcClient> = None;
    let mut last_sig = String::new();
    let mut last_at = Instant::now() - Duration::from_secs(60);

    while let Ok(job) = rx.recv() {
        match job {
            Job::Connect { reply } => {
                let res = ensure_client(&mut client, &client_id);
                let _ = reply.send(res);
            }
            Job::Clear { reply } => {
                if let Some(c) = client.as_mut() {
                    let _ = c.clear_activity();
                }
                last_sig.clear();
                let _ = reply.send(Ok(()));
            }
            Job::Set { p, reply } => {
                let res = (|| -> AppResult<()> {
                    ensure_client(&mut client, &client_id)?;
                    let sig = format!(
                        "{}|{}|{}|{:?}|{:?}",
                        p.details, p.state, p.large_image, p.start, p.button_label
                    );
                    if last_sig == sig && last_at.elapsed() < Duration::from_millis(350) {
                        return Ok(());
                    }
                    last_sig = sig;
                    last_at = Instant::now();

                    let details = trunc(&p.details, 128);
                    let state = trunc(&p.state, 128);
                    let img = trunc(&p.large_image, 256);
                    let text = trunc(&p.large_text, 128);
                    let assets = Assets::new().large_image(&img).large_text(&text);

                    let label_t;
                    let url_t;
                    let mut activity = Activity::new()
                        .details(&details)
                        .state(&state)
                        .assets(assets);

                    if let Some(start) = p.start {
                        activity = activity.timestamps(Timestamps::new().start(start));
                    }

                    let with_button = p
                        .button_label
                        .as_ref()
                        .zip(p.button_url.as_ref())
                        .is_some_and(|(label, url)| !label.is_empty() && url.starts_with("http"));

                    if with_button {
                        label_t = trunc(p.button_label.as_deref().unwrap_or(""), 32);
                        url_t = trunc(p.button_url.as_deref().unwrap_or(""), 512);
                        let btn = Button::new(&label_t, &url_t);
                        activity = activity.buttons(vec![btn]);
                    }

                    client
                        .as_mut()
                        .ok_or_else(|| AppError::Msg("Not connected".into()))?
                        .set_activity(activity)
                        .map_err(|e| AppError::Msg(format!("set_activity: {e}")))?;
                    Ok(())
                })();
                if res.is_err() {
                    client = None;
                    last_sig.clear();
                }
                let _ = reply.send(res);
            }
        }
    }
}

fn ensure_client(slot: &mut Option<DiscordIpcClient>, client_id: &str) -> AppResult<()> {
    if slot.is_some() {
        return Ok(());
    }
    let mut c = DiscordIpcClient::new(client_id)
        .map_err(|e| AppError::Msg(format!("create: {e}")))?;
    c.connect()
        .map_err(|e| AppError::Msg(format!("Discord offline? {e}")))?;
    *slot = Some(c);
    Ok(())
}

fn trunc(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max.saturating_sub(1)).collect::<String>() + "…"
    }
}
