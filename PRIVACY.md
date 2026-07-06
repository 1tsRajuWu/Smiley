# Privacy Policy

**Raj (@1tsRaj)** — last updated 6 July 2026 (v4.1.13)

## Short version

Smiley stores your settings locally. By using the app you agree to this policy and our [Terms of Service](ToS.md). Smiley sends **install and usage data by default** (including your public IP, captured server-side) unless you opt out in Settings.

## What stays local

| Stored on your device | Why |
|-----------------------|-----|
| Discord Client ID | Connect to Discord RPC |
| Theme, timer, window size | Your settings |
| Custom GIFs you upload | Your files |
| Random install ID (UUID) | Ties heartbeat requests to one install |

Config is encrypted locally on disk (AES-256-GCM); nothing is stored in the system keychain.

## Install and usage data (default on)

When **install tracking is enabled** (default), each app launch sends a heartbeat to our Supabase database:

| Field | Source | Purpose |
|-------|--------|---------|
| `install_id` | Generated on your device | Count unique installs; no Discord or OS login link |
| `ip_address` | **Captured server-side** from the HTTP request (e.g. `x-forwarded-for`) | Security, abuse prevention, coarse geography |
| `platform`, `arch` | Your OS | Platform analytics |
| `app_version` | Smiley version | Version adoption |
| `user_agent` | App + Electron/OS string | Compatibility diagnostics |
| `first_seen_at`, `last_seen_at` | Server timestamps | Active install tracking |
| `consent_version` | Policy version ID | Legal compliance record |
| `country_code`, `region` | Optional, if derived server-side from IP | Aggregate geography |

**Not sent:** Discord username, token, messages, email, name, hostname, serial number, or files from your device.

**Third party:** [Supabase](https://supabase.com) hosts the database (US/EU depending on project region). See their privacy policy for subprocessors.

**Opt out:** Settings → General → **Don't share install data**. When off, no heartbeat requests are sent.

**Retention:** Install rows are kept for operational analytics and security until manually deleted by the operator. Contact below to request deletion of your `install_id` row.

## Other network activity

- **Discord** — local IPC only, no cloud relay
- **waifu.pics / Tenor / Giphy** — fetches images, no personal info sent
- **GitHub** — version check on launch
- **PayPal** — only if you click the donate link

## What we never collect

- Discord username, token, or message content
- Your name or email (unless you contact us)
- Files or screenshots from your device

## Your rights

Depending on your jurisdiction you may have rights to access, correct, delete, or object to processing of install data. Opt out in Settings or contact us with your `install_id` (in `install-id` under app data) to request deletion.

## Uninstall

Delete the app and remove:

- macOS: `~/Library/Application Support/smiley-rpc/`
- Windows: `%APPDATA%/smiley-rpc/`
- Linux: `~/.config/smiley-rpc/`

Opt-out does not automatically delete rows already stored; contact us for deletion.

## Kids

Not aimed at under-13s.

## Contact

[paypal.me/1tsRaj](https://paypal.me/1tsRaj) (support) · GitHub Issues on the official repo
