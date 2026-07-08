# Privacy & security — Smiley v8

**Local-first.** No third-party trackers, no game injectors, no memory reads.

## What never leaves your PC

| Data | Status |
|------|--------|
| Riot lockfile password | Rust only — never logged, never sent to UI |
| PUUID / Subject IDs | Rust only — never in UI or logs |
| Discord login token | Never read (local IPC + public Client ID only) |
| Your config | `~/Library/Application Support/Smiley-v8/config.json` on device |

## Live Valorant match board

Data comes from **Riot Client on `127.0.0.1`** and optional **local name-service** (still Riot APIs only).

**Defaults (privacy-first):**

| Setting | Default | Meaning |
|---------|---------|---------|
| Show match board | On | Ally/enemy **agents** only in-app |
| Other players' Riot IDs | **Off** | Names shown as Ally 1 / Enemy 2 until you opt in |
| Other players' KDA | **Off** | Only your KDA unless you opt in |
| Share score & KDA on Discord | On | Discord can show score lines (toggle off for generic "In match") |

**Tray / hidden window:** Match board is hidden when the app is in the tray or the window is not visible.

**Logs:** `~/Library/Application Support/Smiley-v8/logs/smiley.log` redacts PUUIDs and Riot IDs.

## Network (v8)

| Host | Why |
|------|-----|
| `127.0.0.1` | Riot local API (when Valorant is running) |
| `media.tenor.com` | Activity GIFs |
| `media.valorant-api.com` | Agent icons (public CDN) |
| `valorant-api.com` | Agent name lookup (public catalog) |
| `api.github.com` | Check for Smiley v8 updates (Settings / tray) |
| `paypal.me/1tsRaj` | Donate only — opened from Rust, not the webview |

No `opener` permission for the webview — arbitrary URLs cannot be opened from JavaScript.

## Settings

**Settings → Privacy** — match board and sharing toggles.

See also: [../../PRIVACY.md](../../PRIVACY.md), [../../SECURITY.md](../../SECURITY.md) (Electron v7 shipping app).
