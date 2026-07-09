# `electron/` — Desktop backend helpers

Smiley’s **main process** entry point is still **`main.js` at the repo root** (required by `package.json` → `"main": "main.js"`). This folder holds backend modules that `main.js` loads.

| File | Purpose |
|------|---------|
| `security.js` | AES-256-GCM encryption — local data at rest + passphrase E2EE exports |
| `install-registry.js` | Mandatory install/usage telemetry (Supabase over HTTPS) |
| `now-playing.js` | System media detection — **macOS: mediaremote-adapter stream (instant)**; fallback JXA poll |
| `mac-mediaremote.js` | macOS event stream via `mediaremote-adapter` (Music Presence approach) |
| `mediaremote-adapter/` | Bundled Perl adapter + framework (BSD-3, [ungive/mediaremote-adapter](https://github.com/ungive/mediaremote-adapter)) |
| `now-playing-mac.jxa.js` | macOS JXA script — reads system Now Playing via MediaRemote (15.4+) |
| `music-sync.js` | Keeps Discord presence in sync while **Listening to music** is active |
| `live-ui-patch.js` | Silent signed UI overlays (`src/` only) via GitHub Pages — soft reload, no installer |

## Reading `main.js` (≈3,300 lines)

Open root **`main.js`** and use the table of contents at the top. Sections are labeled with `// ─── Section name ───` comments.

| Section (search in main.js) | What it does |
|-----------------------------|--------------|
| Constants | App name, paths, hotkey, version |
| Encryption | AES-256-GCM via `electron/security.js` — config, window state, install ID, E2EE exports |
| Config | Load/save `config.json` in user data folder |
| State | `mainWindow`, `tray`, `rpcClient`, etc. |
| Window State | Remember size/position between launches |
| Tray Icons | Menu bar / system tray images |
| Window | Create the Smiley browser window |
| Tray | Tray menu, quick activity picks |
| Discord RPC | Connect to Discord, set Rich Presence |
| Install registry | Calls `electron/install-registry.js` (mandatory on packaged builds) |
| Auto Updater | Download & install new versions |
| Live UI patches | Signed `src/` overlays from GitHub Pages (see `live-ui-patch.js`) |
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
