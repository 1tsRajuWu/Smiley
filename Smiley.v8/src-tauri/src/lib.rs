mod activities;
mod app;
mod coding;
mod config;
mod discord;
mod error;
mod gaming;
mod log_file;
mod models;
mod music;
#[cfg(target_os = "linux")]
mod music_linux;
#[cfg(target_os = "macos")]
mod music_mediaremote;
mod privacy;
mod riot;
mod updates;
mod valorant_assets;
mod valorant_catalog;

use app::App;
use models::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

static APP_QUITTING: AtomicBool = AtomicBool::new(false);

fn should_close_to_tray(app: &tauri::AppHandle) -> bool {
    app.try_state::<Arc<App>>()
        .map(|st| st.config.lock().minimize_to_tray)
        .unwrap_or(true)
}

fn hide_main_to_tray(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    let _ = app.emit("wallpaper-pause", ());
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    log_file::append("window: minimized to tray");
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
        let _ = app.emit("wallpaper-resume", ());
        #[cfg(target_os = "macos")]
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }
}

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
fn set_paused(state: tauri::State<'_, Arc<App>>, paused: bool) -> Result<Status, error::AppError> {
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
fn probe_game(
    state: tauri::State<'_, Arc<App>>,
) -> Result<Option<gaming::GameHit>, error::AppError> {
    if !state.config.lock().gaming_probe && !state.config.lock().live_gaming {
        return Ok(None);
    }
    gaming::probe_foreground_game()
}

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

#[tauri::command]
fn check_for_updates() -> Result<updates::UpdateCheck, error::AppError> {
    log_file::append("update: check requested");
    updates::check_for_updates()
}

#[tauri::command]
fn open_release_url(app: tauri::AppHandle, url: Option<String>) -> Result<(), error::AppError> {
    let target = url
        .filter(|u| updates::is_safe_release_url(u))
        .unwrap_or_else(|| updates::GITHUB_RELEASES_PAGE.to_string());
    app.opener()
        .open_url(&target, None::<&str>)
        .map_err(|e| error::AppError::Msg(format!("open url: {e}")))?;
    log_file::append("update: opened release page");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log_file::append("boot: Smiley v8 starting");
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if APP_QUITTING.load(Ordering::SeqCst) {
                    return;
                }
                let app = window.app_handle();
                if should_close_to_tray(&app) {
                    api.prevent_close();
                    hide_main_to_tray(&app);
                }
            }
        })
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

            // Live gaming — off UI thread, adaptive cadence for active Valorant.
            {
                let st = state.clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(st.live_tick_interval());
                    let _ = st.live_tick();
                });
            }

            // Music now-playing — MediaRemote stream (instant) when listening; idle sleep otherwise
            {
                let st = state.clone();
                let resource_dir = app.path().resource_dir().ok();
                std::thread::spawn(move || {
                    music::run_app_sync_loop(st, resource_dir);
                });
            }

            // Live coding — foreground editor poll when coding activity is active (3s)
            {
                let st = state.clone();
                std::thread::spawn(move || loop {
                    let active = st.coding_live_active();
                    std::thread::sleep(if active {
                        Duration::from_secs(3)
                    } else {
                        Duration::from_secs(8)
                    });
                    if active {
                        let _ = st.coding_tick();
                    }
                });
            }

            app.manage(state);

            let show = MenuItem::with_id(app, "show", "Show Smiley", true, None::<&str>)?;
            let updates =
                MenuItem::with_id(app, "updates", "Check for Updates", true, None::<&str>)?;
            let donate = MenuItem::with_id(app, "donate", "Donate (PayPal)", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &updates, &donate, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Smiley v8")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "updates" => {
                        show_main_window(app);
                        let _ = app.emit("update-check-requested", ());
                    }
                    "donate" => {
                        if let Some(st) = app.try_state::<Arc<App>>() {
                            let url = st.config.lock().donation_url.clone();
                            if models::is_safe_donate_url(&url) {
                                let _ = app.opener().open_url(url, None::<&str>);
                            }
                        }
                    }
                    "quit" => {
                        APP_QUITTING.store(true, Ordering::SeqCst);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            if app.get_webview_window("main").is_some() {
                let handle = app.handle().clone();
                if let Some(st) = handle.try_state::<Arc<App>>() {
                    if st.config.lock().launch_minimized && st.config.lock().minimize_to_tray {
                        hide_main_to_tray(&handle);
                    }
                }
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
            open_donation_url,
            append_log,
            check_for_updates,
            open_release_url,
        ])
        .build(tauri::generate_context!())
        .expect("Smiley v8 failed to start")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                if APP_QUITTING.load(Ordering::SeqCst) {
                    return;
                }
                if should_close_to_tray(&app_handle) {
                    api.prevent_exit();
                }
            }
        });
}
