<div align="center">

# Smiley

<img src="build/icon.png" width="120" alt="Smiley app icon" />

**One click → your Discord profile shows what you're up to — with a live anime GIF.**

Pick eating, gaming, coding, chilling… Smiley handles the rest. No Discord Developer Portal. No config files. Just download and go.

[![release](https://img.shields.io/github/v/release/1tsRajuWu/Smiley?style=for-the-badge)](https://github.com/1tsRajuWu/Smiley/releases/latest)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-5865F2?style=for-the-badge)](#download)
[![license](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey?style=for-the-badge)](LICENSE)

**[Download latest](https://github.com/1tsRajuWu/Smiley/releases/latest)** · [Report a bug](https://github.com/1tsRajuWu/Smiley/issues/new?template=bug_report.md&labels=bug) · [Smiley.Native](README-NATIVE.md) (lightweight)

</div>

---

## Download

**Current release: v3.1.7** — or grab everything from [Releases](https://github.com/1tsRajuWu/Smiley/releases/latest).

> **System requirements:** macOS 11+, Windows 10 (1809+) / 11, Linux Ubuntu 20.04+. Apple Silicon Macs (M1–M5) use the **arm64** DMG. Details: [docs/MINIMUM-REQUIREMENTS.md](docs/MINIMUM-REQUIREMENTS.md).

### Windows

| | Download | Notes |
|---|----------|-------|
| **Installer** (recommended) | [Smiley-Setup-3.1.7.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.7/Smiley-Setup-3.1.7.exe) | Windows 10 (1809+) / 11 · Start menu + desktop shortcut |
| **Portable** | [Smiley-Portable-3.1.7.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.7/Smiley-Portable-3.1.7.exe) | No install — settings in `SmileyData` beside the exe |

### macOS

| Chip | Download |
|------|----------|
| **Apple Silicon** (M1–M5) | [Smiley-3.1.7-arm64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.7/Smiley-3.1.7-arm64.dmg) |
| **Intel** (pre-2020 Macs) | [Smiley-3.1.7-x64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.7/Smiley-3.1.7-x64.dmg) |

> macOS might block the first launch — that's Gatekeeper, not a virus. See [Installing → macOS](#macos).

### Linux

| Format | Download | Notes |
|--------|----------|-------|
| **AppImage** | [Smiley-3.1.7.AppImage](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.7/Smiley-3.1.7.AppImage) | Works on most distros — `chmod +x` then run |
| **.deb** | [Smiley-3.1.7.deb](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.7/Smiley-3.1.7.deb) | Debian / Ubuntu / Mint |

### Smiley.Native — for low-end PCs (~25 MB)

No Electron. No Chromium. Same Discord presence, way less RAM. See [README-NATIVE.md](README-NATIVE.md).

---

## Quick start

1. **Download** the installer for your OS (table above).
2. **Install & open Discord** — keep the **Discord desktop** app running (not the browser tab).
3. **Pick an activity** — launch Smiley, choose a category, click an activity. Your profile updates instantly.

Smiley ships with a bundled Discord Client ID. You don't need the Developer Portal.

---

## Features

- **Activity picker** — 5 categories, 32 presets, search, favorites, recent activities, keyboard shortcuts (`Ctrl/Cmd+1–5`, `Ctrl/Cmd+K`, `Esc`)
- **Create your own activity** — custom title, emoji, and GIF (paste a Tenor/Giphy URL for Discord; uploads preview in-app)
- **Animated presence** — curated anime GIFs per activity; live fallbacks from [nekos.best](https://nekos.best) & [waifu.pics](https://waifu.pics)
- **11 themes** — Dark, Midnight, Ocean, Sakura, Low Light (OLED), Sunset, Forest, Lavender, Cyber, Coffee, Rose
- **System integration** — tray icon, minimize to tray, auto-connect, global hotkey (`Cmd/Ctrl+Shift+S`), start on login, export/import settings
- **Auto-updates** — checks [GitHub Releases](https://github.com/1tsRajuWu/Smiley/releases) on startup (packaged builds only)

---

## Installing

### Before you start

- Discord **desktop** app running — browser Discord won't work for Rich Presence
- Internet for GIF images
- Not **Invisible** on Discord

### Windows

1. Download [Smiley-Setup-3.1.7.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.7/Smiley-Setup-3.1.7.exe) and run it.
2. If **SmartScreen** appears → **More info** → **Run anyway** (not code-signed yet — [source is here](https://github.com/1tsRajuWu/Smiley)).
3. Launch from Start or desktop. Keep Discord desktop open.

**Portable:** [Smiley-Portable-3.1.7.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.7/Smiley-Portable-3.1.7.exe) — settings live in a `SmileyData` folder next to the exe.

### macOS

1. Download the `.dmg` for your chip — **arm64** for Apple Silicon, **x64** for Intel.
2. Open the DMG → drag **Smiley** into **Applications** → eject the DMG.
3. Launch from Applications.

More detail: [INSTALL-MAC.md](INSTALL-MAC.md)

**Gatekeeper says "can't verify"?** Right-click Smiley → **Open** (first time only). Or **System Settings → Privacy & Security → Open Anyway**.

**Crash on launch?** Re-download from [Releases](https://github.com/1tsRajuWu/Smiley/releases/latest), then:

```bash
xattr -cr ~/Downloads/Smiley-*.dmg
xattr -cr /Applications/Smiley.app
```

### Linux

```bash
chmod +x Smiley-3.1.7.AppImage && ./Smiley-3.1.7.AppImage
# or
sudo dpkg -i Smiley-3.1.7.deb
```

---

## How Discord presence works

Smiley talks to the **Discord desktop app** over local IPC — same way games do Rich Presence. Both apps must be on the same machine.

| You need | Why |
|----------|-----|
| Discord **desktop** open | Browser can't receive IPC |
| Not Invisible | Discord hides presence when invisible |

Click **Clear** in Smiley (or tray → Clear Status) to wipe it.

---

## Settings

Gear icon in the app, or tray → **Settings**.

| Tab | What's in there |
|-----|-----------------|
| **General** | Auto-connect, minimize to tray, auto-check/install updates |
| **Appearance** | Session timer, 11 themes |
| **Animations** | Enable/disable GIFs, upload custom animation |
| **Advanced** | Start on login, global hotkey, export/import settings |
| **About** | Version, support link, Terms & Privacy |

---

## Building from source

For developers. Everyone else → [Download](#download).

```bash
git clone https://github.com/1tsRajuWu/Smiley.git
cd Smiley
cp discord.app.example.json discord.app.json   # your Discord Application Client ID
npm install
npm start
```

```bash
npm run build:mac    # macOS .dmg + .zip (x64 + arm64)
npm run build:win    # Windows Setup + Portable (x64)
npm run build:linux  # AppImage + .deb (x64)
```

---

## Support

If Smiley's been useful: **[paypal.me/1tsRaj](https://paypal.me/1tsRaj)**

---

## FAQ

<details>
<summary><strong>Why does Discord show a <code>?</code> for the image?</strong></summary>

Usually a bad or unreachable image URL. Smiley uses HTTPS fallbacks from nekos.best and waifu.pics. Custom uploads must be under 5 MB.
</details>

<details>
<summary><strong>Why won't macOS open Smiley?</strong></summary>

Not <strong>notarized</strong> yet. See <a href="#macos">Installing → macOS</a> and <a href="INSTALL-MAC.md">INSTALL-MAC.md</a>.
</details>

<details>
<summary><strong>Can I use this on my phone?</strong></summary>

Not right now — Smiley is <strong>desktop only</strong> (Windows, macOS, Linux). Discord Rich Presence needs the desktop Discord client on your PC.
</details>

<details>
<summary><strong>Discord says "Disconnected" in Smiley</strong></summary>

Discord <strong>desktop</strong> running? Not Invisible? Restart Discord, then Smiley.
</details>

---

## License & credits

© Raj ([@1tsRaj](https://github.com/1tsRaj)) — **All Rights Reserved**. See [LICENSE](LICENSE).

| Resource | Credit |
|----------|--------|
| Anime GIFs | [nekos.best](https://nekos.best), [waifu.pics](https://waifu.pics) |
| Discord RPC | [discord-rpc](https://github.com/discord/discord-rpc) |
| Desktop shell | [Electron](https://www.electronjs.org/) |

[Terms of Service](ToS.md) · [Privacy Policy](PRIVACY.md)

---

<div align="center">

**Made by Raj**

[Download](https://github.com/1tsRajuWu/Smiley/releases/latest) · [Issues](https://github.com/1tsRajuWu/Smiley/issues)

</div>
