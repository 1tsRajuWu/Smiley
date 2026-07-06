# Smiley Mobile — development paused

**Development paused — not listed on the main README.** The `mobile/` folder and Android project remain in the repo for local development. CI may still attach `Smiley-*-android-debug.apk` to GitHub Releases on tag, but the landing page does not link to it.

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
