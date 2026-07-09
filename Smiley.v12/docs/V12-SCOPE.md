# Smiley v12 — scope

What **ships** in 12.0.0 vs what was **cut** from the buggy v8 patch line.

## Included in V12

| Area | Details |
|------|---------|
| **Core** | Discord connect, GIF activities, favorites, custom activities, idle, rotate, quiet hours |
| **Tray** | Close → tray (macOS / Windows / Linux), launch minimized, wallpaper pause in tray |
| **Settings** | Persist to `~/Library/Application Support/Smiley/config.json` — idle GIF, skins, privacy toggles |
| **4 skins** | Studio, Arcade, Terminal, Zen — single delegated click handler |
| **Valorant** | Local Riot lockfile API: map, mode, self agent, score, logos on Discord — **no ally/enemy roster board** |
| **Other games** | CS2 and generic titles via optional process/window probe |
| **Music** | MediaRemote on macOS, MPRIS on Linux, timed probe elsewhere — while Listening activity is selected |
| **Coding** | Foreground editor detection while Coding activity is selected |
| **Privacy** | Full vs minimal Valorant detail; log redaction (`privacy.rs`) |
| **Updater** | `tauri-plugin-updater` + signed `latest.json` on `v12.*` GitHub releases |
| **Donate** | PayPal tip link from Rust allowlist only |

## Cut / not shipping

| Item | Reason |
|------|--------|
| Ally/enemy roster board | Removed per product decision; score-only on Discord |
| v8.0.x incremental patch churn | Replaced by v12 as the final product line |
| Half-finished GitHub-only updater fallback as default | Updater uses signed Tauri artifacts; GitHub link is manual fallback only |
| Nested button / GIF click bugs | Rebuilt UI with one `data-act` delegation bus |
| Competitor brand names in UI | Stripped from copy |
| Electron 250MB stack | Staying on Tauri + Rust for size and performance |
| v7 mobile companion | Remains in `legacy/electron-v7/mobile/` only |
| v7 live UI patch / Capacitor | Not ported to v12 |

## Parity notes (v7 reference only)

v7 Electron (`legacy/electron-v7/`) still has niche features not yet in v12. Forks can port from there. Priority for v12 was **stable core** over 100% v7 parity.

## Versioning

- Tags: `v12.0.0`, `v12.0.1`, …
- CI: `.github/workflows/release-v12.yml`
- App bundle name: **Smiley** (`com.smiley.v12`)
