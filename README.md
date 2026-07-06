# Smiley

Discord Rich Presence with animated anime GIFs on your profile.

[![release](https://img.shields.io/github/v/release/1tsRajuWu/Smiley)](https://github.com/1tsRajuWu/Smiley/releases/latest)
![Windows](https://img.shields.io/badge/Windows-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)

**[Download latest](https://github.com/1tsRajuWu/Smiley/releases/latest)** — [Windows](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-Setup-2.1.8.exe) · [Mac ARM](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-2.1.8-arm64.dmg) · [Mac Intel](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-2.1.8-x64.dmg) · [Linux](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-2.1.8.AppImage)

Needs the **Discord desktop app**. Mobile won't work.

---

## What it does

- Sets your Discord status with anime GIFs (eating, gaming, coding, etc.)
- 11 themes, system tray, global hotkey, session timer
- Auto-updates from GitHub on launch
- Discord client ID is bundled — just download and run

## Download

| Platform | File |
|----------|------|
| Windows (installer) | [Smiley-Setup-2.1.8.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-Setup-2.1.8.exe) |
| Windows (portable) | [Smiley-Portable-2.1.8.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-Portable-2.1.8.exe) |
| macOS Apple Silicon | [Smiley-2.1.8-arm64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-2.1.8-arm64.dmg) |
| macOS Intel | [Smiley-2.1.8-x64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-2.1.8-x64.dmg) |
| Linux AppImage | [Smiley-2.1.8.AppImage](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-2.1.8.AppImage) |
| Linux .deb | [Smiley-2.1.8.deb](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.8/Smiley-2.1.8.deb) |

## macOS "damaged file"?

Gatekeeper blocks unsigned downloads. Run this, then right-click → Open:

```bash
xattr -cr ~/Downloads/Smiley-*.dmg
```

## Discord setup (for devs building from source only)

Releases ship with a bundled client ID. If you're cloning the repo:

```bash
cp discord.app.example.json discord.app.json   # add your Client ID
npm install && npm start
```

## Support

If Smiley's been useful: **[paypal.me/1tsRaj](https://paypal.me/1tsRaj)** — link is locked in-app, thanks.

## License

All rights reserved. Raj ([@1tsRaj](https://github.com/1tsRaj)). See [LICENSE](LICENSE).

[Terms](ToS.md) · [Privacy](PRIVACY.md)
