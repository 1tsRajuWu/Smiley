# Privacy Policy

**Last Updated:** July 4, 2025

## 1. Overview

Smiley ("the App") respects your privacy. This policy explains what data we collect, how we use it, and how we protect it.

## 2. Data We Do NOT Collect

Smiley does **NOT** collect, store, or transmit:
- Your Discord login credentials, password, or token
- Your Discord messages, DMs, or server data
- Your personal identity information
- Your browsing history
- Any data from your Discord account

## 3. Data Stored Locally

The App stores the following data **only on your local device**:

| Data | Purpose | Storage |
|------|---------|---------|
| Discord Client ID | Connect to Discord's RPC | Encrypted local file |
| App preferences (theme, timer, etc.) | User settings | Encrypted local file |
| Custom animation images | User-uploaded visuals | Local folder |
| Window size/position | Remember UI state | Local file |

All sensitive configuration is encrypted using your operating system's secure storage (AES-256-GCM or OS-level encryption).

## 4. External Services

The App connects to the following external services:

- **Discord IPC (local):** Communicates with the Discord desktop client running on your machine. No data leaves your device.
- **waifu.pics API:** Fetches anime-style images for visual display. No personal data is sent.
- **GitHub (optional):** Checks for app updates. No personal data is sent.
- **PayPal (optional):** Donation link opens in your browser. PayPal's privacy policy applies.

## 5. Encryption & Security

- Configuration files are encrypted using OS-level secure storage (macOS Keychain, Windows DPAPI, Linux Secret Service)
- Fallback AES-256-GCM encryption with per-installation keys
- DevTools are disabled in production builds
- Content Security Policy (CSP) prevents unauthorized script execution
- No network access to your Discord credentials

## 6. Data Retention

All data is stored locally until you uninstall the App. Uninstalling removes:
- macOS: `~/Library/Application Support/smiley-rpc/`
- Windows: `%APPDATA%/smiley-rpc/`
- Linux: `~/.config/smiley-rpc/`

## 7. Children's Privacy

Smiley is not intended for children under 13. We do not knowingly collect data from children.

## 8. Changes to This Policy

We may update this Privacy Policy. The "Last Updated" date at the top will reflect changes.

## 9. Contact

For privacy concerns, contact via PayPal: https://paypal.me/1tsRaj
