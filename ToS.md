# Terms of Service

**Raj (@1tsRaj)** — last updated 9 July 2026 (v6.0.2)

## The basics

By downloading, installing, or using Smiley you agree to these Terms and our [Privacy Policy](PRIVACY.md). If you do not agree, do not use the app.

Smiley talks to the Discord desktop app over the local IPC API. It does **not** read your login token, username, password, messages, or account credentials. Only Rich Presence text you choose is sent to Discord.

## Security & encryption

Smiley uses industry-standard encryption to protect your data:

- **Local storage:** Settings, window position, and install ID are encrypted at rest (AES-256-GCM).
- **Exports:** Settings exports use passphrase-based end-to-end encryption (E2EE). You are responsible for your export passphrase.
- **Network:** Remote requests use HTTPS/TLS. Install telemetry is transmitted securely but is **not** E2EE — the server can read it. See [SECURITY.md](SECURITY.md).

You agree not to attempt to bypass, disable, or tamper with Smiley's security controls.

## Data collection

Smiley collects **install and usage telemetry on every launch**, including a device-generated install ID, platform, OS version, Electron version, locale, timezone, app version, user-agent string, launch count, and a **hashed public IP address** (recorded server-side). Coarse location (country, region, city, ISP) is derived from IP geolocation. See [PRIVACY.md](PRIVACY.md) for full details.

**There is no opt-out.** Using Smiley constitutes acceptance of this collection.

## Your Discord app

Official releases include a bundled Discord Application Client ID. If you build from source, you supply your own from the [Discord Developer Portal](https://discord.com/developers/applications). Keep it private. Smiley stores config on your machine only, encrypted locally.

## Don't

- Break Discord's Terms of Service or Community Guidelines
- Fork, clone, mirror, redistribute, or rebrand Smiley without written permission
- Reverse-engineer or distribute modified builds
- Use Smiley for anything illegal
- Attempt to interfere with install telemetry or abuse the service
- Attempt to exploit, hack, or attack Smiley, its infrastructure, or other users

Unauthorized copies violate copyright. See [LEGAL.md](LEGAL.md).

## Images

Smiley pulls SFW anime images from third-party APIs (e.g. waifu.pics). I don't host or control that content.

## Donations

PayPal tips are optional. They don't unlock features or create any obligation.

## Warranty

Smiley is provided as-is. No guarantee it'll work with every Discord update. No guarantee of absolute security against all threats — see [SECURITY.md](SECURITY.md) threat model.

## Liability

To the maximum extent permitted by law, the author is not liable for indirect, incidental, or consequential damages arising from use of Smiley or third-party services (Discord, Supabase, image APIs).

## Changes

These terms may be updated. Material changes will be reflected in the `consent_version` sent with install data and in release notes. Continued use after changes constitutes acceptance.

## Contact

Questions: [paypal.me/1tsRaj](https://paypal.me/1tsRaj)
