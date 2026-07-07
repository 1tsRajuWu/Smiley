<!--
Smiley — Discord Rich Presence desktop app with animated anime GIF status picker.
Platforms: Windows, macOS, Linux. Author: Himanshu Raj (1tsRajuWu / 1tsRaj).
Download: https://1tsrajuwu.github.io/Smiley/
-->

**New to the code?** Read **[docs/CODE-TOUR.md](docs/CODE-TOUR.md)** (beginner walkthrough) or **[PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md)** (folder map).

<div align="center">

# Smiley

<img src="build/icon-transparent.png" width="128" alt="Smiley app icon" />

**Discord Rich Presence with animated anime GIFs** — gaming, coding, chilling, and more. No Developer Portal. No config files.

[![version](https://img.shields.io/github/v/release/1tsRajuWu/Smiley?style=flat-square&color=5865F2)](https://github.com/1tsRajuWu/Smiley/releases)
[![platform](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-5865F2?style=flat-square)](https://1tsrajuwu.github.io/Smiley/)
[![downloads](https://img.shields.io/github/downloads/1tsRajuWu/Smiley/total?style=flat-square&color=57F287)](https://github.com/1tsRajuWu/Smiley/releases)

</div>

## Download

<!-- HERO_DOWNLOADS_START -->
[![Windows](https://img.shields.io/badge/Windows-Setup.exe-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-Setup-5.0.17.exe)
[![macOS Apple Silicon](https://img.shields.io/badge/macOS_Apple_Silicon-Apple_Silicon-555555?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-5.0.17-arm64.dmg)
[![macOS Intel](https://img.shields.io/badge/macOS_Intel-Intel-555555?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-5.0.17-x64.dmg)
[![Linux AppImage](https://img.shields.io/badge/Linux_AppImage-AppImage-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-5.0.17.AppImage)
[![Linux deb](https://img.shields.io/badge/Linux_deb-.deb-E95420?style=for-the-badge&logo=debian&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-5.0.17.deb)
<!-- HERO_DOWNLOADS_END -->

[All releases](https://github.com/1tsRajuWu/Smiley/releases) · [Download page](https://1tsrajuwu.github.io/Smiley/)

<details>
<summary><strong>Direct file links (auto-updated)</strong></summary>

<!-- DOWNLOADS_START -->
| Platform | File |
|----------|------|
| Windows | [Smiley-Setup-5.0.17.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-Setup-5.0.17.exe) |
| macOS Apple Silicon | [Smiley-5.0.17-arm64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-5.0.17-arm64.dmg) |
| macOS Intel | [Smiley-5.0.17-x64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-5.0.17-x64.dmg) |
| Linux (AppImage) | [Smiley-5.0.17.AppImage](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-5.0.17.AppImage) |
| Linux (.deb) | [Smiley-5.0.17.deb](https://github.com/1tsRajuWu/Smiley/releases/download/v5.0.17/Smiley-5.0.17.deb) |
<!-- DOWNLOADS_END -->

</details>

```
┌─────────────────────────────────────────────────────────────┐
│  Smiley          ● Connected                         ─  ⚙  │
├──────────────────┬──────────────────────────────────────────┤
│   [ anime GIF ]  │  Search activities…                      │
│   "Playing Val"  │  Favorites · Recent · Gaming · Coding …    │
│  Discord preview │  Pick an animation → profile updates     │
└──────────────────┴──────────────────────────────────────────┘
```

## Quick start

1. **Download** for your platform (buttons above).
2. **Open Discord** — desktop app required (browser won't work).
3. **Pick an activity** — click a category, choose what you're up to.
4. Done — your profile shows the same GIF in-app and on Discord.

## Support

If Smiley's been useful: **[paypal.me/1tsRaj](https://paypal.me/1tsRaj)**

---

<details>
<summary><strong>What's new</strong></summary>

**v5.0.0** — Major release: activity profiles, auto-rotate favorites, pause/resume presence, favorite hotkeys, session stats. UI polish, all platforms synced, GitHub release notes on every tag.

**v4.1.19** — Advanced features: activity profiles, favorite rotation, pause/resume presence, session stats. Mobile APK CI fix.

**v4.1.18** — Fix GitHub download links (versioned URLs), release CI race (mobile APK after desktop), and incomplete-release README updates.

**v4.1.17** — Sync all platforms to one version; mobile companion updated with desktop GIF fixes and shared assets.

**v4.1.16** — Fix Mac in-app update downloads (GitHub redirect host) and custom activity GIF loading (CSP + local file paths).

**v4.1.9** — One-click Mac in-app updates: download in background, **Install update** restarts on the new version (no DMG / Gatekeeper loop). Users on very old builds need one manual update from [Releases](https://github.com/1tsRajuWu/Smiley/releases/latest) first.

**v4.1.x** — Mac update picks the correct arch (arm64/x64). Readable text selection, cache cleanup in Settings.

**v4.0** — Per-activity GIF picker, custom activities, legal docs (LICENSE, LEGAL.md), Mac auto-update fixes.

[Full changelog on Releases →](https://github.com/1tsRajuWu/Smiley/releases)

</details>

<details>
<summary><strong>Features</strong></summary>

- 32+ activities across 5 categories, with search
- Curated anime GIFs per activity — synced in-app and on Discord
- Custom activities (title, emoji, GIF) under **My Activities**
- GIF picker — swap animation per activity
- **Activity profiles** — save & apply favorite combos
- **Auto-rotate favorites** — cycle starred activities on a timer
- **Pause / resume** — hide Discord status without losing your pick (`Cmd/Ctrl+Shift+P`)
- **Favorite hotkeys** — `Cmd/Ctrl+Shift+1–9`
- **Session stats** — track time per activity
- 11 themes, favorites, recents
- Tray icon + `Cmd/Ctrl+Shift+S` hotkey
- Auto-update (one-click on macOS v4.1.9+, installer on Windows)
- Export/import settings

Low on RAM? Try **[Smiley.Native](README-NATIVE.md)** (~25 MB, no Electron).

</details>

<details>
<summary><strong>Troubleshooting</strong></summary>

**Mac in-app update (v4.1.9+)** — When a banner appears, Smiley downloads the update in the background. Click **Install update** — the app quits, replaces itself, and reopens. Works from `/Applications` or `~/Applications`. If install fails, use **Download DMG** in the banner as a fallback.

**First time / very old versions** — Install [v4.1.9 or newer](https://github.com/1tsRajuWu/Smiley/releases/latest) once manually (right-click → Open if Gatekeeper blocks), then future updates are one-click in the app.

**macOS Gatekeeper (first launch only)** — Right-click → Open the first time, or System Settings → Privacy & Security → Open Anyway. More: [INSTALL-MAC.md](INSTALL-MAC.md)

```bash
xattr -cr /Applications/Smiley.app
```

**Windows SmartScreen** — Click More info → Run anyway (not code-signed yet).

**Cache growing** — Settings → Advanced → **Clear cache** (v4.1.2+). Keeps settings and custom GIFs.

| OS | Data folder |
|----|-------------|
| macOS | `~/Library/Application Support/Smiley` |
| Windows | `%APPDATA%\Smiley` |
| Linux | `~/.config/Smiley` |

**Discord shows Disconnected** — Discord desktop running? Not Invisible? Restart both apps.

**Image shows `?` on Discord** — Bad image URL. Custom uploads: under 5 MB, HTTPS.

**Portable .exe removed** — v4.0+ ships the installer only. Use the Windows button above.

[Report a bug →](https://github.com/1tsRajuWu/Smiley/issues/new?template=bug_report.md&labels=bug)

</details>

<details>
<summary><strong>Advanced</strong></summary>

- **Custom activities** — Settings or **My Activities**: title, emoji, GIF
- **Themes** — 11 built-in (Dark, Sakura, Cyber, OLED Low Light, …)
- **Hotkey** — `Cmd/Ctrl+Shift+S` to show/hide (toggle in Settings)
- **Tray** — minimize instead of quit; right-click for quick picks
- **Export/import** — move settings between machines (Settings → Advanced)

Requirements: Discord desktop, macOS 11+ / Windows 10 (1809+) / Ubuntu 20.04+. [Details →](docs/MINIMUM-REQUIREMENTS.md)

</details>

<details>
<summary><strong>Legal</strong></summary>

Smiley is **not open source**. Source is visible for transparency — not licensed for forking, mirroring, or redistribution.

| OK | Not OK |
|----|--------|
| Download official releases for personal use | Fork, clone, mirror, rebrand |
| Report bugs via Issues | Commercial use without permission |

Full terms: [LEGAL.md](LEGAL.md) · [LICENSE](LICENSE) · [Privacy](PRIVACY.md) · [Terms](ToS.md) · [Security & E2EE](SECURITY.md)

Using Smiley means you accept our Terms and default install/usage reporting (opt out in Settings). Settings are encrypted locally; exports use passphrase E2EE. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

</details>

<details>
<summary><strong>For developers</strong></summary>

```bash
git clone https://github.com/1tsRajuWu/Smiley.git
cd Smiley
cp discord.app.example.json discord.app.json   # your Discord Client ID
npm install
npm start
```

```bash
npm run build:mac    # .dmg (x64 + arm64)
npm run build:win    # Windows installer
npm run build:linux  # AppImage + .deb
```

More in [docs/](docs/) · [Code tour (newbies)](docs/CODE-TOUR.md) · [Project structure](PROJECT-STRUCTURE.md) · [About the author](docs/ABOUT.md)

</details>

---

<div align="center">

Made by [**Raj (1tsRajuWu)**](https://github.com/1tsRajuWu) · [Issues](https://github.com/1tsRajuWu/Smiley/issues) · [Review](https://github.com/1tsRajuWu/Smiley/issues/new?template=review.md&labels=review)

</div>

<!-- schema: SoftwareApplication name=Smiley author=Himanshu Raj(1tsRajuWu) category=Discord Rich Presence platforms=Windows,macOS,Linux download=https://1tsrajuwu.github.io/Smiley/ -->
