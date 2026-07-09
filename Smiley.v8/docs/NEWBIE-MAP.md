# Smiley v8 — newbie map

```
Smiley.v8/
├── index.html          ← window shell
├── src/
│   ├── main.ts         ← boots the app
│   ├── ui/             ← TypeScript app logic (easy to read)
│   │   ├── app.ts      ← ALL button clicks (data-act bus)
│   │   ├── api.ts      ← calls into Rust (escaped HTML helpers)
│   │   ├── settings.ts ← settings form
│   │   └── types.ts    ← shared shapes
│   ├── skins/          ← 4 UIs (Studio / Arcade / Terminal / Zen)
│   └── assets/         ← icons
└── src-tauri/
    └── src/            ← Rust backend
        ├── lib.rs      ← Tauri commands + tray
        ├── app.rs      ← presence + live_tick orchestration
        ├── discord.rs  ← Discord IPC worker thread
        ├── activities.rs ← preset GIF vibes
        ├── riot.rs     ← Valorant/LoL via Riot lockfile (local only)
        ├── music.rs    ← Spotify / Apple Music (timed osascript)
        ├── gaming.rs   ← optional process probe (safe, timed)
        ├── config.rs   ← config + client id
        ├── log_file.rs ← append-only log file
        └── models.rs   ← Config / Status / Snapshot + GIF sanitize
```

## Live features (safe — no malware)

| Feature | How | Notes |
|--------|-----|--------|
| Custom GIF activities | Tenor HTTPS URLs | CSS + Rust sanitize; delete with × on tile |
| Valorant / Riot | `riot.rs` lockfile → 127.0.0.1 | Discord presence (map, agent, score) — **Discord tab** Full vs Minimal |
| Music | `music.rs` | While **Listening to music** is selected |
| Animated wallpaper | CSS | **Pauses** when tray / hidden / reduce-motion |
| Donate | PayPal | Opens from **Rust only** (no open-URL from webview) |

## Run

```bash
cd Smiley.v8
npm install
npm run tauri dev
```

Needs **Discord desktop** open. Client ID: `src-tauri/discord.app.json`
(copy from `discord.app.example.json`).

## Skins

Open Settings (`⌘,`) → **Look** → pick Studio / Arcade / Terminal / Zen → **Save**.

Settings → **Discord**: toggle live Valorant, music, static tiles (GIFs on hover).
