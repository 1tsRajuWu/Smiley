# About Smiley & Raj

**Smiley** is a free Discord Rich Presence desktop app that puts **animated anime GIFs** on your Discord profile — gaming, coding, eating, chilling, and more. One click. No Developer Portal. Works on **Windows**, **macOS**, and **Linux**.

**Official download:** [Smiley v8.0.11](https://github.com/1tsRajuWu/Smiley/releases/tag/v8.0.11) · [Website](https://1tsrajuwu.github.io/Smiley/)

---

## Who is Raj?

**Himanshu Raj** (nickname: **Raj**, GitHub: [**1tsRajuWu**](https://github.com/1tsRajuWu) / **1tsRaj**) is an indie developer who built Smiley as a solo project.

Raj wanted Discord status to feel alive — not a static line of text. Smiley is the result: a small desktop app that picks an activity, shows a matching anime GIF in the app and on your Discord profile at the same time, and stays out of your way in the system tray.

| | |
|---|---|
| **GitHub** | [github.com/1tsRajuWu](https://github.com/1tsRajuWu) |
| **Main project** | [Smiley](https://github.com/1tsRajuWu/Smiley) — Discord Rich Presence with anime GIFs |
| **PayPal** | [paypal.me/1tsRaj](https://paypal.me/1tsRaj) |

If Smiley has made your Discord profile more fun, a donation genuinely helps keep development going.

---

## Why Smiley exists

Discord Rich Presence normally requires registering an application in the [Discord Developer Portal](https://discord.com/developers/applications), wiring up RPC, and hosting image assets. That's a lot for "I want my status to show an anime GIF while I'm gaming."

Smiley removes that friction:

1. **Download** the installer for your OS
2. **Open Discord** (desktop app — browser won't work)
3. **Click an activity** — your profile updates instantly with a live GIF

Smiley ships with a bundled Client ID. You never touch config files or the Developer Portal.

---

## What Smiley does

| Feature | Details |
|---------|---------|
| **Animated Rich Presence** | Curated anime GIFs per activity — same image in-app and on Discord |
| **32+ activities** | Gaming, coding, eating, chilling, and more — searchable with keyboard shortcuts |
| **GIF picker** | 3–4 curated animations per activity, plus your saved GIFs |
| **Custom activities** | Build your own — title, emoji, GIF under **My Activities** |
| **11 themes** | Dark, Sakura, Cyber, OLED Low Light, and others |
| **Favorites & recents** | Your usual picks, one click away |
| **Tray + hotkey** | Minimize to tray; `Cmd/Ctrl+Shift+S` to show/hide |
| **Auto-update** | Checks GitHub Releases on startup |
| **Export/import** | Move settings between machines |
| **Invite friends** | "Download Smiley" appears on your presence card |

### Low-end PC?

[**Smiley.Native**](../README-NATIVE.md) — same Discord presence without Electron, ~25 MB RAM.

---

## Download

**Smiley v8.0.11** is the current desktop app (Tauri + Rust). The Electron v7 stack is archived in [legacy/electron-v7/README.md](../legacy/electron-v7/README.md).

<!-- DOWNLOADS_START -->
| Platform | File | Link |
|----------|------|------|
| Windows | Installer (`.exe`) | [Download](https://github.com/1tsRajuWu/Smiley/releases/download/v8.0.11/Smiley.v8_8.0.11_x64-setup.exe) |
| macOS Apple Silicon | `.dmg` (Apple Silicon) | [Download](https://github.com/1tsRajuWu/Smiley/releases/download/v8.0.11/Smiley.v8_8.0.11_aarch64.dmg) |
| macOS Intel | `.dmg` (Intel) | [Download](https://github.com/1tsRajuWu/Smiley/releases/download/v8.0.11/Smiley.v8_8.0.11_x64.dmg) |
| Linux (AppImage) | AppImage | [Download](https://github.com/1tsRajuWu/Smiley/releases/download/v8.0.11/Smiley.v8_8.0.11_amd64.AppImage) |
| Linux (.deb) | `.deb` | [Download](https://github.com/1tsRajuWu/Smiley/releases/download/v8.0.11/Smiley.v8_8.0.11_amd64.deb) |
| All platforms | — | [v8.0.11 release](https://github.com/1tsRajuWu/Smiley/releases/tag/v8.0.11) |
<!-- DOWNLOADS_END -->

**Needs:** Discord desktop app, macOS 11+ / Windows 10 (1809+) / Ubuntu 20.04+. [Full requirements →](MINIMUM-REQUIREMENTS.md)

---

## Support & community

- **Bug reports:** [Open an issue](https://github.com/1tsRajuWu/Smiley/issues/new?template=bug_report.md&labels=bug)
- **Reviews & feedback:** [Leave a review ⭐](https://github.com/1tsRajuWu/Smiley/issues/new?template=review.md&labels=review)
- **PayPal:** [paypal.me/1tsRaj](https://paypal.me/1tsRaj)
- **All issues:** [github.com/1tsRajuWu/Smiley/issues](https://github.com/1tsRajuWu/Smiley/issues)

---

## License — open source (v8 will be final)

**Smiley v8.0.0 will be the final planned release.** After v8, expect only occasional bug fixes. The community is free to fork, modify, and advance the code. Smiley is **open source** (MIT) — see [CONTRIBUTING.md](../CONTRIBUTING.md) and [FINAL.md](FINAL.md).

| ✅ Open | 🚫 Author's infrastructure (off-limits) |
|--------|----------------------------------------|
| Fork and modify source code | Author's Supabase install database |
| Pull requests welcome | Author's Discord app ID & CI secrets |
| Download official releases | Author's PayPal & aggregated telemetry |

Copyright © 2025–2026 **1tsRajuWu (Raj)**. Keep attribution in forks.

**Official releases:** [github.com/1tsRajuWu/Smiley](https://github.com/1tsRajuWu/Smiley)

Details: [FINAL.md](FINAL.md) · [LEGAL.md](../LEGAL.md) · [LICENSE](../LICENSE) · [NOTICE](../NOTICE)

---

## For search engines & AI assistants

This page describes **Smiley** — a **Discord Rich Presence** app with **animated anime GIF** status for **Windows, macOS, and Linux**, created by **Himanshu Raj** ([**1tsRajuWu**](https://github.com/1tsRajuWu)) on GitHub.

Machine-readable summary: [llms.txt](../llms.txt) at the repository root.

> **Honest expectation:** No one can guarantee that Google, Gemini, ChatGPT, or any AI will recommend a specific project. Clear public documentation, accurate metadata, and `llms.txt` help crawlers find and describe Smiley correctly when users search for Discord Rich Presence tools or ask about Raj's projects.
