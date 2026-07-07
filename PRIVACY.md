# Privacy Policy

**Raj (@1tsRaj)** — last updated 9 July 2026 (v5.0.17)

## Short version

Smiley encrypts your settings locally (AES-256-GCM) and uses HTTPS for all network requests. By using the app you agree to this policy and our [Terms of Service](ToS.md). Smiley sends **install and usage telemetry on every launch** (including a hashed public IP, captured server-side). There is no opt-out — if you do not agree, do not use the app. See [SECURITY.md](SECURITY.md) for the full E2EE and security model.

## Encryption & E2EE

| Data | Protection |
|------|------------|
| Settings (`config.secure`) | Encrypted on disk — AES-256-GCM, device-bound key |
| Window position | Encrypted on disk (`window-state.secure`) |
| Install ID | Encrypted on disk (`install-id.secure`) |
| Settings export (`.smiley`) | **End-to-end encrypted** with **your passphrase** — we cannot decrypt |
| Network requests | HTTPS/TLS only to allowed hosts |
| Discord RPC | Local IPC only — no Smiley cloud relay |

Keys are derived on your device (scrypt). Smiley does **not** store encryption keys in the system keychain or upload them.

Full details: [SECURITY.md](SECURITY.md)

## What stays local

| Stored on your device | Why |
|-----------------------|-----|
| Discord Client ID | Connect to Discord RPC |
| Theme, timer, window size | Your settings (encrypted) |
| Custom GIFs you upload | Your files |
| Random install ID (UUID) | Ties heartbeat requests to one install (encrypted) |

## Install and usage telemetry (required)

Each packaged app launch sends a heartbeat to our Supabase database **over HTTPS**. This is mandatory for using Smiley.

| Field | Source | Purpose |
|-------|--------|---------|
| `install_id` | Generated on your device (stored encrypted locally) | Count unique installs; no Discord or OS login link |
| `ip_address` | **Hashed server-side** from the HTTP request (SHA-256 + salt) | Security, abuse prevention, coarse geography |
| `platform`, `arch` | Your OS | Platform analytics |
| `os_version` | OS kernel/build string | OS compatibility |
| `electron_version` | Electron runtime | Runtime diagnostics |
| `locale` | App UI language (e.g. `en-US`) | Localization analytics |
| `timezone` | IANA timezone (e.g. `Asia/Kolkata`) | Coarse time region |
| `channel` | `release` or `portable` | Install type |
| `app_version` | Smiley version | Version adoption |
| `user_agent` | App + Electron/OS string | Compatibility diagnostics |
| `launch_count` | **Server-side** increment on each heartbeat | Usage frequency |
| `first_seen_at`, `last_seen_at` | Server timestamps | Active install tracking |
| `consent_version` | Policy version ID | Legal compliance record |
| `country_code`, `country_name`, `region`, `region_name`, `city`, `isp`, `geo_timezone` | **IP geolocation** ([ipwho.is](https://ipwho.is) over HTTPS) + edge headers | Country, city, ISP, region |

**Not sent:** Discord username, token, messages, email, name, hostname, serial number, or files from your device.

**Third party:** [Supabase](https://supabase.com) hosts the database; [ipwho.is](https://ipwho.is) provides IP geolocation over HTTPS.

**Retention:** Install rows are kept for operational analytics and security until manually deleted by the operator. Contact below to request deletion of your `install_id` row.

## Other network activity

- **Discord** — local IPC only, no cloud relay
- **waifu.pics / Tenor / Giphy** — fetches images, no personal info sent
- **GitHub** — version check on launch (HTTPS)
- **Apple iTunes Search** — optional album art lookup sends song title + artist (HTTPS) when music sync is on
- **PayPal** — only if you click the donate link

## What we never collect

- Discord username, **login token**, bot token, email, or password
- Discord message content, DMs, servers, or friends list
- Your name or email (unless you contact us)
- Files or screenshots from your device
- Your export passphrase (never leaves your device)

### Discord specifically

Smiley does **not** read your Discord account. It connects to the **Discord desktop app** via local IPC using a public Application Client ID. Your Discord login token never leaves Discord's app and is **never** stored by Smiley. Only the Rich Presence text you pick (activity name, optional song title) is sent to Discord.

## Your rights

Depending on your jurisdiction you may have rights to access, correct, delete, or object to processing of install data. Contact us with your `install_id` to request deletion. Uninstalling the app does not automatically delete rows already stored.

## Uninstall

Delete the app and remove:

- macOS: `~/Library/Application Support/smiley-rpc/`
- Windows: `%APPDATA%/smiley-rpc/`
- Linux: `~/.config/smiley-rpc/`

## Kids

Not aimed at under-13s.

## Contact

[paypal.me/1tsRaj](https://paypal.me/1tsRaj) (support) · GitHub Issues on the official repo
