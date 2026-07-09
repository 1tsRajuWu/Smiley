# Smiley v12 — newbie map

Plain-English guide to the **shipping** desktop app. Parent repo index: [`../../STRUCTURE.md`](../../STRUCTURE.md).

## Folder tree

```
Smiley.v12/
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
    ├── build.rs              ← embeds discord.app.json at compile time
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
        ├── gaming.rs         ← optional process-list game probe (CS2, etc.)
        ├── config.rs         ← load/save config.json + Discord Client ID
        ├── models.rs         ← Config / Status / Snapshot + GIF URL sanitize
        ├── updates.rs        ← GitHub v12 release update check
        ├── log_file.rs       ← append-only ~/Library/.../Smiley/logs/smiley.log
        └── error.rs          ← AppError for invoke boundaries
```

## Live features (safe — no malware)

| Feature | Module | Notes |
|--------|--------|--------|
| Custom GIF activities | `activities.rs`, `models.rs` | Tenor HTTPS URLs; sanitize before Discord |
| Valorant / LoL | `riot.rs`, `privacy.rs` | Lockfile → 127.0.0.1 only; map, mode, self agent, score — **no roster board** |
| Music | `music.rs`, `music_mediaremote.rs` | While **Listening to music** activity is active |
| Coding | `coding.rs` | While **Coding** activity is active |
| Other games | `gaming.rs` | Optional process probe (Settings → window title games) |
| 4 skins | `skins/` | Studio, Arcade, Terminal, Zen |
| Animated wallpaper | `skins/all.css` | Pauses on tray hide / reduce-motion |
| Donate | `lib.rs` `open_donation_url` | Opens from Rust allowlist only |
| Updates | `updates.rs`, `ui/updater.ts` | Signed `latest.json` via CI |

## Run

```bash
cd Smiley.v12
npm install
cp discord.app.example.json src-tauri/discord.app.json
npm start
```

## Tests

```bash
cd Smiley.v12/src-tauri && cargo test
cd Smiley.v12 && npm run build
```

## What changed from v8

- Product name is **Smiley** (not “Smiley v8”).
- Version line is **12.x** — no more confusing v8.0.x patch spam.
- Ally/enemy roster UI removed; Valorant presence is map/mode/agent/score only.
- Clean `data-act` click bus in UI — one handler, no nested GIF click bugs.

See [`V12-SCOPE.md`](V12-SCOPE.md) for the full include/cut list.
