# Smiley Mobile — Android companion

**Android only.** iOS is not supported or shipped. The `ios/` folder exists for Capacitor development only.

**Discord Rich Presence does not work on Android.** Smiley connects to the **Discord desktop app** over a local IPC socket. Mobile Discord apps do not expose this API.

## What you get on mobile

- Browse all 32 activities across 5 categories
- Live GIF preview via [nekos.best](https://nekos.best) & [waifu.pics](https://waifu.pics)
- Copy status text to clipboard
- Save favorites
- Dark themes with safe-area support

## Install (users)

Download the APK from [GitHub Releases](https://github.com/1tsRajuWu/Smiley/releases/latest) (`Smiley-*-android-debug.apk`). Install steps are in the [main README](../README.md#android).

## Build (developers)

```bash
cd mobile
npm install
npm run sync
npm run android    # opens Android Studio
# or
npm run apk:debug  # outputs android/app/build/outputs/apk/debug/app-debug.apk
```

**Requirements:** Android Studio, JDK 17+, Android SDK 34 · Min SDK 26 (Android 8.0+)

## Recommendation

Use **desktop Smiley** (`.exe` / `.dmg` / AppImage) for animated Discord Rich Presence. Use the Android app as a companion when you're away from your PC.
