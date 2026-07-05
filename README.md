# Smiley v2.0 ✨

A beautiful **Discord Rich Presence** desktop app with **animated anime characters**, **custom animation uploads**, **multiple themes**, and a **big, beautiful PayPal donation banner**.

![Smiley Preview](build/icon.svg)

## What's New in v2.0

- 🎨 **Animated Characters** — Cute anime-style characters that animate based on your selected activity (eating, gaming, sleeping, coding, social)
- 🖼️ **Custom Animations** — Upload your own GIFs, PNGs, WebPs, or SVGs as your character
- 🎭 **4 Themes** — Dark, Midnight, Ocean, and Sakura
- ⚙️ **Rich Settings** — Timer toggle, auto-connect, minimize-to-tray, theme picker
- 💝 **Big Donate Banner** — Prominent PayPal support link (defaults to `https://paypal.me/1tsRaj`)
- 🔒 **Security Hardened** — CSP, sandbox, context isolation, input validation
- 🪟 **Window State Saving** — Remembers your window size and position
- 🔔 **Tray Icon Switching** — Tray icon changes to match your activity
- 📦 **Cross-Platform Installers** — `.exe` installer for Windows, `.dmg` for Mac, `.AppImage` for Linux

## How It Works

```
┌─────────────────────────────────┐     local IPC      ┌─────────────┐
│           Smiley                │ ─────────────────► │   Discord   │
│  ┌─────────┐  ┌─────────────┐   │                    │   Client    │
│  │ Animated│  │  Activity   │   │                    └─────────────┘
│  │Character│  │   Picker    │   │
│  │ (SVG)   │  │             │   │
│  └─────────┘  └─────────────┘   │
└─────────────────────────────────┘
```

Discord must be open. Smiley talks to Discord via local IPC (the official, supported way).

## Quick Start

### 1. Create a Discord Application (one-time, free)

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it "Smiley"
3. Copy the **Application ID** (this is your Client ID)
4. Go to **Rich Presence → Art Assets**
5. Upload 512×512+ icons and name the keys to match activities:
   - `pizza`, `gaming`, `sleep`, `coding`, `music`, etc.
   - Also upload a `smiley` icon for the small badge

### 2. Run Smiley

```bash
npm install
npm start
```

On first launch, paste your **Client ID** in Settings → Save & Connect.

### 3. Pick an Activity

Click any card — your Discord profile updates within a few seconds. The animated character in the sidebar reacts to your choice!

## Build Installers

### Windows (.exe installer)
```bash
npm run build:win
```
Output: `dist/Smiley-Setup-2.0.0.exe`

### macOS (.dmg)
```bash
npm run build:mac
```
Output: `dist/Smiley-2.0.0.dmg`

### Linux (.AppImage)
```bash
npm run build:linux
```
Output: `dist/Smiley-2.0.0.AppImage`

### All Platforms
```bash
npm run build:all
```

## Features

### Animated Characters
Each activity category has a unique animated anime character:
- 🍽️ **Food** — Character happily eating with floating food particles
- 🎮 **Gaming** — Character with headphones and controller
- 😌 **Chill** — Character sleeping with floating Zzz
- 💻 **Work** — Character with glasses typing code
- ✨ **Social** — Character waving with sparkles

### Custom Animations
Go to **Settings → Animations** and upload your own images/GIFs. They'll replace the built-in character for all activities. You can upload up to 10 custom animations and switch between them.

### Themes
- **Dark** — Classic dark theme
- **Midnight** — Deep purple-black
- **Ocean** — Blue-tinted dark
- **Sakura** — Warm pink tones

### Settings
| Setting | Description |
|---------|-------------|
| Client ID | Your Discord Application ID |
| Donation Link | Your PayPal/Ko-fi link (defaults to `https://paypal.me/1tsRaj`) |
| Auto-connect | Connect to Discord on app launch |
| Minimize to tray | Hide to tray instead of quitting |
| Show Timer | Show elapsed time in preview |
| Animations | Enable/disable character animations |
| Theme | Choose your color theme |

## Configuration

Config is stored at:
- **macOS:** `~/Library/Application Support/smiley-rpc/config.json`
- **Windows:** `%APPDATA%/smiley-rpc/config.json`
- **Linux:** `~/.config/smiley-rpc/config.json`

Custom animations are saved in the `custom-animations` folder inside the app data directory.

## Adding Activities

Edit `src/activities.js`. Each activity needs:

```js
{
  id: 'eating-tacos',
  details: 'Eating',
  state: 'Taco Tuesday 🌮',
  emoji: '🌮',
  largeImageKey: 'tacos',      // must match Dev Portal asset key
  largeImageText: 'Tacos',
}
```

Then upload a matching `tacos` asset in the Developer Portal.

## Security

- Content Security Policy (CSP) enforced
- Context isolation enabled
- Node integration disabled
- Sandbox enabled
- All IPC inputs validated
- File path sanitization for custom uploads
- URL validation for external links
- No user tokens or credentials stored

## Phone / Mobile Support

Smiley is built with Electron for desktop (Windows, macOS, Linux). For mobile devices, the app UI is responsive and can be accessed as a web view, but **Discord Rich Presence via RPC only works on desktop** with the Discord client running locally.

## Donations

If you enjoy Smiley, consider supporting development:

**[💝 PayPal — 1tsRaj](https://paypal.me/1tsRaj)**

Your support helps keep Smiley free and regularly updated with new features!

## License

MIT

## Acknowledgments

This app was built with the help of **AI (Kimi / Moonshot AI)**. It is **not** a fully self-built project — AI assisted with coding, architecture, design decisions, and documentation. We believe in being transparent about how software is made.

- AI-generated code was reviewed and adapted by the project owner
- The Discord Rich Presence integration uses the official `discord-rpc` library
- Animations powered by [waifu.pics](https://waifu.pics) and [Tenor](https://tenor.com) APIs
- Icons and visual design inspired by modern Discord clients

MIT
