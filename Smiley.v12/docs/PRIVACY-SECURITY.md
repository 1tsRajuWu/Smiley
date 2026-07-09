# Privacy & security — Smiley v12

## On your machine

| Data | Location |
|------|----------|
| Your config | `~/Library/Application Support/Smiley/config.json` (macOS) |
| Logs | `~/Library/Application Support/Smiley/logs/smiley.log` |

Config stores favorites, custom activities, skin choice, idle GIF URL, and privacy toggles. Nothing is uploaded to Smiley servers.

**Valorant / LoL:** Smiley reads the Riot Client **lockfile** and calls **127.0.0.1** only — same pattern as official companion apps. No injectors, no memory reads, no Tracker-style APIs.

**Logs:** `smiley.log` redacts PUUIDs and Riot IDs via `privacy.rs`.

## Network (v12)

| Host | Why |
|------|-----|
| `media.tenor.com` | Activity GIF previews |
| `media.valorant-api.com` | Agent/map art for Discord images |
| `127.0.0.1` | Riot local API when Valorant is running |
| `api.github.com` | Check for Smiley v12 updates (Settings / tray) |
| `github.com` | Download updates / release page |

Discord presence uses the desktop **IPC pipe** — not a bot token.

## Donate link

Only `https://paypal.me/1tsRaj` is allowed from Rust (`open_donation_url`).
