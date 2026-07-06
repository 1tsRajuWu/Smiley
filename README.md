# Smiley

**Discord Rich Presence with animated anime characters**

by **Raj ([@1tsRaj](https://github.com/1tsRaj))**

![Version](https://img.shields.io/badge/version-2.1.5-blue) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

> **Official repository** — [github.com/1tsRajuWu/Smiley](https://github.com/1tsRajuWu/Smiley)  
> Forks, reuploads, and rebranded copies are **not authorized**. Download releases from this repo only.

---

## Download Smiley

**Pick your platform** — requires [Discord desktop](https://discord.com/download) (not mobile). No setup needed for end users.

> **Get Smiley:** open **[Releases](https://github.com/1tsRajuWu/Smiley/releases/latest)** on GitHub, pick **v2.1.5**, and download the file for your OS from **Assets** (scroll below the release notes).  
> Direct links below work once that release is published. If a link 404s, use the Releases page — do not use unofficial mirrors.

<p align="center">
  <a href="https://github.com/1tsRajuWu/Smiley/releases/latest">
    <img src="https://img.shields.io/github/v/release/1tsRajuWu/Smiley?label=Latest%20release&style=for-the-badge" alt="Latest GitHub release" />
  </a>
  &nbsp;
  <a href="https://github.com/1tsRajuWu/Smiley/releases">
    <img src="https://img.shields.io/badge/All%20downloads-Releases%20tab-181717?style=for-the-badge&logo=github&logoColor=white" alt="All releases on GitHub" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-Setup-2.1.5.exe">
    <img src="https://img.shields.io/badge/Windows%20Installer-Download-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Download Windows installer" />
  </a>
  &nbsp;
  <a href="https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-Portable-2.1.5.exe">
    <img src="https://img.shields.io/badge/Windows%20Portable-Download-5E5E5E?style=for-the-badge&logo=windows&logoColor=white" alt="Download Windows portable" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-2.1.5-arm64.dmg">
    <img src="https://img.shields.io/badge/macOS%20Apple%20Silicon-Download-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download macOS Apple Silicon" />
  </a>
  &nbsp;
  <a href="https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-2.1.5-x64.dmg">
    <img src="https://img.shields.io/badge/macOS%20Intel-Download-555555?style=for-the-badge&logo=apple&logoColor=white" alt="Download macOS Intel" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/1tsRajuWu/Smiley/releases/latest/download/Smiley-2.1.5.AppImage">
    <img src="https://img.shields.io/badge/Linux%20AppImage-Download-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Download Linux AppImage" />
  </a>
  &nbsp;
  <a href="https://github.com/1tsRajuWu/Smiley/releases/latest/download/smiley-rpc_2.1.5_amd64.deb">
    <img src="https://img.shields.io/badge/Linux%20.deb-Download-E95420?style=for-the-badge&logo=ubuntu&logoColor=white" alt="Download Linux deb" />
  </a>
</p>

### All downloads (Electron — full app)

| Platform | File name | Download |
|----------|-----------|----------|
| **Windows** | `Smiley-Setup-2.1.5.exe` | [Installer (x64)](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.5/Smiley-Setup-2.1.5.exe) |
| **Windows** | `Smiley-Portable-2.1.5.exe` | [Portable (x64)](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.5/Smiley-Portable-2.1.5.exe) |
| **Windows** | `Smiley-Setup-2.1.5-ia32.exe` | [Installer (32-bit)](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.5/Smiley-Setup-2.1.5-ia32.exe) |
| **macOS** | `Smiley-2.1.5-arm64.dmg` | [Apple Silicon .dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.5/Smiley-2.1.5-arm64.dmg) |
| **macOS** | `Smiley-2.1.5-x64.dmg` | [Intel .dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.5/Smiley-2.1.5-x64.dmg) |
| **macOS** | `Smiley-2.1.5-arm64-mac.zip` · `Smiley-2.1.5-mac.zip` | [arm64 zip](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.5/Smiley-2.1.5-arm64-mac.zip) · [Intel zip](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.5/Smiley-2.1.5-mac.zip) |
| **Linux** | `Smiley-2.1.5.AppImage` | [AppImage](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.5/Smiley-2.1.5.AppImage) |
| **Linux** | `smiley-rpc_2.1.5_amd64.deb` | [.deb](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.5/smiley-rpc_2.1.5_amd64.deb) |

> **First launch on macOS?** Right-click the app → **Open** (unsigned build).  
> **Windows SmartScreen?** Click **More info** → **Run anyway**.

### Publishing releases (maintainers)

CI builds and uploads installers when you push a version tag (see [.github/workflows/release.yml](.github/workflows/release.yml)):

```bash
git tag v2.1.5 && git push origin v2.1.5
```

To upload built files from `dist/` manually (install [GitHub CLI](https://cli.github.com/) first):

```bash
gh release create v2.1.5 --title "v2.1.5" --notes "Smiley v2.1.5"
gh release upload v2.1.5 dist/Smiley-Setup-2.1.5.exe dist/Smiley-Portable-2.1.5.exe \
  dist/Smiley-2.1.5-arm64.dmg dist/Smiley-2.1.5-x64.dmg dist/Smiley-2.1.5.AppImage dist/smiley-rpc_2.1.5_amd64.deb
```

Older portable builds used a space in the filename (`Smiley 2.x.x.exe`); current builds use `Smiley-Portable-{version}.exe` (no encoding needed).

### Smiley Native — lightweight (~25 MB)

For **low-end PCs** — same Discord presence, much smaller download. Native builds are attached to releases when available; otherwise build from [README-NATIVE.md](README-NATIVE.md).

| Platform | File name | Download |
|----------|-----------|----------|
| **Windows x64** | `Smiley-Native-win-x64.zip` | [Releases → Assets](https://github.com/1tsRajuWu/Smiley/releases/latest) |
| **macOS Apple Silicon** | `Smiley-Native-osx-arm64.zip` | [Releases → Assets](https://github.com/1tsRajuWu/Smiley/releases/latest) |
| **macOS Intel** | `Smiley-Native-osx-x64.zip` | [Releases → Assets](https://github.com/1tsRajuWu/Smiley/releases/latest) |
| **Linux x64** | `Smiley-Native-linux-x64.tar.gz` | [Releases → Assets](https://github.com/1tsRajuWu/Smiley/releases/latest) |

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
