# Smiley code tour (for new programmers)

A plain-language walkthrough of how Smiley is built. No prior Electron experience required.

---

## What is Smiley?

A **desktop app** (Windows, Mac, Linux) that sets your **Discord Rich Presence** — the “Playing …” line on your profile — with an **animated anime GIF**.

---

## Big picture (3 layers)

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1 — What you SEE (src/)                          │
│  HTML + CSS + JavaScript in a browser window            │
└───────────────────────────┬─────────────────────────────┘
                            │ window.smiley.setActivity(...)
┌───────────────────────────▼─────────────────────────────┐
│  LAYER 2 — Bridge (preload.js)                            │
│  Safe API between UI and Node.js                          │
└───────────────────────────┬─────────────────────────────┘
                            │ IPC (inter-process messages)
┌───────────────────────────▼─────────────────────────────┐
│  LAYER 3 — Backend (main.js + electron/)                │
│  Discord connection, files, tray, updates                 │
└─────────────────────────────────────────────────────────┘
```

**Electron** = Chromium (shows the UI) + Node.js (does file/Discord work). Two processes: **main** and **renderer**.

---

## Start here (file checklist)

| Order | File | One sentence |
|-------|------|--------------|
| 1 | [PROJECT-STRUCTURE.md](../PROJECT-STRUCTURE.md) | Folder map |
| 2 | [package.json](../package.json) | Version, `npm start`, build scripts |
| 3 | [src/index.html](../src/index.html) | Page layout (buttons, grids, modals) |
| 4 | [src/renderer.js](../src/renderer.js) | What happens when you click things |
| 5 | [preload.js](../preload.js) | List of `window.smiley` methods |
| 6 | [main.js](../main.js) | Discord, tray, saving settings |
| 7 | [src/data/activities.js](../src/data/activities.js) | List of built-in activities |

---

## Folder guide

| Folder | Human description |
|--------|-------------------|
| **`src/`** | The app window: HTML, CSS, UI logic |
| **`src/data/`** | Activity lists + GIF URL logic |
| **`src/assets/`** | Pictures (icons, logos) |
| **`electron/`** | Extra backend modules used by `main.js` |
| **`build/`** | App icons and Mac signing files for installers |
| **`scripts/`** | Build helpers (icons, signing, README links) |
| **`docs/`** | Developer documentation |
| **`mobile/`** | Phone app (separate from desktop Electron) |
| **`Smiley.Native/`** | Lightweight non-Electron desktop build |

**Do not edit:** `node_modules/`, `dist/`, `dist-native/` — generated or downloaded.

---

## User clicks an activity — step by step

1. **`src/renderer.js`** — `selectActivity(id)` runs when you click a card.
2. It builds a payload (title, state, image URL) and calls `window.smiley.setActivity(...)`.
3. **`preload.js`** — forwards that to `ipcRenderer.invoke('set-activity', ...)`.
4. **`main.js`** — `ipcMain.handle('set-activity', ...)` receives it, talks to **discord-rpc**, Discord desktop updates your profile.
5. **`main.js`** sends status back; UI updates the “Connected” pill.

GIF URLs come from **`src/data/discord-images.js`** (APIs like nekos.best and Tenor).

---

## Common “I want to change …” tasks

### Change button colors or layout
→ `src/styles-v2.css` and `src/index.html`

### Add a new default activity (e.g. “Playing chess”)
→ `src/data/activities.js` — add an object inside a category’s `activities` array  
→ optional: `src/data/discord-images.js` for a custom GIF mapping  
→ `npm start` to test

### Add a settings toggle
1. `config.example.json` — document the new field  
2. `main.js` — load/save in config + `ipcMain.handle('get-config'/'save-config')`  
3. `preload.js` — expose to UI if needed  
4. `src/index.html` + `src/renderer.js` — checkbox and save handler

### Change the app icon
→ `build/icon.png` etc., then `npm run icons`

---

## `renderer.js` sections (search these comments)

| Comment in file | Topic |
|-----------------|--------|
| `DOM refs` | `document.querySelector` for each HTML element |
| `State` | Variables (selected activity, theme, etc.) |
| `Helpers` | Small utility functions |
| `Activity Grid` | Category tabs and activity cards |
| `Settings` | Settings modal |
| `Custom Activities` | User-created activities |
| `Update Status` | “New version available” banner |
| `Initialization` | `init()` — wires all click handlers on startup |

---

## Run locally

```bash
git clone https://github.com/1tsRajuWu/Smiley.git
cd Smiley
npm install
cp discord.app.example.json discord.app.json   # put your Discord Client ID inside
npm start
```

Discord **desktop** must be running. Use `npm run dev` for DevTools + live reload (UI edits refresh the window; main/`preload`/`electron` edits restart the app).

---

## Glossary

| Term | Meaning |
|------|---------|
| **Main process** | `main.js` — one per app, full Node.js access |
| **Renderer** | `src/*` — the window, like a web page |
| **IPC** | Messages between main and renderer |
| **Rich Presence** | Discord “Playing / Listening / …” status |
| **Preload** | Script that runs before the page, exposes safe APIs |

---

## More

- [src/README.md](../src/README.md) — renderer files  
- [electron/README.md](../electron/README.md) — backend modules & `main.js` index  
- [README.md](../README.md) — download & user docs
