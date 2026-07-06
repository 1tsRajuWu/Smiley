# Smiley — Project structure (newbie guide)

**New to the repo?** Start here before opening random files. This map explains what lives where and what you should (and should not) touch.

> **Quick link from README:** [README.md](README.md) is for users downloading the app. **This file** is for people reading or changing the code.

---

## Start here

| If you want to… | Open this first |
|-----------------|-----------------|
| Understand the whole app | This file, then `package.json` |
| Change the UI (buttons, layout, themes) | `src/index.html` → `src/renderer.js` → `src/styles-v2.css` |
| Change Discord connection / tray / updates | `main.js` (Electron main process) |
| Add or edit activity presets | `src/activities.js` |
| Change GIF sources / image URLs | `src/discord-images.js` |
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
├── PROJECT-STRUCTURE.md         # ← You are here — code map for humans
├── package.json               # App version, npm scripts, electron-builder config
├── package-lock.json
│
├── main.js                    # Electron MAIN process (Node + Discord RPC)
├── preload.js                 # Safe bridge between UI and main process
│
├── config.example.json        # Example user settings (theme, window size, etc.)
├── discord.app.example.json   # Template: Discord Application Client ID (for builds)
├── discord.app.json           # Your real Client ID (gitignored — create locally)
├── manifest.json              # PWA-style metadata (icons, name)
│
├── src/                       # RENDERER — everything the user sees (see src/README.md)
│   ├── index.html
│   ├── renderer.js
│   ├── activities.js
│   ├── discord-images.js
│   ├── styles.css / styles-v1.css / styles-v2.css
│   └── assets/                # Logos, icons, UPI QR, in-app images
│
├── build/                     # Icons, Mac entitlements, license RTF for installers
├── scripts/                   # Icon generation, Mac signing, README download links
├── docs/                      # Developer docs + docs/site/ (GitHub Pages download page)
├── .github/                   # CI (release, Pages, Android), issue templates
│
├── mobile/                    # Android/iOS Capacitor app (separate from Electron)
├── Smiley.Native/             # Optional native (.NET) build — see README-NATIVE.md
│
├── LICENSE, ToS.md, PRIVACY.md, LEGAL.md   # Legal (bundled in installers; keep at root)
├── CONTRIBUTING.md, INSTALL-MAC.md, …       # Contributor / install notes
│
├── dist/                      # ⚠️ Build output — do not edit
├── dist-native/               # ⚠️ Native build output — do not edit
└── node_modules/              # ⚠️ Dependencies — do not edit
```

**Why `main.js` and `preload.js` stay at the root:** `package.json` points `"main": "main.js"` and electron-builder packs those exact paths. Moving them would break builds unless every reference is updated.

**Why config JSON stays at the root:** Same reason — `main.js`, CI, and `electron-builder` `files` list expect `discord.app.json` and `config.example.json` here.

---

## Core files

| File | What it does | When you edit it |
|------|----------------|------------------|
| `package.json` | Version, dependencies, `npm run` scripts, electron-builder packaging | New dependency, version bump, build settings |
| `main.js` | Window, tray, Discord RPC, auto-update, IPC handlers, user config on disk | Backend behavior, Discord connection, file dialogs, shortcuts |
| `preload.js` | Exposes `window.smiley.*` API to the UI (no direct Node in renderer) | New UI ↔ main features need a new IPC method here + in `main.js` |
| `src/index.html` | App shell: header, activity grid, settings modal markup | Layout, new panels, accessibility |
| `src/renderer.js` | UI logic: clicks, search, settings, calls `window.smiley` | Most feature work in the visible app |
| `src/activities.js` | Activity categories and presets (Gaming, Coding, etc.) | New default activities or categories |
| `src/discord-images.js` | GIF URLs, Tenor/Giphy/nekos fallbacks, image cache | Changing animations or image providers |
| `src/styles-v2.css` | Active UI theme (v2) | Colors, spacing, responsive layout |
| `src/styles.css` / `styles-v1.css` | Older themes (legacy / fallback) | Only if supporting old UI version |
| `config.example.json` | Documented shape of user settings | New persisted user preference |
| `discord.app.example.json` | Template for Discord app Client ID | Documenting setup for contributors |
| `build/icon.*` | App icons for OS installers and tray | Rebrand / new icon (`npm run icons`) |
| `.github/workflows/release.yml` | Tag → build Mac/Win/Linux → GitHub Releases | Release pipeline changes |

User settings at runtime are **not** in the repo. They live in the OS app data folder (see `main.js` → `getUserDataPath`).

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
  │  discord-rpc        │  Rich Presence → Discord desktop client
  └──────────┬──────────┘
             │
             ▼
       Discord shows your status + large image (GIF key/URL)
```

**Supporting modules:** `src/activities.js` defines *what* you can pick; `src/discord-images.js` resolves *which image* to send for each activity.

---

## Other folders (short)

| Folder | Purpose |
|--------|---------|
| `scripts/` | `generate-icons.sh`, Mac `afterSign`, `update-readme-downloads.sh`, GIF validation |
| `docs/` | `RELEASING.md`, `NOTARIZATION.md`, `MINIMUM-REQUIREMENTS.md`, `docs/site/` for Pages |
| `mobile/` | Capacitor wrapper; `mobile/www/` is synced from desktop `src/` via `npm run build:mobile:www` |
| `Smiley.Native/` | Experimental native desktop build — not the main Electron app |
| `.github/` | `workflows/release.yml` (installers), `pages.yml` (download site), Android CI |

---

## What NOT to touch

| Path | Why |
|------|-----|
| `dist/`, `dist-native/` | Generated installers — run `npm run build` instead |
| `node_modules/`, `mobile/node_modules/` | Run `npm install` / `npm ci` |
| `discord.app.json` | Secret Client ID — never commit (listed in `.gitignore`) |
| `config.json`, `config.secure` | Local user data paths (gitignored) |
| `mobile/android/app/build/`, `.gradle/` | Android build cache |

---

## Common tasks

**Add a new built-in activity**  
Edit `src/activities.js` → optional GIF in `src/discord-images.js` → test with `npm start`.

**Add a settings toggle**  
`config.example.json` (docs) → save/load in `main.js` → expose via `preload.js` → UI in `src/renderer.js` + `src/index.html`.

**Ship a release**  
Bump version in `package.json` → tag `vX.Y.Z` → CI in `.github/workflows/release.yml` builds and publishes. See `docs/RELEASING.md`.

**Mobile**  
See `mobile/README.md`. Desktop `src/` files are copied into `mobile/www/` by the build script; don’t hand-edit generated copies in `mobile/www/` for long-term changes.

---

## More reading

- [src/README.md](src/README.md) — renderer files in detail  
- [docs/RELEASING.md](docs/RELEASING.md) — release checklist  
- [README-NATIVE.md](README-NATIVE.md) — native (.NET) variant  
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
