# GitHub Release body template

Copy into `docs/releases/v{VERSION}.md` before tagging. CI writes the file to the GitHub Release automatically via `write-release-notes` job.

---

## Smiley v{VERSION} 🎉

**Discord Rich Presence with animated anime GIFs** — one click, live status, no Developer Portal.

Made by [@1tsRaj](https://github.com/1tsRaj).

### What's new

<!-- Pick what shipped — delete the rest -->

- 🎨 **Custom activities** — build your own title, emoji, and GIF
- 🖼️ **GIF picker** — swap animations per activity
- 📋 **Activity profiles** — save favorite combos as named presets
- 🔄 **Auto-rotate favorites** — cycle starred activities on a timer
- ⏸ **Pause / resume** — hide Discord status without losing your pick
- ⌨️ **Favorite hotkeys** — Cmd/Ctrl+Shift+1–9
- 📊 **Session stats** — track time per activity
- 🎬 **Curated anime animations** — matched in-app and on Discord
- 🌓 **Theme-aware logo** — header icon follows your theme
- 🐛 Bug fixes and polish

### ⬇️ Download

#### Windows
- **[Installer (.exe)](https://github.com/1tsRajuWu/Smiley/releases/download/v{VERSION}/Smiley-Setup-{VERSION}.exe)** — recommended

#### macOS
- **[Apple Silicon (.dmg)](https://github.com/1tsRajuWu/Smiley/releases/download/v{VERSION}/Smiley-{VERSION}-arm64.dmg)** — M1–M5
- **[Intel Mac (.dmg)](https://github.com/1tsRajuWu/Smiley/releases/download/v{VERSION}/Smiley-{VERSION}-x64.dmg)**
- [arm64 .zip](https://github.com/1tsRajuWu/Smiley/releases/download/v{VERSION}/Smiley-{VERSION}-arm64-mac.zip) · [Intel .zip](https://github.com/1tsRajuWu/Smiley/releases/download/v{VERSION}/Smiley-{VERSION}-mac.zip) — needed for in-app auto-update on Mac

#### Linux
- **[AppImage](https://github.com/1tsRajuWu/Smiley/releases/download/v{VERSION}/Smiley-{VERSION}.AppImage)**
- **[.deb](https://github.com/1tsRajuWu/Smiley/releases/download/v{VERSION}/Smiley-{VERSION}.deb)**

### Before you install

- Discord **desktop** app open (not Invisible)
- **OS:** macOS 11+, Windows 10 (1809+) / 11, Linux Ubuntu 20.04+ — [requirements](docs/MINIMUM-REQUIREMENTS.md)

### macOS Gatekeeper?

Right-click → **Open** the first time, or **System Settings → Privacy & Security → Open Anyway**. [INSTALL-MAC.md](INSTALL-MAC.md)

### 💝 Enjoying Smiley?

[PayPal — paypal.me/1tsRaj](https://paypal.me/1tsRaj)

---

**Full changelog:** commits between tags.

<!--
Dev-only assets (do NOT put in README):
- Android APK: Smiley-{VERSION}-android-debug.apk
-->
