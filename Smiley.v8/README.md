# Smiley v8

Native **Rust + Tauri 2** Discord Rich Presence.

Read **`docs/NEWBIE-MAP.md`** first if you are new.

## What shipped in this platform bump

- PayPal **Donate** (UI + tray) — same tip link as Electron v7
- Discord **Download** button on presence (optional toggle)
- **Animated wallpaper** that **pauses when the window is in the tray / hidden**
- Append-only **log file** under app data (`logs/smiley.log`) — no bot tokens
- Optional **light gaming probe** (process list, hard timeout) — full live gaming still on Electron until parity
- 4 skins: Studio / Arcade / Terminal / Zen

## Run

```bash
cd Smiley.v8
npm install
npm run tauri dev
```

Discord **desktop** must be open. Client ID: copy `discord.app.example.json` → `src-tauri/discord.app.json`.

## Not a Discord bot

Smiley talks to Discord via local Rich Presence IPC + an Application Client ID.
There is no bot token and no PayPal “connect” to Discord.
