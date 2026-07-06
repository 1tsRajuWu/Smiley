# Smiley — Project structure (newbie guide)

**New to the repo?** Start here before opening random files.

| Doc | Best for |
|-----|----------|
| **[docs/CODE-TOUR.md](docs/CODE-TOUR.md)** | Absolute beginners — what Electron is, step-by-step flow |
| **This file** | Folder map and “which file do I edit?” |
| [src/README.md](src/README.md) | UI folder (`src/`) |
| [electron/README.md](electron/README.md) | Backend helpers + `main.js` section index |

> **Quick link from README:** [README.md](README.md) is for users downloading the app. **This file** is for people reading or changing the code.

---

## Start here

| If you want to… | Open this first |
|-----------------|-----------------|
| Understand the whole app | [docs/CODE-TOUR.md](docs/CODE-TOUR.md), then `package.json` |
| Change the UI (buttons, layout, themes) | `src/index.html` → `src/renderer.js` → `src/styles-v2.css` |
| Change Discord connection / tray / updates | `main.js` (see [electron/README.md](electron/README.md)) |
| Add or edit activity presets | `src/data/activities.js` |
| Change GIF sources / image URLs | `src/data/discord-images.js` |
| Build installers | `package.json` scripts + `build/` + `.github/workflows/release.yml` |
| Run locally | [For developers](README.md#for-developers) in README |

**Run the desktop app locally:**

```bash
npm install
cp discord.app.example.json discord.app.json   # paste your Discord Client ID
npm start
```

---

## Folder tree

```
Project Smiley/
├── README.md                  # User-facing: download, features, quick start
├── PROJECT-STRUCTURE.md       # ← You are here — code map for humans
├── docs/
│   └── CODE-TOUR.md           # Beginner walkthrough (start here if new to code)
├── package.json               # App version, npm scripts, electron-builder config
│
├── main.js                    # Electron MAIN process (Node + Discord RPC)
├── preload.js                 # Safe bridge: window.smiley ↔ IPC
│
├── electron/                  # Backend modules loaded by main.js
│   ├── README.md
│   └── install-registry.js    # Optional anonymous install stats
│
├── config.example.json        # Example user settings (theme, window size, etc.)
├── discord.app.example.json   # Template: Discord Application Client ID
├── discord.app.json           # Your real Client ID (gitignored — create locally)
├── manifest.json              # PWA-style metadata (icons, name)
│
├── src/                       # RENDERER — everything the user sees
│   ├── README.md
│   ├── index.html
│   ├── renderer.js            # UI logic (search for // ─── sections ───)
│   ├── activities.js          # Re-export → data/activities.js
│   ├── discord-images.js      # Re-export → data/discord-images.js
│   ├── data/                  # ← Edit activities & GIF logic here
│   │   ├── activities.js
│   │   ├── discord-images.js
│   │   └── README.md
│   ├── styles-v2.css          # Active UI theme
│   ├── styles.css / styles-v1.css
│   └── assets/                # Logos, icons, UPI QR
│
├── build/                     # Icons, Mac entitlements, license RTF for installers
├── scripts/                   # Icons, Mac signing, native builds, README links
├── docs/                      # Developer docs + docs/site/ (GitHub Pages)
├── .github/                   # CI (release, Pages, Android), issue templates
│
├── mobile/                    # Android/iOS Capacitor app (separate from Electron)
├── Smiley.Native/             # Optional native (.NET) build — README-NATIVE.md
│
├── LICENSE, ToS.md, PRIVACY.md, LEGAL.md
├── CONTRIBUTING.md, INSTALL-MAC.md, …
│
├── dist/                      # ⚠️ Build output — do not edit
├── dist-native/               # ⚠️ Native build output — do not edit
└── node_modules/              # ⚠️ Dependencies — do not edit
```

**Why `main.js` and `preload.js` stay at the root:** `package.json` points `"main": "main.js"` and electron-builder packs those exact paths.

**Why config JSON stays at the root:** `main.js`, CI, and electron-builder `files` list expect `discord.app.json` and `config.example.json` here.

---

## Core files

| File | What it does | When you edit it |
|------|----------------|------------------|
| `package.json` | Version, dependencies, `npm run` scripts, packaging | New dependency, version bump, build settings |
| `main.js` | Window, tray, Discord RPC, auto-update, IPC, config on disk | Backend behavior (see section TOC at top of file) |
| `preload.js` | Exposes `window.smiley.*` to the UI | New UI ↔ main feature: add method here + handler in `main.js` |
| `src/index.html` | App shell: header, activity grid, settings modal | Layout, new panels |
| `src/renderer.js` | UI logic: clicks, search, settings | Most visible feature work |
| `src/data/activities.js` | Activity categories and presets | New default activities |
| `src/data/discord-images.js` | GIF URLs, API fallbacks, image cache | Changing animations or providers |
| `src/styles-v2.css` | Active UI theme | Colors, spacing, layout |
| `electron/install-registry.js` | Opt-in anonymous install counter | Registry / privacy behavior |
| `config.example.json` | Documented shape of user settings | New persisted preference |
| `build/icon.*` | App icons for installers and tray | Rebrand (`npm run icons`) |

User settings at runtime live in the OS app data folder (see `main.js` → `getUserDataPath`).

---

## How data flows (desktop app)

```
  User clicks activity in the window
           │
           ▼
  ┌─────────────────────┐
  │  src/renderer.js    │  UI: search, favorites, preview
  │  src/index.html     │
  └──────────┬──────────┘
             │  window.smiley.setActivity(...)
             ▼
  ┌─────────────────────┐
  │  preload.js         │  contextBridge → ipcRenderer.invoke(...)
  └──────────┬──────────┘
             │  IPC channel
             ▼
  ┌─────────────────────┐
  │  main.js            │  ipcMain handlers, tray, updates
  │  discord-rpc        │  Rich Presence → Discord desktop
  └──────────┬──────────┘
             ▼
       Discord shows your status + GIF
```

**Data modules:** `src/data/activities.js` = *what* you can pick; `src/data/discord-images.js` = *which image* to send.

---

## Other folders (short)

| Folder | Purpose |
|--------|---------|
| `scripts/` | `generate-icons.sh`, `build-native-*.sh`, Mac `afterSign`, README download links |
| `docs/` | `CODE-TOUR.md`, `RELEASING.md`, `NOTARIZATION.md`, `docs/site/` for Pages |
| `mobile/` | Capacitor app; sync from `src/data/` via `npm run build:mobile:www` |
| `Smiley.Native/` | Lightweight native desktop — not the main Electron app |
| `.github/` | Release CI, Pages, Android |

---

## What NOT to touch

| Path | Why |
|------|-----|
| `dist/`, `dist-native/` | Generated — run `npm run build` |
| `node_modules/` | Run `npm install` |
| `discord.app.json` | Secret Client ID — never commit |
| `mobile/android/app/build/`, `.gradle/` | Android build cache |

---

## Common tasks

**Add a new built-in activity**  
`src/data/activities.js` → optional GIF in `src/data/discord-images.js` → `npm start`.

**Add a settings toggle**  
`config.example.json` → `main.js` → `preload.js` → `src/renderer.js` + `src/index.html`.

**Ship a release**  
Bump `package.json` version → tag `vX.Y.Z` → see `docs/RELEASING.md`.

---

## More reading

- [docs/CODE-TOUR.md](docs/CODE-TOUR.md) — beginner-friendly code walkthrough  
- [src/README.md](src/README.md) · [src/data/README.md](src/data/README.md)  
- [electron/README.md](electron/README.md)  
- [README-NATIVE.md](README-NATIVE.md) — native (.NET) variant
