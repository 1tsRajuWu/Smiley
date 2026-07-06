# Smiley Mobile — Important Limitations

**Discord Rich Presence does not work on Android or iPhone.**

Smiley's core feature connects to the **Discord desktop app** over a local IPC socket. Mobile Discord apps do not expose this API.

## What you get on mobile

- Browse all 32 activities across 5 categories
- Live GIF preview via [nekos.best](https://nekos.best) & [waifu.pics](https://waifu.pics)
- Copy status text to clipboard
- Save favorites
- PWA-ready dark themes with safe-area support

## Build & install

See **[README-MOBILE.md](../README-MOBILE.md)** for full Android APK and iOS Xcode instructions.

```bash
cd mobile && npm install && npm run sync
npm run android   # or npm run ios
```

## Recommendation

Use **desktop Smiley** (`.exe` / `.dmg`) for animated Discord Rich Presence. Use mobile as a companion when you're away from your PC.
