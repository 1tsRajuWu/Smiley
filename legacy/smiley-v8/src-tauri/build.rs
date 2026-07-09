fn main() {
    // Bake Discord client ID into release binaries — Finder launches with cwd "/" so
    // runtime paths to src-tauri/discord.app.json never resolve on end-user machines.
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
    let discord_path = std::path::Path::new(&manifest_dir).join("discord.app.json");
    if discord_path.is_file() {
        if let Ok(raw) = std::fs::read_to_string(&discord_path) {
            if let Ok(id) = parse_client_id(&raw) {
                println!("cargo:rustc-env=SMILEY_DISCORD_CLIENT_ID={id}");
            }
        }
    }
    tauri_build::build()
}

fn parse_client_id(raw: &str) -> Result<String, ()> {
    let v: serde_json::Value = serde_json::from_str(raw).map_err(|_| ())?;
    let id = v
        .get("clientId")
        .and_then(|x| x.as_str())
        .ok_or(())?;
    if id.chars().all(|c| c.is_ascii_digit()) && id.len() >= 17 {
        Ok(id.to_string())
    } else {
        Err(())
    }
}
