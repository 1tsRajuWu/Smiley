# Privacy Policy

**Raj (@1tsRaj)** — last updated July 2026

## Short version

Smiley doesn't collect your data. Nothing leaves your machine except optional update checks and image fetches.

## What stays local

| Stored on your device | Why |
|-----------------------|-----|
| Discord Client ID | Connect to Discord RPC |
| Theme, timer, window size | Your settings |
| Custom GIFs you upload | Your files |

Config is encrypted locally on disk (AES-256-GCM); nothing is stored in the system keychain.

## What talks to the internet

- **Discord** — local IPC only, no cloud relay
- **waifu.pics / Tenor / Giphy** — fetches images, no personal info sent
- **GitHub** — version check on launch
- **PayPal** — only if you click the donate link
- **Install count (opt-in only)** — if you enable *Share anonymous install count* in Settings, Smiley sends **once**: a random install ID, your OS (Mac/Windows/Linux), CPU type, and app version. No name, email, IP, or Discord data. Off by default.

## What we never collect

- Your name, email, or location
- Discord username or token
- IP address (not stored by Smiley)
- Files or screenshots from your device

## Uninstall

Delete the app and remove:

- macOS: `~/Library/Application Support/smiley-rpc/`
- Windows: `%APPDATA%/smiley-rpc/`
- Linux: `~/.config/smiley-rpc/`

## Kids

Not aimed at under-13s.

## Contact

[paypal.me/1tsRaj](https://paypal.me/1tsRaj)
