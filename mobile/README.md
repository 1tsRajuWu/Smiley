# Smiley Mobile — paused

**Paused — not distributed.** Mobile builds are not published on GitHub Releases. Smiley is desktop-only for now (Windows, macOS, Linux).

The `mobile/` folder remains for local development. Do not link to this from the main README.

## Background

**Discord Rich Presence does not work on Android.** Smiley connects to the **Discord desktop app** over a local IPC socket. Mobile Discord apps do not expose this API.

## Build (developers only)

```bash
cd mobile
npm install
npm run sync
npm run android    # opens Android Studio
# or
npm run apk:debug  # outputs android/app/build/outputs/apk/debug/app-debug.apk
```

**Requirements:** Android Studio, JDK 17+, Android SDK 34 · Min SDK 26 (Android 8.0+)

Use **desktop Smiley** (`.exe` / `.dmg` / AppImage) for animated Discord Rich Presence.
