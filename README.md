<!--
Smiley — Discord Rich Presence with animated anime GIF status.
Author: Himanshu Raj (1tsRajuWu). Site: https://1tsrajuwu.github.io/Smiley/
-->

<div align="center">

<img src="Smiley.v12/src/assets/icon.png" width="88" alt="Smiley" />

# Smiley

**Discord Rich Presence — beautifully animated.**

Pick an activity. Get an anime GIF on your profile. No Developer Portal. No config.

<br>

[![Download](https://img.shields.io/badge/Download-smiley.app-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://1tsrajuwu.github.io/Smiley/)
[![version](https://img.shields.io/github/v/release/1tsRajuWu/Smiley?style=flat-square&color=5865F2&label=v)](https://github.com/1tsRajuWu/Smiley/releases)
[![platform](https://img.shields.io/badge/Windows%20·%20macOS%20·%20Linux-1a1d27?style=flat-square)](https://1tsrajuwu.github.io/Smiley/)
[![downloads](https://img.shields.io/github/downloads/1tsRajuWu/Smiley/total?style=flat-square&color=57F287)](https://github.com/1tsRajuWu/Smiley/releases)

<br>

[Website](https://1tsrajuwu.github.io/Smiley/) · [Releases](https://github.com/1tsRajuWu/Smiley/releases) · [Issues](https://github.com/1tsRajuWu/Smiley/issues) · [Contribute](CONTRIBUTING.md)

</div>

---

## Project status

> **Smiley v12.0.0 is the final shipping release** — a clean rebuild consolidating stable v7 tray/updater/music patterns with the Tauri + Rust shell from v8. v8 and v7 trees are archived.

**Smiley v12.0.0** is the current desktop app — native Tauri + Rust. Previous stacks: [legacy/smiley-v8-archived/](legacy/smiley-v8-archived/) (v8), [legacy/electron-v7/](legacy/electron-v7/) (v7.9.x).

---

<details open>
<summary><strong>Smiley v12.0.0 — Direct downloads</strong></summary>

[![Windows](https://img.shields.io/badge/Windows-Setup.exe-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_x64-setup.exe)
[![macOS Apple Silicon](https://img.shields.io/badge/macOS_Apple_Silicon-Apple_Silicon-555555?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_aarch64.dmg)
[![macOS Intel](https://img.shields.io/badge/macOS_Intel-Intel-555555?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_x64.dmg)
[![Linux AppImage](https://img.shields.io/badge/Linux_AppImage-AppImage-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_amd64.AppImage)
[![Linux deb](https://img.shields.io/badge/Linux_deb-.deb-E95420?style=for-the-badge&logo=debian&logoColor=white)](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_amd64.deb)

| Platform | File |
|----------|------|
| Windows | [Smiley_12.0.0_x64-setup.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_x64-setup.exe) |
| macOS Apple Silicon | [Smiley_12.0.0_aarch64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_aarch64.dmg) |
| macOS Intel | [Smiley_12.0.0_x64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_x64.dmg) |
| Linux (AppImage) | [Smiley_12.0.0_amd64.AppImage](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_amd64.AppImage) |
| Linux (.deb) | [Smiley_12.0.0_amd64.deb](https://github.com/1tsRajuWu/Smiley/releases/download/v12.0.0/Smiley_12.0.0_amd64.deb) |

Release notes: [docs/releases/v12.0.0.md](docs/releases/v12.0.0.md)

**macOS:** If Gatekeeper blocks first launch, use **System Settings → Privacy & Security → Open Anyway**, or run `xattr -cr "/Applications/Smiley.app"` once after install.

</details>

<details>
<summary><strong>Quick start</strong></summary>

1. **Download** from [the website](https://1tsrajuwu.github.io/Smiley/) or links above.
2. **Open Discord** desktop (browser won't work).
3. **Pick an activity** — your profile updates with the same GIF.

</details>

<details>
<summary><strong>About v7.9.1 — Game logos on Discord presence (July 8, 2026)</strong></summary>

**v7.9.1** uses game logos for the Discord gaming presence large image; map, agent, and mode art appear as small-image overlays.

- **Game logos** — Discord no longer falls back to the Smiley app icon when contextual art 404s

| | |
|---|---|
| **Release notes** | [docs/releases/v7.9.1.md](docs/releases/v7.9.1.md) |
| **Changelog** | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| **Code** | Fork & PR — [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Support** | [paypal.me/1tsRaj](https://paypal.me/1tsRaj) |

</details>

<details>
<summary><strong>About v7.9.0 — Gaming Rich Presence UI (July 8, 2026)</strong></summary>

**v7.9.0** adds a full Gaming Rich Presence settings panel, Discord preview card, per-field toggles, optional Riot API rank, and a redesigned website.

- **Gaming Rich Presence** — customize mode, party, agent, score, rank, map art, elapsed time, K/D on Discord
- **Discord preview** — state pills + live session preview in Settings
- **v8 announced** — final planned release; community forks welcome ([docs/FINAL.md](docs/FINAL.md))

| | |
|---|---|
| **Release notes** | [docs/releases/v7.9.0.md](docs/releases/v7.9.0.md) |
| **Changelog** | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| **Code** | Fork & PR — [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Support** | [paypal.me/1tsRaj](https://paypal.me/1tsRaj) |

</details>

<details>
<summary><strong>About v7.8.3 — Valorant lobby presence (July 8, 2026)</strong></summary>

**v7.8.3** fixes Valorant showing fake in-match scores and blank images while in the PLAY lobby.

- **Lobby vs in-match** — `sessionLoopState` drives presence; no `0-0` in menus
- **Tracker-style text** — mode · party · state (lobby / agent select / live score)
- **Discord images** — corrected valorant-api gamemode/map UUIDs; lobby mode icon, pregame map, in-match agent

| | |
|---|---|
| **Release notes** | [docs/releases/v7.8.3.md](docs/releases/v7.8.3.md) |
| **Code** | Fork & PR — [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Support** | [paypal.me/1tsRaj](https://paypal.me/1tsRaj) |

</details>

<details>
<summary><strong>About v7.8.2 — gaming sync fixes (July 8, 2026)</strong></summary>

**v7.8.2** fixes gaming live sync bugs (Riot session override, party size, stale presence, poll timing, settings) on top of **v7.8.1** rich Discord presence for all games.

- **Riot session preserved** — lockfile data no longer replaced by foreground window titles
- **Valorant party size** — correct Duo/Trio/Full stack from `partySize` and `partyMembers`
- **Rich Discord presence** — HTTPS artwork for Valorant, LoL, Fortnite, Overwatch, Roblox, Minecraft
- **Settings** — gaming toggles save and apply immediately; cover art toggle refreshes live

| | |
|---|---|
| **Release notes** | [docs/releases/v7.8.2.md](docs/releases/v7.8.2.md) |
| **Code** | Fork & PR — [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Support** | [paypal.me/1tsRaj](https://paypal.me/1tsRaj) |

</details>

<details>
<summary><strong>Features</strong></summary>

- 32+ activities · anime GIFs · custom activities
- Live game sync · Valorant & LoL · Steam cover art on Discord
- Activity profiles · auto-rotate favorites · pause/resume
- 11 themes · tray icon · hotkeys · auto-update
- macOS Music & Spotify sync
- Low RAM? [Smiley.Native](README-NATIVE.md) (~25 MB)

</details>

<details>
<summary><strong>Developers</strong></summary>

New here? [docs/CODE-TOUR.md](docs/CODE-TOUR.md) · [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md)

```bash
git clone https://github.com/1tsRajuWu/Smiley.git && cd Smiley/Smiley.v12
npm install && npm run tauri dev
```

Archived Electron v7:

```bash
cd legacy/electron-v7
cp discord.app.example.json discord.app.json
npm install && npm start
```

v7 release builds:

```bash
cd legacy/electron-v7
npm run build:mac    # .dmg
npm run build:win    # installer
npm run build:linux  # AppImage + .deb
```

</details>

<details>
<summary><strong>Legal & support</strong></summary>

[LICENSE](LICENSE) · [Privacy](PRIVACY.md) · [Terms](ToS.md) · [Security](SECURITY.md)

Support: [paypal.me/1tsRaj](https://paypal.me/1tsRaj)

</details>

---

<div align="center">

Made by [**Raj (1tsRajuWu)**](https://github.com/1tsRajuWu)

<sub>Archived Electron v7.9.x source and old installers: [legacy/electron-v7/README.md](legacy/electron-v7/README.md)</sub>

</div>

<!-- schema: SoftwareApplication name=Smiley author=Himanshu Raj(1tsRajuWu) category=Discord Rich Presence platforms=Windows,macOS,Linux download=https://1tsrajuwu.github.io/Smiley/ -->
