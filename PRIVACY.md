# Privacy Policy

**Raj (@1tsRaj)** — last updated 8 July 2026 (v7.9.17)

**Applies to official Smiley builds** from [1tsRajuWu/Smiley](https://github.com/1tsRajuWu/Smiley/releases). Forks using their own backend are responsible for their own privacy policy — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Short version

Smiley encrypts your settings locally (AES-256-GCM) and uses HTTPS for all network requests. By using **official** builds you agree to this policy and our [Terms of Service](ToS.md). Official packaged builds send **install and usage telemetry on every launch** (including a hashed public IP, captured server-side). There is no opt-out on official builds — if you do not agree, do not use official releases (you may run a fork without the author's tracking). See [SECURITY.md](SECURITY.md) for the full E2EE and security model.

**Open source ≠ database access:** The public repository does not grant access to the author's Supabase database, install rows, or aggregated analytics. Those are operator infrastructure, not part of the source license.

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

Your local config and encrypted settings **stay on your device** unless you export them or official telemetry sends the fields below.

## Install and usage telemetry (official builds)

Each **official packaged** app launch may send a heartbeat to the **author's** Supabase database **over HTTPS**. Forks that replace `downloads.registry.json` with their own project send data elsewhere — or none, if disabled.

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
| `last_activity_section`, `last_activity_source`, `active_sections`, `section_overview` | Derived from on-device section counters | Feature-area analytics |
| `install_sections`, `install_section_sources` rows | Sanitized on-device section/source rollups | Usage by section/source (music player, coding editor, game provider, selected preset) |

**Not sent:** Discord username, token, messages, email, name, hostname, serial number, user files, Riot lockfile passwords, or local API secrets.

**Third party (official builds):** [Supabase](https://supabase.com) hosts the author's database; [ipwho.is](https://ipwho.is) provides IP geolocation over HTTPS.

**Retention:** Install rows are kept for operational analytics and security until manually deleted by the operator. Contact below to request deletion of your `install_id` row from **official** telemetry.

## Fork operators

If you fork Smiley and enable install tracking:

- You are the **data controller** for your users
- Publish your own privacy policy
- Use your own Supabase (or disable tracking) — never the author's credentials
- Do not access or export data from the author's database

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/FINAL.md](docs/FINAL.md).

## Other network activity

- **Discord** — local IPC only, no cloud relay
- **Gaming sync (optional)** — when Gaming Now Playing is enabled, Smiley reads the **foreground game window** and, for supported titles, **local game APIs on your machine only** (e.g. Riot Client lockfile on `127.0.0.1` for Valorant / League of Legends). Match stats, agent/champion, map, score, and party size are composed locally and sent **only to Discord Rich Presence** via local IPC. **No game account data, Riot tokens, PUUIDs, or lockfile passwords are sent to Smiley servers.** The renderer receives a sanitized `gameSession` snapshot (no PUUID/tokens).
- **Public game CDNs (HTTPS)** — cover art may be fetched from public URLs Discord can display (e.g. `valorant-api.com`, `ddragon.leagueoflegends.com`, Steam store CDN, curated static art). No account identifiers are included in these requests.
- **Steam Store search** — optional metadata lookup sends only the detected game title (HTTPS) to find cover art when a non-Riot game is in the foreground.
- **waifu.pics / Tenor / Giphy** — fetches images, no personal info sent
- **GitHub** — version check on launch (HTTPS)
- **Apple iTunes Search** — optional album art lookup sends song title + artist (HTTPS) when music sync is on
- **PayPal** — only if you click the donate link (official builds: author's PayPal)

### Section telemetry specifics

- **Music sync** may store the latest player/source label (for example Spotify or Apple Music), current track title, artist/album text, and whether artwork was available.
- **Gaming sync** may store the latest game/provider label plus sanitized state like mode, map, or whether you were in a match. It does **not** store Riot tokens, PUUIDs, lockfile passwords, or account identifiers in telemetry.
- **Coding sync** may store the latest editor/app name plus high-level status like editing/idle and a file or project label.
- **Activity presets** may store the latest selected preset ID/details/category.

## What we never collect

- Discord username, **login token**, bot token, email, or password
- Discord message content, DMs, servers, or friends list
- Your name or email (unless you contact us)
- Files or screenshots from your device
- Your export passphrase (never leaves your device)

### Discord specifically

Smiley does **not** read your Discord account. It connects to the **Discord desktop app** via local IPC using a public Application Client ID. Your Discord login token never leaves Discord's app and is **never** stored by Smiley. Only the Rich Presence text you pick (activity name, optional song title, optional live game stats) is sent to Discord.

### Gaming sync specifically

| Read locally | Sent to Smiley cloud | Sent to Discord |
|--------------|----------------------|-----------------|
| Foreground window title / process | **No** | Yes (as Rich Presence details/state) |
| Riot local API (`127.0.0.1`) when Riot Client is running | **No** | Yes (stats line only) |
| Riot lockfile password / PUUID | **No** (main process only) | **No** |
| Public CDN artwork URLs | **No** (fetched device-side) | Yes (image URL for Discord proxy) |

## Your rights

Depending on your jurisdiction you may have rights to access, correct, delete, or object to processing of install data from **official** builds. Contact us with your `install_id` to request deletion. Uninstalling the app does not automatically delete rows already stored.

## Uninstall

Delete the app and remove:

- macOS: `~/Library/Application Support/smiley-rpc/`
- Windows: `%APPDATA%/smiley-rpc/`
- Linux: `~/.config/smiley-rpc/`

## Kids

Not aimed at under-13s.

## Contact

GitHub Issues on the official repo · [paypal.me/1tsRaj](https://paypal.me/1tsRaj) (support on official builds only)
