<!--
Smiley — Discord Rich Presence desktop app with animated anime GIF status picker.
Platforms: Windows, macOS, Linux. Author: Himanshu Raj (1tsRajuWu / 1tsRaj).
Download: https://1tsrajuwu.github.io/Smiley/
-->

<div align="center">

# Smiley

<img src="build/icon-transparent.png" width="128" alt="Smiley app icon" />

**Discord Rich Presence with animated anime GIFs** — gaming, coding, chilling, and more. No Developer Portal. No config files.

[![version](https://img.shields.io/github/v/release/1tsRajuWu/Smiley?style=flat-square&color=5865F2)](https://github.com/1tsRajuWu/Smiley/releases)
[![platform](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-5865F2?style=flat-square)](https://1tsrajuwu.github.io/Smiley/)
[![downloads](https://img.shields.io/github/downloads/1tsRajuWu/Smiley/total?style=flat-square&color=57F287)](https://github.com/1tsRajuWu/Smiley/releases)

</div>

## Download

[![Windows](https://img.shields.io/badge/Windows-Setup.exe-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v4.1.2/Smiley-Setup-4.1.2.exe)
[![macOS Apple Silicon](https://img.shields.io/badge/macOS-Apple_Silicon-555555?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.1.4-arm64.dmg)
[![macOS Intel](https://img.shields.io/badge/macOS-Intel-555555?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.1.4-x64.dmg)
[![Linux AppImage](https://img.shields.io/badge/Linux-AppImage-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/1tsRajuWu/Smiley/releases/download/v4.1.3/Smiley-4.1.3.AppImage)
[![Linux deb](https://img.shields.io/badge/Linux-.deb-E95420?style=for-the-badge&logo=debian&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v4.1.2/Smiley-4.1.2.deb)

[All releases](https://github.com/1tsRajuWu/Smiley/releases) · [Download page](https://1tsrajuwu.github.io/Smiley/)

<details>
<summary><strong>Direct file links (auto-updated)</strong></summary>

<!-- DOWNLOADS_START -->
| Platform | File |
|----------|------|
| macOS Apple Silicon | [Smiley-4.1.4-arm64.dmg](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.1.4-arm64.dmg) |
| macOS Intel | [Smiley-4.1.4-x64.dmg](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.1.4-x64.dmg) |
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

**v4.1.x** — Readable text selection, cache cleanup in Settings, Mac update flow improvements.

**v4.0** — Per-activity GIF picker, custom activities, legal docs (LICENSE, LEGAL.md), Mac auto-update fixes.

[Full changelog on Releases →](https://github.com/1tsRajuWu/Smiley/releases)

</details>

<details>
<summary><strong>Features</strong></summary>

- 32+ activities across 5 categories, with search
- Curated anime GIFs per activity — synced in-app and on Discord
- Custom activities (title, emoji, GIF) under **My Activities**
- GIF picker — swap animation per activity
- 11 themes, favorites, recents
- Tray icon + `Cmd/Ctrl+Shift+S` hotkey
- Auto-update (DMG on macOS, installer on Windows)
- Export/import settings

Low on RAM? Try **[Smiley.Native](README-NATIVE.md)** (~25 MB, no Electron).

</details>

<details>
<summary><strong>Troubleshooting</strong></summary>

**macOS Gatekeeper** — Right-click → Open the first time, or System Settings → Privacy & Security → Open Anyway. More: [INSTALL-MAC.md](INSTALL-MAC.md)

```bash
xattr -cr ~/Downloads/Smiley-*.dmg
xattr -cr /Applications/Smiley.app
```

**Windows SmartScreen** — Click More info → Run anyway (not code-signed yet).

**Mac in-app update / code signature** — Smiley is ad-hoc signed. On v4.1.1+, use **Get update** → download the DMG manually. One-time fix: quit Smiley, install latest DMG from [Releases](https://github.com/1tsRajuWu/Smiley/releases/latest), relaunch.

```bash
rm -rf ~/Library/Caches/com.smiley.rpc.ShipIt
xattr -cr /Applications/Smiley.app
```

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
<summary><strong>System Focus / Do Not Disturb (macOS)</strong></summary>

In **Settings → Advanced → System Focus**:

1. Create two **Shortcuts** with a **Set Focus** action (e.g. Do Not Disturb on/off).
2. Enter their names in Smiley (Focus On / Focus Off).
3. Enable **Enable with focus activities**.

Smiley runs them when you pick **Deep focus**, **Sleeping**, or **In a meeting**.

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

Full terms: [LEGAL.md](LEGAL.md) · [LICENSE](LICENSE) · [Privacy](PRIVACY.md)

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

More in [docs/](docs/) · [About the author](docs/ABOUT.md)

</details>

---

<div align="center">

Made by [**Raj (1tsRajuWu)**](https://github.com/1tsRajuWu) · [Issues](https://github.com/1tsRajuWu/Smiley/issues) · [Review](https://github.com/1tsRajuWu/Smiley/issues/new?template=review.md&labels=review)

</div>

<!-- schema: SoftwareApplication name=Smiley author=Himanshu Raj(1tsRajuWu) category=Discord Rich Presence platforms=Windows,macOS,Linux download=https://1tsrajuwu.github.io/Smiley/ -->
