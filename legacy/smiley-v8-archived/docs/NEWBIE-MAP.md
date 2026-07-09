# Smiley v8 — newbie map

Plain-English guide to the **shipping** desktop app. Parent repo index: [`../../STRUCTURE.md`](../../STRUCTURE.md).

## Folder tree

```
Smiley.v8/
├── package.json              ← npm scripts, version (matches Cargo.toml)
├── index.html                ← window shell (loads main.ts)
├── discord.app.example.json  ← copy → src-tauri/discord.app.json (Client ID)
│
├── src/                      ← TypeScript UI (Vite bundles this)
│   ├── main.ts               ← boots AppController, shows window
│   ├── ui/
│   │   ├── app.ts            ← ALL button clicks (data-act bus), paints grid
│   │   ├── api.ts            ← invoke() wrappers into Rust commands
│   │   ├── settings.ts       ← settings dialog HTML + read/write form
│   │   ├── types.ts          ← Config, Snapshot, activity list helpers
│   │   └── updater.ts        ← in-app update check + install flow
│   ├── skins/
│   │   ├── markup.ts         ← HTML for Studio / Arcade / Terminal / Zen
│   │   └── all.css           ← shared + per-skin styles
│   └── assets/               ← tray icons, logos
│
└── src-tauri/                ← Rust backend (Tauri)
    ├── tauri.conf.json       ← app id, bundle, updater, window size
    ├── capabilities/         ← Tauri v2 permission scopes
    ├── build.rs              ← bundles discord.app.json, mediaremote adapter
    └── src/
        ├── main.rs           ← calls lib::run()
        ├── lib.rs            ← Tauri commands, tray menu, background threads
        ├── app.rs            ← presence orchestration + refresh_live_presence()
        ├── discord.rs        ← Discord IPC worker thread (never blocks UI)
        ├── activities.rs     ← built-in activity presets + categories
        ├── riot.rs           ← Valorant/LoL via Riot Client lockfile (127.0.0.1)
        ├── valorant_catalog.rs ← map/agent/queue name tables
        ├── valorant_assets.rs  ← agent portrait URLs for Discord small_image
        ├── privacy.rs        ← Valorant detail levels + log redaction
        ├── music.rs          ← now-playing probe + run_music_presence_loop()
        ├── music_mediaremote.rs ← macOS instant media stream (adapter)
        ├── music_linux.rs    ← Linux MPRIS probe
        ├── coding.rs         ← foreground editor detection (macOS)
        ├── gaming.rs         ← optional process-list game probe
        ├── config.rs         ← load/save config.json + Discord Client ID
        ├── models.rs         ← Config / Status / Snapshot + GIF URL sanitize
        ├── updates.rs        ← GitHub release update check
        ├── log_file.rs       ← append-only ~/.smiley/smiley.log
        └── error.rs          ← AppError for invoke boundaries
```

### Why `riot.rs` is not named `valorant_live.rs`

The module talks to the **Riot Client** lockfile API (Valorant + League). Renaming the file would touch every `mod`/`use` and CI path for little gain — the module doc at the top of `riot.rs` explains what it does.

## Hot-path names (recent clarity pass)

| Old / cryptic | New / plain | Where |
|---------------|-------------|-------|
| `live_tick()` | `refresh_live_presence()` | `app.rs` — background Valorant/game poll |
| `live_tick_interval()` | `live_presence_poll_interval()` | `app.rs` |
| `run_app_sync_loop()` | `run_music_presence_loop()` | `music.rs` |
| `cat`, `gen`, `busy` | `activeCategory`, `pickGeneration`, `actionInProgress` | `ui/app.ts` |
| `data-act="cat"` | `data-act="pick-category"` | category tab buttons |

## Live features (safe — no malware)

| Feature | Module | Notes |
|--------|--------|--------|
| Custom GIF activities | `activities.rs`, `models.rs` | Tenor HTTPS URLs; sanitize before Discord |
| Valorant / LoL | `riot.rs`, `privacy.rs` | Lockfile → 127.0.0.1 only; Full vs Minimal in Settings |
| Music | `music.rs`, `music_mediaremote.rs` | While **Listening to music** activity is active |
| Coding | `coding.rs` | While **Coding** activity is active |
| Other games | `gaming.rs` | Optional process probe (Settings → window title games) |
| Animated wallpaper | `skins/all.css` | Pauses on tray hide / reduce-motion |
| Donate | `lib.rs` `open_donation_url` | Opens from Rust allowlist only |
| Updates | `updates.rs`, `ui/updater.ts` | Signed `latest.json` when CI secret present |

## Run

```bash
cd Smiley.v8
npm install
npm run tauri dev
```

Needs **Discord desktop** open. Client ID: `src-tauri/discord.app.json` (copy from `discord.app.example.json`).

## Skins

Open Settings (`⌘,`) → **Look** → Studio / Arcade / Terminal / Zen → **Save**.

Settings → **Discord**: toggle live Valorant, music, static tiles (GIFs on hover).

## Build / verify

```bash
cd Smiley.v8
npm run build          # TypeScript + Vite
cd src-tauri && cargo check
npm run desktop        # full Tauri release build (slow)
```

Privacy details: [`PRIVACY-SECURITY.md`](PRIVACY-SECURITY.md).
