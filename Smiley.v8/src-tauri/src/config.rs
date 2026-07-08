use crate::error::{AppError, AppResult};
use crate::models::Config;
use std::fs;
use std::path::PathBuf;

pub fn data_dir() -> AppResult<PathBuf> {
    let base = dirs::data_dir().ok_or_else(|| AppError::Msg("No data dir".into()))?;
    let dir = base.join("Smiley-v8");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn path() -> AppResult<PathBuf> {
    Ok(data_dir()?.join("config.json"))
}

pub fn load() -> Config {
    match path().and_then(|p| {
        if !p.exists() {
            return Ok(Config::default());
        }
        let raw = fs::read_to_string(&p)?;
        // Reject empty / truncated writes from a crashed save
        if raw.trim().is_empty() {
            return Err(AppError::Msg("config.json empty".into()));
        }
        let c: Config = serde_json::from_str(&raw).map_err(|e| {
            AppError::Msg(format!("config parse: {e}"))
        })?;
        Ok(c.sanitize())
    }) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[smiley] config load failed ({e}) — trying backup / defaults");
            // Attempt .bak if present
            if let Ok(p) = path() {
                let bak = p.with_extension("json.bak");
                if let Ok(raw) = fs::read_to_string(&bak) {
                    if let Ok(c) = serde_json::from_str::<Config>(&raw) {
                        let c = c.sanitize();
                        let _ = save(&c);
                        return c;
                    }
                }
            }
            Config::default()
        }
    }
}

pub fn save(cfg: &Config) -> AppResult<()> {
    let p = path()?;
    // Keep one-file backup of previous good config
    if p.exists() {
        let bak = p.with_extension("json.bak");
        let _ = fs::copy(&p, &bak);
    }
    let tmp = p.with_extension("tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(cfg)?)?;
    fs::rename(tmp, p)?;
    Ok(())
}

pub fn discord_client_id() -> AppResult<String> {
    // Release builds embed the ID at compile time (see build.rs).
    if let Some(id) = option_env!("SMILEY_DISCORD_CLIENT_ID") {
        if id.chars().all(|c| c.is_ascii_digit()) && id.len() >= 17 {
            return Ok(id.to_string());
        }
    }

    let candidates = [
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("discord.app.json"),
        PathBuf::from("discord.app.json"),
        data_dir()?.join("discord.app.json"),
    ];
    for p in candidates {
        if let Ok(raw) = fs::read_to_string(&p) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(id) = v.get("clientId").and_then(|x| x.as_str()) {
                    if id.chars().all(|c| c.is_ascii_digit()) && id.len() >= 17 {
                        return Ok(id.into());
                    }
                }
            }
        }
    }
    Err(AppError::Msg(
        "Missing Discord clientId — put it in src-tauri/discord.app.json".into(),
    ))
}
