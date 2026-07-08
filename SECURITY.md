# Security & End-to-End Encryption (E2EE)

**Raj (@1tsRaj)** — last updated 9 July 2026 (v7.9.3)

Smiley is designed so your personal settings stay on your device, encrypted at rest, with optional passphrase-protected exports. This document explains what is protected, how encryption works, and what we do **not** claim.

## Secrets & CI

**Never commit real credentials** to the repository.

| Secret | Where it belongs |
|--------|------------------|
| Discord Application Client ID | `discord.app.json` (gitignored) or GitHub Actions `DISCORD_CLIENT_ID` |
| Supabase URL + anon key | `downloads.registry.json` (gitignored) or `SUPABASE_URL` / `SUPABASE_ANON_KEY` in Actions |
| Database admin / service role keys | GitHub Actions secrets only — never in source |
| User `config.secure` | End-user device only |

Use `discord.app.example.json`, `downloads.registry.example.json`, and `config.example.json` as templates. Official release workflows inject secrets at build time.

**Forks:** Configure your own GitHub Actions secrets. Do not use the author's Supabase project or Discord application — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Discord account safety

Smiley **never** accesses, stores, logs, or transmits:

| Data | Status |
|------|--------|
| Discord login token / bot token | **Never read or stored** |
| Discord username, email, password | **Never collected** |
| Discord messages, DMs, servers | **Never accessed** |
| Discord friends list | **Never accessed** |

**How Discord connection works:** Smiley uses the public **Application Client ID** (not a secret token) and talks to the **Discord desktop app** over **local IPC** only. Your Discord login stays inside Discord's own app. Smiley only sends Rich Presence text (activity title, song name, GIF URL) that you choose.

## Gaming sync (Gaming Now Playing)

When enabled, Smiley reads **local** game state only — never uploads it to Smiley servers.

| Data | Where it stays | Sent to Discord |
|------|----------------|-----------------|
| Foreground window title / process | Device | Yes (presence text) |
| Riot lockfile password / PUUID | **Main process only** | **Never** |
| Riot local API (`127.0.0.1`) stats | Device | Yes (map, agent, K/D, score) |
| Public CDN artwork (valorant-api, ddragon, Steam) | Fetched device-side | Yes (image URL) |

**Controls:** `contextIsolation: true`, `nodeIntegration: false`, whitelist-only `preload.js` bridge, `sanitizeGameSession()` strips PUUID/tokens before renderer IPC, rate-limited IPC guard rejects untrusted senders.

**External hosts (gaming):** `127.0.0.1` (Riot local API), `valorant-api.com`, `ddragon.leagueoflegends.com`, `store.steampowered.com`, `cdn.akamai.steamstatic.com`, plus curated static art CDNs. No `tracker.gg` or third-party account APIs.

**Not used:** `eval()`, remote code execution, WebSocket exfiltration, or sending lockfile credentials off-device.

## Summary

| Layer | Protection |
|-------|------------|
| **Settings on disk** | AES-256-GCM, device-bound key (scrypt KDF) |
| **Window position** | AES-256-GCM (`window-state.secure`) |
| **Install ID** | AES-256-GCM (`install-id.secure`) |
| **Settings export** | **True E2EE** — AES-256-GCM with **your passphrase** (scrypt KDF) |
| **Network traffic** | HTTPS/TLS only to allowed hosts |
| **Discord RPC** | Local IPC only — no Smiley cloud relay |
| **Renderer** | Context isolation, no Node integration, CSP |

## What “E2EE” means in Smiley

**End-to-end encrypted exports:** When you export settings, you choose a passphrase. The `.smiley` file is encrypted with AES-256-GCM. Only someone with that passphrase can decrypt it — including us.

**Encrypted at rest:** Config, window state, and install ID are encrypted on disk before writing. Keys are derived on your machine and are not uploaded.

**Encrypted in transit:** Install heartbeats, update checks, GIF API requests, and iTunes artwork lookups use HTTPS.

**Not E2EE (by design):**

- **Install telemetry** on official packaged builds sends metadata to the author's Supabase database over TLS. The server can read install ID, platform, version, locale, timezone, hashed IP, and coarse geo. There is no opt-out on official builds.
- **Discord Rich Presence** sends activity text and image URLs to Discord via local IPC.
- **Third-party GIF APIs** receive anonymous image requests only.

## Reporting security issues

Report vulnerabilities via **GitHub** — open a private security advisory or contact [@1tsRajuWu](https://github.com/1tsRajuWu) rather than filing a public issue for exploitable bugs.

- GitHub Security Advisories: [github.com/1tsRajuWu/Smiley/security/advisories](https://github.com/1tsRajuWu/Smiley/security/advisories)
- Email: **1tsRajuWu@users.noreply.github.com** with subject `Security report — Smiley`

Do **not** disclose exploit details in public Issues before a fix is available.

## Related documents

- [Privacy Policy](PRIVACY.md) — what data is collected
- [Terms of Service](ToS.md) — acceptable use and liability
- [Contributing](CONTRIBUTING.md) — secrets and off-limits infrastructure
- [Legal Information](LEGAL.md) — copyright and distribution rules
- [docs/FINAL.md](docs/FINAL.md) — final release & fork boundaries
