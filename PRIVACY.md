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
- **waifu.pics** — fetches images, no personal info sent
- **GitHub** — version check on launch, no tracking
- **PayPal** — only if you click the donate link

## Uninstall

Delete the app and remove:

- macOS: `~/Library/Application Support/smiley-rpc/`
- Windows: `%APPDATA%/smiley-rpc/`
- Linux: `~/.config/smiley-rpc/`

## Kids

Not aimed at under-13s.

## Contact

[paypal.me/1tsRaj](https://paypal.me/1tsRaj)
