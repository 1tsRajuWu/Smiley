# Electron Smiley v7 (archived)

> **Archived:** Smiley **v8** (Tauri + Rust) is the current public desktop app. This folder is the complete Electron stack for contributors and forks — it is **not** promoted on the website or README.

The Electron app for Discord Rich Presence through **v7.9.x** lives entirely in this folder.

Old v7 installers remain on [GitHub Releases](https://github.com/1tsRajuWu/Smiley/releases) but are no longer linked from the public site.

## What to open

| Piece | Path |
|-------|------|
| Main process | `main.js` |
| Preload bridge | `preload.js` |
| Renderer UI | `src/` |
| Native helpers (gaming, music, RPC) | `electron/` |
| Build icons & entitlements | `build/` |
| v7 scripts (signing, live patch, checks) | `scripts/` |
| Capacitor mobile companion | `mobile/` |
| Config example | `config.example.json` |
| Discord Client ID template | `discord.app.example.json` |

## Run locally

```bash
cd legacy/electron-v7
npm install
cp discord.app.example.json discord.app.json
npm start
```

From repo root you can also run `npm start` (delegates here).

## Frozen shipping revision

At the time Smiley v8 started shipping as the new platform, the latest Electron release line on `main` was:

- **v7.9.24** — `685816f` (`Release v7.9.24: fix Steam Discord small_image 404 spinner`)

## Features that stay on Electron until ported

- Live **gaming status** (`electron/now-gaming.js`, `electron/game-sync.js`, providers)
- Live music / coding probes
- Supabase install telemetry (`electron/install-registry.js`)
- Live-UI silent patches (`electron/live-ui-patch.js`)

Smiley v8 ports core presence + donation + a light gaming probe first.

## Releases

Tag `v7.x.y` (not `v8.*`) — CI workflow `.github/workflows/release.yml` builds from this folder.
