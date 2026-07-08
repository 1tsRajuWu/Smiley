# Terms of Service

**Raj (@1tsRaj)** — last updated 8 July 2026 (v7.9.5)

**Applies to official Smiley builds** from the author's releases. Third-party forks are governed by their maintainers' terms.

## The basics

By downloading, installing, or using **official** Smiley you agree to these Terms and our [Privacy Policy](PRIVACY.md). If you do not agree, do not use official releases.

Smiley talks to the Discord desktop app over the local IPC API. It does **not** read your login token, username, password, messages, or account credentials. Only Rich Presence text you choose (and optional live game stats when Gaming Now Playing is enabled) is sent to Discord.

**Gaming Now Playing** uses local detection only by default: foreground window titles and, where supported, local game APIs on `127.0.0.1` (e.g. Riot Client for Valorant / League of Legends). Smiley does not upload match data or account identifiers to the author's servers as part of this feature.

## Final version

**v7.0.0 is the final release.** The author may ship patches or bug fixes but does not plan major new features. See [docs/FINAL.md](docs/FINAL.md).

## Open source & forks

The source code is open under the [LICENSE](LICENSE). You may fork, modify, and redistribute code **if you comply with the license** and:

- Use **your own** Discord Application Client ID, Supabase project, and donation links
- Do **not** access the author's install database or telemetry
- Keep copyright and attribution notices
- Do not imply official endorsement for your fork

Details: [CONTRIBUTING.md](CONTRIBUTING.md) · [LEGAL.md](LEGAL.md)

## Security & encryption

Smiley uses industry-standard encryption to protect your data:

- **Local storage:** Settings, window position, and install ID are encrypted at rest (AES-256-GCM).
- **Exports:** Settings exports use passphrase-based end-to-end encryption (E2EE). You are responsible for your export passphrase.
- **Network:** Remote requests use HTTPS/TLS. Install telemetry on official builds is transmitted securely but is **not** E2EE — the server can read it. See [SECURITY.md](SECURITY.md).

You agree not to attempt to bypass, disable, or tamper with Smiley's security controls on official builds.

## Data collection (official builds)

Official Smiley collects **install and usage telemetry on every launch**, including a device-generated install ID, platform, OS version, Electron version, locale, timezone, app version, user-agent string, launch count, and a **hashed public IP address** (recorded server-side). Coarse location (country, region, city, ISP) is derived from IP geolocation. See [PRIVACY.md](PRIVACY.md) for full details.

**There is no opt-out on official packaged builds.** Using official Smiley constitutes acceptance of this collection.

## Your Discord app

Official releases include a bundled Discord Application Client ID owned by the author. If you build from source or maintain a fork, you supply your own from the [Discord Developer Portal](https://discord.com/developers/applications). Keep secrets out of git. Smiley stores user config on the machine only, encrypted locally.

## Don't

- Break Discord's Terms of Service or Community Guidelines
- Access, scrape, or abuse the **author's** Supabase database or install telemetry
- Use the author's Discord Application ID, PayPal link, or CI secrets in your fork
- Remove copyright or trademark notices from redistributed code
- Use Smiley for anything illegal
- Attempt to interfere with install telemetry or abuse official infrastructure
- Attempt to exploit, hack, or attack Smiley, its infrastructure, or other users

## Images

Smiley pulls SFW anime images from third-party APIs (e.g. waifu.pics). I don't host or control that content.

## Donations

PayPal tips on official builds (`paypal.me/1tsRaj`) are optional. They don't unlock features or create any obligation.

## Warranty

Smiley is provided as-is. No guarantee it'll work with every Discord update. No guarantee of absolute security against all threats — see [SECURITY.md](SECURITY.md) threat model.

## Liability

To the maximum extent permitted by law, the author is not liable for indirect, incidental, or consequential damages arising from use of Smiley or third-party services (Discord, Supabase, image APIs).

## Changes

These terms may be updated for official builds. Material changes will be reflected in the `consent_version` sent with install data and in release notes. Continued use after changes constitutes acceptance.

## Contact

GitHub Issues: [github.com/1tsRajuWu/Smiley/issues](https://github.com/1tsRajuWu/Smiley/issues)
