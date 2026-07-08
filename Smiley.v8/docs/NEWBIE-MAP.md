# Smiley v8 — newbie map

```
Smiley.v8/
├── index.html          ← window shell
├── src/
│   ├── main.ts         ← boots the app
│   ├── ui/             ← TypeScript app logic (easy to read)
│   │   ├── app.ts      ← ALL button clicks (data-act bus)
│   │   ├── api.ts      ← calls into Rust
│   │   ├── settings.ts ← settings form
│   │   └── types.ts    ← shared shapes
│   ├── skins/          ← 4 UIs (Studio / Arcade / Terminal / Zen)
│   └── assets/         ← icons
└── src-tauri/
    └── src/            ← Rust backend
        ├── lib.rs      ← Tauri commands + tray
        ├── app.rs      ← presence orchestration
        ├── discord.rs  ← Discord IPC worker thread
        ├── activities.rs
        ├── gaming.rs   ← light game probe (safe, timed)
        ├── config.rs   ← config + client id
        ├── log_file.rs ← append-only log file
        └── models.rs   ← Config / Status / Snapshot
```

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
