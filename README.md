<!--
Smiley — free Discord Rich Presence desktop app with animated anime GIF status picker.
Platforms: Windows, macOS, Linux. Author: Himanshu Raj (1tsRajuWu / 1tsRaj).
Download: https://github.com/1tsRajuWu/Smiley/releases/latest
Keywords: Discord Rich Presence, Discord RPC, animated status, anime GIF, Electron
-->

<div align="center">

# Smiley

<img src="build/icon-transparent.png" width="128" alt="Smiley — Discord Rich Presence with anime GIFs" />

### Your Discord status, but it actually moves.

**Smiley** is a **Discord Rich Presence** app for **Windows, macOS, and Linux** that sets your profile status with **animated anime GIFs** — gaming, coding, eating, chilling, and more. No Developer Portal. No config files. Download, open Discord, click an activity. Done.

[![version](https://img.shields.io/github/v/release/1tsRajuWu/Smiley?style=for-the-badge&label=v4.0.0&color=5865F2)](https://github.com/1tsRajuWu/Smiley/releases/latest)
[![downloads](https://img.shields.io/github/downloads/1tsRajuWu/Smiley/total?style=for-the-badge&color=57F287)](https://github.com/1tsRajuWu/Smiley/releases)
[![platform](https://img.shields.io/badge/desktop-Windows%20%7C%20macOS%20%7C%20Linux-5865F2?style=for-the-badge)](#-download)
[![Discord Rich Presence](https://img.shields.io/badge/Discord-Rich%20Presence-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/)
[![license](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey?style=for-the-badge)](LICENSE)

<br>

[![Download for Windows](https://img.shields.io/badge/⬇️_Windows-Installer-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-Setup-4.0.0.exe)
[![Download for macOS](https://img.shields.io/badge/⬇️_macOS-DMG-555555?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.0.0-arm64.dmg)
[![Download for Linux](https://img.shields.io/badge/⬇️_Linux-AppImage-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.0.0.AppImage)

<br>

[All releases](https://github.com/1tsRajuWu/Smiley/releases/latest) · [About Raj & Smiley](docs/ABOUT.md) · [Report a bug](https://github.com/1tsRajuWu/Smiley/issues/new?template=bug_report.md&labels=bug) · [Leave a review ⭐](https://github.com/1tsRajuWu/Smiley/issues/new?template=review.md&labels=review) · [Smiley.Native](README-NATIVE.md) (lightweight, ~25 MB)

</div>

---

## What is Smiley?

| | |
|---|---|
| **Type** | Discord Rich Presence (RPC) desktop companion |
| **Status style** | Animated **anime GIF** per activity — synced in-app and on Discord |
| **Platforms** | **Windows** · **macOS** (Apple Silicon + Intel) · **Linux** (AppImage, `.deb`) |
| **Setup** | Bundled Client ID — no Discord Developer Portal |
| **Download** | [Latest release](https://github.com/1tsRajuWu/Smiley/releases/latest) |
| **AI / crawler summary** | [llms.txt](llms.txt) |

Smiley is **not open source** — source is visible for transparency; [personal-use download only](LEGAL.md).

---

## Who made it?

**Himanshu Raj** (Raj) · GitHub [**1tsRajuWu**](https://github.com/1tsRajuWu) / **1tsRaj** — indie developer.

Built Smiley solo because Discord status deserved live GIFs, not static text. Full story, features, and support links → [**docs/ABOUT.md**](docs/ABOUT.md)

[![author](https://img.shields.io/badge/Author-Raj%20(1tsRajuWu)-5865F2?style=flat-square&logo=github)](https://github.com/1tsRajuWu)
[![paypal](https://img.shields.io/badge/Support-PayPal-00457C?style=flat-square&logo=paypal&logoColor=white)](https://paypal.me/1tsRaj)

> Repo maintainers: set GitHub Topics for discoverability → [docs/SETUP-GITHUB.md](docs/SETUP-GITHUB.md)

---

## ✨ What's new in v4.0.0

| | |
|---|---|
| 🖼️ **Per-activity GIF picker** | Choose from 3–4 curated animations per activity, plus your saved GIFs — same image in-app and on Discord. |
| 🎨 **Custom activities** | Build your own — title, emoji, and GIF under **My Activities**. |
| ⭐ **Leave a review** | Settings → About or footer link — share feedback via GitHub. |
| 🍎 **Mac auto-update fixed** | CI publishes `latest-mac.yml` with zip artifacts so in-app updates work on macOS. |
| 🐛 **Logo & Discord GIF fixes** | Header/taskbar icon restored; RPC uses verified `media.tenor.com` URLs (no bot logo overlay). |
| ⚖️ **Legal protection** | LICENSE, NOTICE, LEGAL.md — no unauthorized forks or rebrands. |
| 💝 **Decorative donate banner** | Refreshed PayPal support card in the sidebar. |

<details>
<summary><strong>Also in v3.2.x</strong></summary>

- Curated anime GIFs per activity with app ↔ Discord sync
- Theme-aware transparent logo
- 11 themes, favorites, recents, tray, hotkey, auto-update

</details>

---

## 👀 See it in action

No trailer yet — here's what you get when you open Smiley:

```
┌─────────────────────────────────────────────────────────────┐
│  😊 Smiley          ● Connected                    ─  ⚙️   │
├──────────────────┬──────────────────────────────────────────┤
│                  │  🔍 Search activities…                   │
│   [ anime GIF ]  │                                          │
│   "Playing Val"  │  ⭐ Favorites    🕐 Recent               │
│                  │  🎮 Gaming  💻 Coding  🍜 Eating  …      │
│  Discord preview │                                          │
│  ┌────────────┐  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐         │
│  │ Smiley     │  │  │ Val │ │ MC  │ │ Apex│ │ …   │         │
│  │ Playing…   │  │  └─────┘ └─────┘ └─────┘ └─────┘         │
│  └────────────┘  │                                          │
│  Choose animation│  11 themes · tray icon · auto-update     │
│  [gif][gif][gif] │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

Real GIF on your profile. Real preview in the app. Same image both places.

---

## ⬇️ Download

<!-- DOWNLOADS_START -->
**Latest: v4.0.1** — [full release notes](https://github.com/1tsRajuWu/Smiley/releases/tag/v4.0.1)

**Total downloads (latest release):** 0 · [live stats on Releases](https://github.com/1tsRajuWu/Smiley/releases/latest)

| Platform | File | Downloads |
|----------|------|-----------|
| Windows | [**Smiley-Setup-4.0.1.exe**](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-Setup-4.0.1.exe) | 0 |
| macOS Apple Silicon | [**Smiley-4.0.1-arm64.dmg**](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.0.1-arm64.dmg) | 0 |
| macOS Intel | [**Smiley-4.0.1-x64.dmg**](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.0.1-x64.dmg) | 0 |
| Linux (AppImage) | [**Smiley-4.0.1.AppImage**](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.0.1.AppImage) | 0 |
| Linux (.deb) | [**Smiley-4.0.1.deb**](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-4.0.1.deb) | 0 |
<!-- DOWNLOADS_END -->

> **Needs:** Discord **desktop** app (not browser), macOS 11+ / Windows 10 (1809+) / Ubuntu 20.04+. [Full requirements →](docs/MINIMUM-REQUIREMENTS.md)

| | |
|---|---|
| **Windows** | Installer only (no portable) — Start menu + desktop shortcut |
| **macOS** | Apple Silicon (M1–M5) or Intel (pre-2020) DMG |
| **Linux** | AppImage (`chmod +x` then run) or `.deb` for Debian / Ubuntu / Mint |

### Low-end PC?

**[Smiley.Native](README-NATIVE.md)** — same Discord presence, no Electron, ~25 MB RAM.

---

## 🚀 Quick start

1. **Download** the installer for your OS ([table above](#-download)).
2. **Open Discord** — keep the **desktop** app running (browser tab won't work).
3. **Pick an activity** — launch Smiley, click a category, choose what you're up to. Profile updates instantly.

Smiley ships with a bundled Client ID. You don't touch the Developer Portal.

---

## 🎯 Features

| | | |
|---|---|---|
| **32+ activities** | 5 categories, search, keyboard shortcuts | **Favorites & recents** — your usual picks, one click away |
| **Custom activities** | Title, emoji, GIF — yours forever | **GIF picker** — swap animation per activity |
| **11 themes** | Dark, Sakura, Cyber, OLED Low Light… | **Curated anime GIFs** — matched in-app + on Discord |
| **Tray + hotkey** | Minimize to tray, `Cmd/Ctrl+Shift+S` | **Auto-update** — checks GitHub on startup |
| **Export/import** | Move settings between machines | **Friends can download** — "Download Smiley" on your presence card |

---

## 🔧 Troubleshooting

**Mac (ad-hoc signed):** in-app restart updates often fail — download the latest **DMG** from [GitHub Releases](https://github.com/1tsRajuWu/Smiley/releases/latest) for major updates.

<details>
<summary><strong>macOS says it "can't verify" Smiley</strong></summary>

That's Gatekeeper — the app isn't notarized yet. **Right-click → Open** the first time, or **System Settings → Privacy & Security → Open Anyway**. More: [INSTALL-MAC.md](INSTALL-MAC.md)

Still crashing? Re-download, then:

```bash
xattr -cr ~/Downloads/Smiley-*.dmg
xattr -cr /Applications/Smiley.app
```
</details>

<details>
<summary><strong>Windows SmartScreen blocked the installer</strong></summary>

Not code-signed yet — [source is public](https://github.com/1tsRajuWu/Smiley). Click **More info → Run anyway**.
</details>

<details>
<summary><strong>Portable .exe is gone</strong></summary>

v4.0 onward ships the **installer only** on Windows. Portable builds were dropped — use [Smiley-Setup-4.0.0.exe](https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-Setup-4.0.0.exe). Need something lighter? Try [Smiley.Native](README-NATIVE.md).
</details>

<details>
<summary><strong>Mac in-app update didn't work</strong></summary>

Smiley is **ad-hoc signed** (no Apple Developer ID yet). macOS Squirrel **ShipIt** validates code signatures when installing zip updates — ad-hoc builds usually fail with a "code signature … did not pass validation" error on **Restart**.

**What to do:** download the latest **DMG** from [Releases](https://github.com/1tsRajuWu/Smiley/releases/latest) and drag into Applications. The app will show a **Get update** button instead of Restart when it detects this.

Auto-update on macOS also needs the **.zip** artifact in the release (not just the DMG). If the download stalls, use the DMG manually.
</details>

<details>
<summary><strong>Discord shows "Disconnected"</strong></summary>

Discord **desktop** running? Not set to Invisible? Restart Discord, then Smiley.
</details>

<details>
<summary><strong>Image shows a <code>?</code> on Discord</strong></summary>

Bad or unreachable image URL. Custom uploads must be under 5 MB and HTTPS. Smiley falls back to [nekos.best](https://nekos.best) and [waifu.pics](https://waifu.pics) when needed.
</details>

---

## 💝 Support the developer

If Smiley's made your Discord profile more fun:

**[paypal.me/1tsRaj](https://paypal.me/1tsRaj)** — seriously, it helps.

---

## 🐛 Found a bug?

**[Open an issue](https://github.com/1tsRajuWu/Smiley/issues/new?template=bug_report.md&labels=bug)** — include your OS, Smiley version, and steps to reproduce. No GitHub account? Check the About tab in Settings for an email link.

---

## 🛠️ Building from source

For devs. Everyone else → [Download](#-download).

```bash
git clone https://github.com/1tsRajuWu/Smiley.git
cd Smiley
cp discord.app.example.json discord.app.json   # your Discord Application Client ID
npm install
npm start
```

```bash
npm run build:mac    # .dmg + .zip (x64 + arm64)
npm run build:win    # Windows installer (x64)
npm run build:linux  # AppImage + .deb (x64)
```

---

## Legal

**Smiley is NOT open source.** The source is visible on GitHub for transparency and official releases only — it is **not** licensed for reuse, forking, or redistribution.

| Allowed | Not allowed (without written permission) |
|---------|----------------------------------------|
| Download official releases for personal use | Fork, clone, mirror, or redistribute |
| Report bugs via Issues | Rebrand or rename and distribute |
| Optional PayPal donation | Remove copyright or branding |
| | Claim as your own work |
| | Commercial use or derivative builds |

**Official source only:** [github.com/1tsRajuWu/Smiley](https://github.com/1tsRajuWu/Smiley)

Found an unauthorized copy? [Report it via Issues](https://github.com/1tsRajuWu/Smiley/issues/new) — include the URL and details.

Full details: [LEGAL.md](LEGAL.md) · [LICENSE](LICENSE) · [NOTICE](NOTICE) · [Terms of Service](ToS.md) · [Privacy Policy](PRIVACY.md)

---

## 📄 License & credits

© 1tsRajuWu (Raj) — **All Rights Reserved**. See [LICENSE](LICENSE).

| | |
|---|---|
| Anime GIFs | [nekos.best](https://nekos.best), [waifu.pics](https://waifu.pics), curated Tenor |
| Discord RPC | [discord-rpc](https://github.com/discord/discord-rpc) |
| Desktop shell | [Electron](https://www.electronjs.org/) |

---

<div align="center">

**Smiley v4.0.0** — Discord Rich Presence · animated anime GIF status · Windows / macOS / Linux

Made with ♥ by [**Raj (1tsRajuWu)**](https://github.com/1tsRajuWu) · [About](docs/ABOUT.md) · [llms.txt](llms.txt)

[⬇️ Download](https://github.com/1tsRajuWu/Smiley/releases/latest) · [⭐ Review](https://github.com/1tsRajuWu/Smiley/issues/new?template=review.md&labels=review) · [🐛 Issues](https://github.com/1tsRajuWu/Smiley/issues) · [💝 PayPal](https://paypal.me/1tsRaj)

Enjoying Smiley? [Leave a review ⭐](https://github.com/1tsRajuWu/Smiley/issues/new?template=review.md&labels=review)

</div>

<!-- schema: SoftwareApplication name=Smiley author=Himanshu Raj(1tsRajuWu) category=Discord Rich Presence platforms=Windows,macOS,Linux download=https://github.com/1tsRajuWu/Smiley/releases/latest -->
