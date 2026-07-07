# Security & End-to-End Encryption (E2EE)

**Raj (@1tsRaj)** — last updated 9 July 2026 (v5.0.15)

Smiley is designed so your personal settings stay on your device, encrypted at rest, with optional passphrase-protected exports. This document explains what is protected, how encryption works, and what we do **not** claim.

## Discord account safety

Smiley **never** accesses, stores, logs, or transmits:

| Data | Status |
|------|--------|
| Discord login token / bot token | **Never read or stored** |
| Discord username, email, password | **Never collected** |
| Discord messages, DMs, servers | **Never accessed** |
| Discord friends list | **Never accessed** |

**How Discord connection works:** Smiley uses the public **Application Client ID** (not a secret token) and talks to the **Discord desktop app** over **local IPC** only. Your Discord login stays inside Discord's own app. Smiley only sends Rich Presence text (activity title, song name, GIF URL) that you choose.

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

- **Install telemetry** (mandatory on packaged builds) sends metadata to our Supabase database over TLS. The server can read install ID, platform, version, locale, timezone, hashed IP, and coarse geo. There is no opt-out.
- **Discord Rich Presence** sends activity text and image URLs to Discord via local IPC.
- **Third-party GIF APIs** receive anonymous image requests only.

## Reporting security issues

Do **not** open public GitHub issues for exploitable vulnerabilities.

Contact: GitHub [@1tsRajuWu](https://github.com/1tsRajuWu) or email **1tsRajuWu@users.noreply.github.com** with subject `Security report — Smiley`.

## Related documents

- [Privacy Policy](PRIVACY.md) — what data is collected
- [Terms of Service](ToS.md) — acceptable use and liability
- [Legal Information](LEGAL.md) — copyright and distribution rules
