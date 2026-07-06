# `electron/` — Desktop backend helpers

Smiley’s **main process** entry point is still **`main.js` at the repo root** (required by `package.json` → `"main": "main.js"`). This folder holds backend modules that `main.js` loads.

| File | Purpose |
|------|---------|
| `install-registry.js` | Re-exports `src/install-registry.js` — default-on install/usage tracking (Supabase) |
| `now-playing.js` | System media detection (Spotify, Apple Music, YouTube Music, …) |
| `music-sync.js` | Keeps Discord presence in sync while **Listening to music** is active |

## Reading `main.js` (≈3,300 lines)

Open root **`main.js`** and use the table of contents at the top. Sections are labeled with `// ─── Section name ───` comments.

| Section (search in main.js) | What it does |
|-----------------------------|--------------|
| Constants | App name, paths, hotkey, version |
| Encryption | AES-256-GCM for saved config |
| Config | Load/save `config.json` in user data folder |
| State | `mainWindow`, `tray`, `rpcClient`, etc. |
| Window State | Remember size/position between launches |
| Tray Icons | Menu bar / system tray images |
| Window | Create the Smiley browser window |
| Tray | Tray menu, quick activity picks |
| Discord RPC | Connect to Discord, set Rich Presence |
| Install registry | Calls `src/install-registry.js` (default-on; opt-out in Settings) |
| Auto Updater | Download & install new versions |
| Custom Wallpapers / Animations / Activities | User-uploaded files on disk |
| Storage & cache cleanup | Clear Chromium cache, disk usage |
| IPC | `ipcMain.handle(...)` — pairs with `preload.js` |
| App Lifecycle | `app.whenReady()`, quit handlers |

## How UI talks to backend

```
src/renderer.js  →  window.smiley.*  →  preload.js  →  main.js (IPC)
```

Every new `window.smiley.foo()` in `preload.js` needs a matching `ipcMain.handle('foo', ...)` in `main.js`.

## More reading

[../PROJECT-STRUCTURE.md](../PROJECT-STRUCTURE.md) · [../docs/CODE-TOUR.md](../docs/CODE-TOUR.md)
