# Electron Smiley v7 (archived reference)

The **shipping** Electron app for Discord Rich Presence through **v7.9.x** lives at the
repository root (`main.js`, `electron/`, `src/`, `preload.js`).

This folder documents that stack so newcomers can find the “old platform” while
**Smiley.v8** (Tauri + Rust) becomes the next major desktop app.

## What to open

| Piece | Path (repo root) |
|-------|------------------|
| Main process | `../../main.js` |
| Preload bridge | `../../preload.js` |
| Renderer UI | `../../src/` |
| Native helpers (gaming, music, RPC helpers) | `../../electron/` |
| Config example | `../../config.example.json` |
| Discord Client ID template | `../../discord.app.example.json` |

## Frozen shipping revision

At the time Smiley v8 started shipping as the new platform, the latest Electron
release line on `main` was:

- **v7.9.24** — `685816f` (`Release v7.9.24: fix Steam Discord small_image 404 spinner`)

Do **not** delete the root Electron tree until official builds switch fully to v8
and users have a migration path.

## Features that stay on Electron until ported

- Live **gaming status** (`electron/now-gaming.js`, `electron/game-sync.js`, providers)
- Live music / coding probes
- Supabase install telemetry (`electron/install-registry.js`)
- Live-UI silent patches (`electron/live-ui-patch.js`)

Smiley v8 ports core presence + donation + a light gaming probe first.
