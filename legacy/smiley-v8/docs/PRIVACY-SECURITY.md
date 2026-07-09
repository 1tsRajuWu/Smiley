# Privacy & security — Smiley v8

**Local-first.** No third-party trackers, no game injectors, no memory reads.

## What never leaves your PC

| Data | Status |
|------|--------|
| Riot lockfile password | Rust only — never logged, never sent to UI |
| PUUID / Subject IDs | Rust only — never in UI or logs |
| Discord login token | Never read (local IPC + public Client ID only) |
| Your config | `~/Library/Application Support/Smiley-v8/config.json` on device |

## Valorant Discord presence

Data comes from **Riot Client on `127.0.0.1`** only — map, mode, your agent, and score when available.

**Defaults (privacy-first):**

| Setting | Default | Meaning |
|---------|---------|---------|
| Valorant presence | On | Local lockfile probe for Discord rich presence |
| Share score & KDA on Discord | On (Full) | Discord shows map, agent, score; Minimal = generic "In match" |

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

**Settings → Discord** — Valorant Full vs Minimal detail.

See also: [../../PRIVACY.md](../../PRIVACY.md), [../../SECURITY.md](../../SECURITY.md) (Electron v7 shipping app).
