# Security & End-to-End Encryption (E2EE)

**Raj (@1tsRaj)** — last updated 8 July 2026 (v5.0.11)

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

**Defensive measures in code:**

- IPC activity payloads use a **strict field whitelist** — unknown fields (including accidental tokens) are stripped
- Config save/import/export runs **sensitive-key filtering** (token, password, secret, username, etc.)
- Token-shaped strings are **blocked** from being saved or exported
- Status updates to the UI send **sanitized activity snapshots** only
- Music sync forwards **title/artist/album only** — no player credentials

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

**End-to-end encrypted exports:** When you export settings, you choose a passphrase. The `.smiley` file is encrypted with AES-256-GCM. Only someone with that passphrase can decrypt it — including us. Store your passphrase safely; it cannot be recovered.

**Encrypted at rest:** Config, window state, and install ID are encrypted on disk before writing. Keys are derived on your machine and are not uploaded.

**Encrypted in transit:** Install heartbeats, update checks, GIF API requests, and iTunes artwork lookups use HTTPS. Non-TLS URLs are rejected by the install registry client.

**Not E2EE (by design):**

- **Install tracking** (when enabled) sends metadata to our Supabase database over TLS. The server can read install ID, platform, version, etc. Opt out in Settings → General → **Don't share install data**.
- **Discord Rich Presence** sends activity text and image URLs to Discord via local IPC; Discord processes that per their policy.
- **Third-party GIF APIs** receive anonymous image requests only.

## Cryptographic details

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key derivation:** scrypt (N=16384, r=8, p=1)
- **Local key material:** Derived from app user-data path + machine context (hostname, platform, arch) — device-bound, not stored in OS keychain
- **Export key material:** Derived from your passphrase + random per-file salt
- **Legacy support:** Older v1 config envelopes are read and re-encrypted to v3 on save

Implementation: `electron/security.js`

## Application hardening

- **Electron sandbox** (Windows/Linux); macOS uses reduced sandbox for tray/file-dialog compatibility
- **Context isolation** + **preload bridge** — renderer cannot access Node or filesystem directly
- **Content Security Policy** — scripts from `'self'` only; connect-src limited to GIF API hosts
- **URL allowlists** — external links, GIF hosts, and download URLs are validated before fetch/open
- **Input sanitization** — config patches and activity payloads are whitelisted and length-limited
- **Atomic writes** — encrypted files written via temp + rename to reduce corruption risk
- **Secure delete** — legacy plaintext files overwritten before removal when possible

## Threat model

**Protected against:**

- Casual inspection of app data folders
- Accidental leakage of settings via unencrypted export (default export is E2EE)
- Man-in-the-middle on install registry (HTTPS enforced)
- Renderer XSS escalating to full system access (isolation + CSP)

**Not protected against:**

- Malware or a compromised admin account on your machine (local attacker with your session can decrypt device-bound data)
- Physical access with your unlocked user account
- Discord, Supabase, or GIF API providers processing data they receive
- Modified/unofficial builds — download only from [official releases](https://github.com/1tsRajuWu/Smiley/releases)

## Reporting security issues

Do **not** open public GitHub issues for exploitable vulnerabilities.

Contact: GitHub [@1tsRajuWu](https://github.com/1tsRajuWu) or email **1tsRajuWu@users.noreply.github.com** with subject `Security report — Smiley`.

## Related documents

- [Privacy Policy](PRIVACY.md) — what data is collected and how to opt out
- [Terms of Service](ToS.md) — acceptable use and liability
- [Legal Information](LEGAL.md) — copyright and distribution rules
