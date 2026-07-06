# Smiley

> Set your Discord status with one click. Pick what you're doing — eating, gaming, coding — and it shows on your profile with a live GIF.

[![release](https://img.shields.io/github/v/release/1tsRajuWu/Smiley)](https://github.com/1tsRajuWu/Smiley/releases/latest)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](#installing-smiley)
[![license](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey)](LICENSE)

**[Download latest](https://github.com/1tsRajuWu/Smiley/releases/latest)** · [Report a bug](https://github.com/1tsRajuWu/Smiley/issues) · [Smiley.Native](README-NATIVE.md) (lightweight build)

---

## Quick start

Three steps. No Discord Developer Portal setup for normal users.

| Step | What to do |
|------|------------|
| **1. Download** | Grab the installer for your OS from [Releases](https://github.com/1tsRajuWu/Smiley/releases/latest) (see [Installing Smiley](#installing-smiley)). |
| **2. Install** | Run the installer (or make the AppImage executable). Open **Discord desktop** — not the browser tab, not mobile. |
| **3. Pick an activity** | Launch Smiley, choose a category, click an activity. Your profile updates with text + animated image. |

Smiley ships with a bundled Discord Client ID. Download, run, pick something — that's it.

---

## Download (v2.1.10)

| Platform | File | Notes |
|----------|------|-------|
| **Windows** (installer) | [Smiley-Setup-2.1.10.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Setup-2.1.10.exe) | Recommended. Start menu + desktop shortcut. |
| **Windows** (portable) | [Smiley-Portable-2.1.10.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Portable-2.1.10.exe) | No install — run from anywhere. |
| **macOS** Apple Silicon | [Smiley-2.1.10-arm64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-2.1.10-arm64.dmg) | M1/M2/M3/M4. [Install help](#installing-smiley) |
| **macOS** Intel | [Smiley-2.1.10-x64.dmg](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-2.1.10-x64.dmg) | Pre-2020 Intel. [Install help](#installing-smiley) |
| **Linux** AppImage | [Smiley-2.1.10.AppImage](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-2.1.10.AppImage) | `chmod +x` then run. Most distros. |
| **Linux** .deb | [Smiley-2.1.10.deb](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-2.1.10.deb) | Debian / Ubuntu / derivatives. |

**One-click buttons**

[Windows installer](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Setup-2.1.10.exe) · [Windows portable](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Portable-2.1.10.exe) · [Mac ARM](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-2.1.10-arm64.dmg) · [Mac Intel](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-2.1.10-x64.dmg) · [Linux AppImage](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-2.1.10.AppImage) · [Linux .deb](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-2.1.10.deb)

---

## Installing Smiley

Step-by-step for Windows 10/11, macOS (Sonoma, Sequoia, Tahoe), and Linux. Full macOS detail also in [INSTALL-MAC.md](INSTALL-MAC.md).

### Requirements (all platforms)

- **Discord desktop app** open — not the browser tab, not mobile
- **Internet** for GIF images (nekos.best / waifu.pics)
- **Not Invisible** on Discord (invisible hides your presence)

---

### macOS (Sonoma, Sequoia, Tahoe)

1. Download the `.dmg` for your chip — ARM64 for Apple Silicon, x64 for Intel.
2. Open the DMG and drag **Smiley** into **Applications**.
3. Launch Smiley (see below if macOS blocks it).

The DMG includes **INSTALL.txt** with the same steps.

#### If Gatekeeper blocks (malware warning)

macOS may show:

> **Smiley Not Opened** — Apple could not verify Smiley is free of malware…

This is **not** a damaged file. Smiley is ad-hoc signed but not notarized (no Apple Developer certificate yet). The app is safe and [open source](https://github.com/1tsRajuWu/Smiley). You only approve it once.

**Option A — Right-click Open (easiest)**

1. Go to **Applications**.
2. **Right-click Smiley → Open** (don't double-click).
3. Click **Open** in the dialog.
4. After the first launch, double-click works.

**Option B — System Settings**

1. **System Settings → Privacy & Security**
2. Scroll down — **Smiley was blocked** → click **Open Anyway**
3. Confirm.

#### If "cannot be opened because of a problem" (crash)

That dialog means the app **crashed on launch**, not Gatekeeper. Try this:

1. Delete Smiley from Applications.
2. Re-download the latest build from [Releases](https://github.com/1tsRajuWu/Smiley/releases/latest).
3. Run the terminal fix below, then install and open again.
4. Still crashing? Try **[Smiley.Native](README-NATIVE.md)** — lighter build, no Chromium.
5. [Open an issue](https://github.com/1tsRajuWu/Smiley/issues) with your macOS version (e.g. macOS 15.5).

#### Terminal fix

Clears quarantine flags that sometimes break Electron apps:

```bash
xattr -cr ~/Downloads/Smiley-*.dmg
xattr -cr /Applications/Smiley.app
```

Or from a cloned repo: `./scripts/install-mac.sh /Applications/Smiley.app`

---

### Windows 10 & 11

1. Download [Smiley-Setup-2.1.10.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Setup-2.1.10.exe).
2. Run the installer.
3. If **SmartScreen** says "Windows protected your PC" → **More info** → **Run anyway** (app is not code-signed yet).
4. Launch Smiley from Start or the desktop shortcut. Keep **Discord desktop** running.

**Portable (no install):** download [Smiley-Portable-2.1.10.exe](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Portable-2.1.10.exe) and double-click it.

---

### Linux (Ubuntu 22.04+, Fedora, etc.)

**AppImage** (works on most distros):

```bash
chmod +x Smiley-2.1.10.AppImage
./Smiley-2.1.10.AppImage
```

**Debian / Ubuntu (.deb):**

```bash
sudo dpkg -i Smiley-2.1.10.deb
```

Launch from your app menu. Discord must be the **desktop** client (`.deb`, Flatpak, or native — not web-only).

---

## Features

**Activity picker**
- Five categories: Food, Gaming, Chill, Work, Social — 32 presets total
- Search bar to filter by name or emoji
- Live preview card before it hits Discord
- Session timer (elapsed time since you picked an activity)

**Animated Discord presence**
- Large profile image is a live GIF fetched from [nekos.best](https://nekos.best) and [waifu.pics](https://waifu.pics) (SFW community APIs)
- Verified HTTPS fallbacks if an API is slow or down — avoids Discord's `?` placeholder
- Upload your own GIF/image in Settings → Animations (PNG, JPG, GIF, WebP, SVG, max 5 MB)

**Appearance**
- 11 colour themes: Dark, Midnight, Ocean, Sakura, **Low Light** (OLED-friendly deep black), Sunset, Forest, Lavender, Cyber, Coffee, Rose
- Toggle session timer visibility

**System integration**
- System tray icon with quick actions (show window, clear status, check updates, quit)
- Minimize to tray on close (default on)
- Global hotkey **Cmd/Ctrl + Shift + S** to show/hide the window
- Optional start on system login
- Export / import settings JSON

**Updates**
- Packaged builds auto-check [GitHub Releases](https://github.com/1tsRajuWu/Smiley/releases) on launch
- Background download + "Restart to update" prompt
- Manual check from Settings or tray menu

**Smiley.Native** (~25–70 MB trimmed)
- Avalonia/.NET alternative for low-end PCs — same activities, less RAM
- See [README-NATIVE.md](README-NATIVE.md)

**Support link**
- PayPal donate banner is fixed to [paypal.me/1tsRaj](https://paypal.me/1tsRaj) in the app (not user-editable)

---

## Screenshots

<!-- Add screenshots to docs/screenshots/ and uncomment paths below -->

| Main window | Activity picker | Discord profile |
|-------------|-----------------|-----------------|
| <!-- ![Main window](docs/screenshots/main-window.png) --> *coming soon* | <!-- ![Activities](docs/screenshots/activity-picker.png) --> *coming soon* | <!-- ![Discord profile](docs/screenshots/discord-profile.png) --> *coming soon* |

| Settings | Themes | System tray |
|----------|--------|-------------|
| <!-- ![Settings](docs/screenshots/settings.png) --> *coming soon* | <!-- ![Themes](docs/screenshots/themes.png) --> *coming soon* | <!-- ![Tray](docs/screenshots/tray.png) --> *coming soon* |

---

## macOS won't open? (quick link)

See **[Installing Smiley → macOS](#macos-sonoma-sequoia-tahoe)** for Gatekeeper blocks, crash-on-launch fixes, and terminal commands. Full guide: [INSTALL-MAC.md](INSTALL-MAC.md).

---

## Discord presence

### How it works

Smiley talks to the **Discord desktop app** over local IPC — the same mechanism games use for Rich Presence. Both apps must be running on the same machine.

| Requirement | Why |
|-------------|-----|
| Discord **desktop** app open | Browser Discord and mobile cannot receive IPC from Smiley |
| Not Invisible | Discord hides presence when you're invisible |
| Packaged Smiley build | `npm start` dev builds work too, but releases are what most users need |

### What shows on your profile

| Field | Example |
|-------|---------|
| **Details** (top line) | `Coding` |
| **State** (second line) | `Building something cool` |
| **Large image** | Animated anime GIF (HTTPS URL from nekos.best / waifu.pics) |
| **Timer** | Elapsed time since you selected the activity (if enabled) |
| **App name** | Smiley |

Friends see this on your profile card and in the member list. Click **Clear** in Smiley (or tray → Clear Status) to remove it.

---

## Settings

Open via the gear icon or tray → **Settings**.

| Tab | Options |
|-----|---------|
| **General** | Auto-connect on launch, minimize to tray on close, check for updates |
| **Appearance** | Show/hide session timer, pick from 11 themes |
| **Animations** | Enable/disable anime GIFs, upload custom animation |
| **Advanced** | Start on login, global hotkey toggle, export/import settings |
| **About** | Version, support link, Terms & Privacy |

Hit **Save & Connect** to apply. Discord connection status shows in the header pill (green = connected).

---

## Auto-updates

For users who installed from a **packaged** build (`.exe`, `.dmg`, AppImage, `.deb`):

1. On launch, Smiley checks GitHub Releases (~5 seconds after open).
2. If a newer version exists, it downloads in the background.
3. A banner and dialog ask you to **Restart to update**.
4. Restart installs the new version — no manual re-download.

You can also trigger a check from **Settings → Check for Updates** or the tray menu.

> Dev builds (`npm start`) do not auto-update. Clone the repo and pull instead.

See [docs/RELEASING.md](docs/RELEASING.md) for the maintainer release workflow.

---

## Smiley.Native (optional)

Low on RAM or disk space? Use **[Smiley.Native](README-NATIVE.md)** — a .NET + Avalonia build with the same Discord RPC and activity list, but without Chromium.

| | Electron (this repo) | Smiley.Native |
|---|---------------------|---------------|
| Download size | ~150 MB+ | ~25–70 MB trimmed |
| RAM | Higher | Lower |
| Custom GIF upload | Yes | No |
| Auto-update | Yes | Opens Releases page if newer |

---

## Building from source

For developers only. End users should use [Releases](https://github.com/1tsRajuWu/Smiley/releases).

**Requirements:** Node.js 18+, npm, Discord desktop app

```bash
git clone https://github.com/1tsRajuWu/Smiley.git
cd Smiley
cp discord.app.example.json discord.app.json   # add your Discord Application Client ID
npm install
npm start
```

`discord.app.json` needs a Client ID from the [Discord Developer Portal](https://discord.com/developers/applications). **Releases bundle this for you** — you only need your own ID when building locally.

```bash
npm run build:mac    # macOS .dmg
npm run build:win    # Windows .exe
npm run build:linux  # AppImage + .deb
```

---

## Releasing (for maintainer)

Tagged pushes trigger GitHub Actions to build and publish installers.

See **[docs/RELEASING.md](docs/RELEASING.md)** for the full checklist (version bump, tag, CI secrets, release notes template).

---

## Support

If Smiley's been useful:

**[paypal.me/1tsRaj](https://paypal.me/1tsRaj)**

The donate link in the app is locked to this URL. Thanks for supporting development.

---

## License & credits

© Raj ([@1tsRaj](https://github.com/1tsRaj)) — **All Rights Reserved**. See [LICENSE](LICENSE).

| Resource | Credit |
|----------|--------|
| Anime GIFs | [nekos.best](https://nekos.best), [waifu.pics](https://waifu.pics) — community SFW APIs |
| Discord RPC | [discord-rpc](https://github.com/discord/discord-rpc) |
| Desktop shell | [Electron](https://www.electronjs.org/) |

[Terms of Service](ToS.md) · [Privacy Policy](PRIVACY.md)

---

## FAQ

<details>
<summary><strong>Why does Discord show a <code>?</code> for the image?</strong></summary>

Usually a bad or unreachable image URL. Smiley resolves GIFs from nekos.best and waifu.pics with verified HTTPS fallbacks. If you still see `?`, check your internet, wait a few seconds, or pick a different activity. Custom uploads must be under 5 MB and a supported format.
</details>

<details>
<summary><strong>Why won't macOS open Smiley?</strong></summary>

Smiley isn't <strong>notarized</strong> by Apple yet (no Developer certificate). macOS 13+ may show "Apple could not verify…" — not a damaged file. See <a href="#installing-smiley">Installing Smiley</a> and <a href="INSTALL-MAC.md">INSTALL-MAC.md</a>.
</details>

<details>
<summary><strong>Can I use this on my phone?</strong></summary>

No. Discord Rich Presence over IPC requires the <strong>desktop</strong> Discord client on the same computer. Mobile Discord cannot receive presence from Smiley. See <code>mobile/README.md</code> for details.
</details>

<details>
<summary><strong>Do I need a Discord Client ID?</strong></summary>

Not for releases — it's bundled. Only needed if you clone the repo and run <code>npm start</code>. Copy <code>discord.app.example.json</code> → <code>discord.app.json</code> and paste your Application ID from the Discord Developer Portal.
</details>

<details>
<summary><strong>Discord says "Disconnected" in Smiley</strong></summary>

Make sure the Discord <strong>desktop</strong> app is running (not just a browser tab), you're not Invisible, and no other app is hogging the RPC connection. Restart Discord, then Smiley.
</details>

<details>
<summary><strong>What's the difference between Electron and Native?</strong></summary>

Same Discord presence, different shell. Electron has the full web UI, custom uploads, and auto-updates. Native is smaller and faster on weak hardware. See <a href="README-NATIVE.md">README-NATIVE.md</a>.
</details>
