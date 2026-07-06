# Smiley

**Discord Rich Presence with animated anime characters**

by **Raj ([@1tsRaj](https://github.com/1tsRaj))**

![Version](https://img.shields.io/badge/version-2.1.7-blue) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

> **Official repository** — [github.com/1tsRajuWu/Smiley](https://github.com/1tsRajuWu/Smiley)  
> Forks, reuploads, and rebranded copies are **not authorized**. Download releases from this repo only.

---

## Download Smiley

**Requires [Discord desktop](https://discord.com/download)** (not mobile). Pick your OS below.

> **Current release:** **[v2.1.7 (pre-release) → Assets](https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7)** — macOS `.dmg` installers are attached; Windows/Linux Electron builds are not on this release yet.  
> Direct macOS buttons below use the **v2.1.7** tag URLs (GitHub `/releases/latest` does not point at pre-releases).

<p align="center">
  <a href="https://github.com/1tsRajuWu/Smiley/releases">
    <img src="https://img.shields.io/github/v/release/1tsRajuWu/Smiley?label=Download%20latest&style=for-the-badge" alt="Latest GitHub release" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7">
    <img src="https://img.shields.io/badge/Windows%20Installer-Download-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Windows installer" />
  </a>
  &nbsp;
  <a href="https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7">
    <img src="https://img.shields.io/badge/Windows%20Portable-Download-5E5E5E?style=for-the-badge&logo=windows&logoColor=white" alt="Windows portable" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.7/Smiley-2.1.7-arm64.dmg">
    <img src="https://img.shields.io/badge/macOS%20Apple%20Silicon-Download-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS Apple Silicon" />
  </a>
  &nbsp;
  <a href="https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.7/Smiley-2.1.7-x64.dmg">
    <img src="https://img.shields.io/badge/macOS%20Intel-Download-555555?style=for-the-badge&logo=apple&logoColor=white" alt="macOS Intel" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7">
    <img src="https://img.shields.io/badge/Linux%20AppImage-Download-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux AppImage" />
  </a>
  &nbsp;
  <a href="https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7">
    <img src="https://img.shields.io/badge/Linux%20.deb-Download-E95420?style=for-the-badge&logo=ubuntu&logoColor=white" alt="Linux deb" />
  </a>
</p>

### All downloads (Electron)

| Platform | File | Link |
|----------|------|------|
| macOS ARM | `Smiley-2.1.7-arm64.dmg` | [.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.7/Smiley-2.1.7-arm64.dmg) |
| macOS Intel | `Smiley-2.1.7-x64.dmg` | [.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.7/Smiley-2.1.7-x64.dmg) |
| macOS (auto-update) | `latest-mac.yml` | [metadata](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.7/latest-mac.yml) |
| Windows / Linux | — | [v2.1.7 release assets](https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7) (not uploaded yet) |

> **macOS:** Right-click → **Open** if unsigned. **Windows:** **More info** → **Run anyway** if SmartScreen warns.

### macOS says "damaged and can't be opened"?

This usually means **Gatekeeper** blocked an unsigned download (the DMG is fine). Try:

```bash
# After downloading the DMG (before opening):
xattr -cr ~/Downloads/Smiley-*.dmg

# Or after copying Smiley.app to Applications:
xattr -cr /Applications/Smiley.app
```

Then **right-click → Open** the first time (do not double-click). Smiley v2.1.8+ builds are ad-hoc signed to reduce this issue.

### Auto-updates

Installed Smiley checks **GitHub Releases** on launch. Use **Settings → Check for Updates** anytime. **v2.1.7** ships [`latest-mac.yml`](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.7/latest-mac.yml) for macOS; `latest.yml` / `latest-linux.yml` are added when Windows/Linux builds are uploaded.

### Publishing (maintainers)

```bash
git tag v2.1.7 && git push origin main && git push origin v2.1.7
```

Add repo secret **`DISCORD_CLIENT_ID`** = `1522538045989982279` for CI builds.

Manual upload from `dist/`:

```bash
gh release create v2.1.7 --repo 1tsRajuWu/Smiley --title "Smiley v2.1.7" --notes "Bug fixes: update checker, download links"
gh release upload v2.1.7 --repo 1tsRajuWu/Smiley \
  dist/Smiley-Setup-2.1.7.exe dist/Smiley-Portable-2.1.7.exe \
  dist/Smiley-2.1.7-arm64.dmg dist/Smiley-2.1.7-x64.dmg \
  dist/Smiley-2.1.7.AppImage dist/Smiley-2.1.7.deb \
  dist/latest-mac.yml dist/latest.yml dist/latest-linux.yml
```

### Smiley Native — lightweight (~25 MB)

For **low-end PCs** — same Discord presence, much smaller download. Native builds are attached to releases when available; otherwise build from [README-NATIVE.md](README-NATIVE.md).

| Platform | File name | Download |
|----------|-----------|----------|
| **Windows x64** | `Smiley-Native-win-x64.zip` | [Releases → Assets](https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7) |
| **macOS Apple Silicon** | `Smiley-Native-osx-arm64.zip` | [Releases → Assets](https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7) |
| **macOS Intel** | `Smiley-Native-osx-x64.zip` | [Releases → Assets](https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7) |
| **Linux x64** | `Smiley-Native-linux-x64.tar.gz` | [Releases → Assets](https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.7) |

⚠️ Do not download Smiley from unofficial mirrors — they may be modified or unsafe.

---

## What is Smiley?

Smiley is a desktop companion app that sets your **Discord Rich Presence** — show friends you're eating 🍕, gaming 🎮, coding 💻, or chilling 😌 with cute animated GIFs on your profile.

Built by **Raj** for the Discord community.

## Features

- 🎨 **Animated presence** — anime GIFs on your Discord profile (eating, gaming, coding, and more)
- 🌙 **11 colour themes** — including Low Light OLED mode
- ⚡ **Smiley Native** — lightweight .NET build (~25MB) for low-end PCs
- 🖥️ **Smiley Electron** — full UI with custom animation uploads (~100MB)
- 🔒 **Pre-configured** — no Discord setup needed for users
- ⌨️ **Global hotkey**, system tray, session timer, **auto-updates**

## Two Versions

| | **Smiley Native** | **Smiley (Electron)** |
|---|---|---|
| Size | ~25MB | ~100–150MB |
| Best for | Low-end PCs | Full features + custom uploads |
| Build | [README-NATIVE.md](README-NATIVE.md) | `npm run build` |

## Quick Start (developers)

```bash
git clone https://github.com/1tsRajuWu/Smiley.git
cd Smiley
cp discord.app.example.json discord.app.json   # add your Client ID for local dev
npm install
npm start
```

End users: use the **Download** buttons above — no setup required.

## Support Raj

If you enjoy Smiley, consider supporting development:

**[💝 PayPal — paypal.me/1tsRaj](https://paypal.me/1tsRaj)** *(link cannot be changed in-app)*

## License

**Proprietary — All Rights Reserved**

Copyright © 2025–2026 Raj ([@1tsRaj](https://github.com/1tsRaj)).

See [LICENSE](LICENSE) and [NOTICE](NOTICE). You may use official releases for personal, non-commercial use. Copying, redistributing, modifying, or selling this software without written permission is prohibited.

## Legal

- [Terms of Service](ToS.md)
- [Privacy Policy](PRIVACY.md)

---

**© 2025–2026 Raj ([@1tsRaj](https://github.com/1tsRaj)) — All Rights Reserved**

Official repo: https://github.com/1tsRajuWu/Smiley
