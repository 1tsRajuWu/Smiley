mod activities;
mod app;
mod config;
mod discord;
mod error;
mod gaming;
mod log_file;
mod models;
mod music;
mod privacy;
mod riot;

use app::App;
use models::*;
use std::sync::Arc;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
fn get_snapshot(state: tauri::State<'_, Arc<App>>) -> Snapshot {
    state.snapshot()
}

#[tauri::command]
fn connect(state: tauri::State<'_, Arc<App>>) -> Result<Status, error::AppError> {
    log_file::append("discord: connect requested");
    state.connect()
}

#[tauri::command]
fn set_activity(
    state: tauri::State<'_, Arc<App>>,
    activity_id: String,
) -> Result<Status, error::AppError> {
    log_file::append(&format!("presence: set {activity_id}"));
    state.set_activity(&activity_id)
}

#[tauri::command]
fn clear_activity(state: tauri::State<'_, Arc<App>>) -> Result<Status, error::AppError> {
    log_file::append("presence: clear");
    state.clear()
}

#[tauri::command]
fn set_paused(
    state: tauri::State<'_, Arc<App>>,
    paused: bool,
) -> Result<Status, error::AppError> {
    state.set_paused(paused)
}

#[tauri::command]
fn set_idle(state: tauri::State<'_, Arc<App>>) -> Result<Status, error::AppError> {
    state.set_idle_now()
}

#[tauri::command]
fn rotate_once(state: tauri::State<'_, Arc<App>>) -> Result<Option<Status>, error::AppError> {
    state.rotate_tick()
}

#[tauri::command]
fn get_status(state: tauri::State<'_, Arc<App>>) -> Status {
    state.get_status()
}

#[tauri::command]
fn save_config(
    state: tauri::State<'_, Arc<App>>,
    config: Config,
) -> Result<Config, error::AppError> {
    log_file::append("config: save");
    state.save_config(config)
}

#[tauri::command]
fn reset_config(state: tauri::State<'_, Arc<App>>) -> Result<Config, error::AppError> {
    log_file::append("config: reset");
    state.reset_config()
}

#[tauri::command]
fn toggle_favorite(
    state: tauri::State<'_, Arc<App>>,
    activity_id: String,
) -> Result<Config, error::AppError> {
    state.toggle_favorite(&activity_id)
}

#[tauri::command]
fn add_custom(
    state: tauri::State<'_, Arc<App>>,
    activity: CustomActivity,
) -> Result<Config, error::AppError> {
    state.add_custom(activity)
}

#[tauri::command]
fn remove_custom(
    state: tauri::State<'_, Arc<App>>,
    activity_id: String,
) -> Result<Config, error::AppError> {
    state.remove_custom(&activity_id)
}

#[tauri::command]
fn probe_game(state: tauri::State<'_, Arc<App>>) -> Result<Option<gaming::GameHit>, error::AppError> {
    if !state.config.lock().gaming_probe && !state.config.lock().live_gaming {
        return Ok(None);
    }
    gaming::probe_foreground_game()
}

#[tauri::command]
fn get_match_board(state: tauri::State<'_, Arc<App>>) -> Option<riot::MatchBoard> {
    let cfg = state.config.lock().clone();
    let board = state.status.lock().match_board.clone()?;
    crate::privacy::sanitize_board(board, &cfg)
}

/// Open donate URL from Rust only — webview cannot open arbitrary https.
#[tauri::command]
fn open_donation_url(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<App>>,
) -> Result<(), error::AppError> {
    let url = state.config.lock().donation_url.clone();
    if !models::is_safe_donate_url(&url) {
        return Err(error::AppError::Msg("Blocked donation URL".into()));
    }
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| error::AppError::Msg(format!("open url: {e}")))?;
    log_file::append("ui: opened donation link");
    Ok(())
}

#[tauri::command]
fn append_log(message: String) {
    let msg = crate::privacy::redact_log_message(&message);
    log_file::append(&msg);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log_file::append("boot: Smiley v8 starting");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = App::boot().map_err(|e| {
                Box::new(std::io::Error::other(e.to_string())) as Box<dyn std::error::Error>
            })?;

            if state.config.lock().auto_connect {
                let st = state.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(500));
                    let _ = st.connect();
                });
            }

            // Auto-rotate
            {
                let st = state.clone();
                std::thread::spawn(move || {
                    let mut elapsed = 0u64;
                    loop {
                        std::thread::sleep(Duration::from_secs(5));
                        let (enabled, every) = {
                            let cfg = st.config.lock();
                            (cfg.rotate_enabled, cfg.rotate_seconds.max(30) as u64)
                        };
                        if !enabled {
                            elapsed = 0;
                            continue;
                        }
                        elapsed += 5;
                        if elapsed >= every {
                            elapsed = 0;
                            let _ = st.rotate_tick();
                        }
                    }
                });
            }

            // Live gaming + music — off UI thread, rate-limited
            {
                let st = state.clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(Duration::from_secs(6));
                    let _ = st.live_tick();
                });
            }

            app.manage(state);

            let show = MenuItem::with_id(app, "show", "Show Smiley", true, None::<&str>)?;
            let donate = MenuItem::with_id(app, "donate", "Donate (PayPal)", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &donate, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Smiley v8")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = app.emit("wallpaper-resume", ());
                        }
                    }
                    "donate" => {
                        if let Some(st) = app.try_state::<Arc<App>>() {
                            let url = st.config.lock().donation_url.clone();
                            if models::is_safe_donate_url(&url) {
                                let _ = app.opener().open_url(url, None::<&str>);
                            }
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = tray.app_handle().emit("wallpaper-resume", ());
                        }
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                if let Some(st) = handle.try_state::<Arc<App>>() {
                    if st.config.lock().launch_minimized && st.config.lock().minimize_to_tray {
                        let _ = window.hide();
                        let _ = handle.emit("wallpaper-pause", ());
                    }
                }
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        if let Some(st) = handle.try_state::<Arc<App>>() {
                            if st.config.lock().minimize_to_tray {
                                api.prevent_close();
                                if let Some(w) = handle.get_webview_window("main") {
                                    let _ = w.hide();
                                }
                                let _ = handle.emit("wallpaper-pause", ());
                                log_file::append("window: minimized to tray");
                            }
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            connect,
            set_activity,
            clear_activity,
            set_paused,
            set_idle,
            rotate_once,
            get_status,
            save_config,
            reset_config,
            toggle_favorite,
            add_custom,
            remove_custom,
            probe_game,
            get_match_board,
            open_donation_url,
            append_log,
        ])
        .run(tauri::generate_context!())
        .expect("Smiley v8 failed to start");
}
