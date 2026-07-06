# Smiley Mobile — Android & iOS (v3.1.4)

Companion app for browsing activities, previewing anime GIFs, and copying status text.

> **Discord Rich Presence requires the desktop app.** Mobile cannot set your Discord profile status. Use Smiley on **Windows, macOS, or Linux** for live Rich Presence — see the [main README](../README.md).

## What mobile can do

| Feature | Mobile | Desktop Smiley |
|---------|--------|----------------|
| Browse 32 activities | ✅ | ✅ |
| Preview GIFs (nekos.best, waifu.pics) | ✅ | ✅ |
| Copy status text to clipboard | ✅ | — |
| Save favorites | ✅ | — |
| Set Discord Rich Presence | ❌ | ✅ |
| Custom upload GIF | ❌ | ✅ |
| System tray / hotkey | ❌ | ✅ |

## Download

| Platform | Install |
|----------|---------|
| **Android** | [Smiley-3.1.4-android-debug.apk](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.4/Smiley-3.1.4-android-debug.apk) · Sideload · Android 8+ |
| **iOS** | Build in Xcode — [instructions below](#ios) · no IPA download (Apple policy) |
| **PWA** | Open `mobile/dist/index.html` via `npm run preview` → Add to Home Screen |

### Android install (sideload)

1. **Use Chrome** on your phone — tap the APK link above (or **Settings → Download latest** in the app).
2. When prompted, tap **Download** and **wait until the download fully completes** (progress bar finishes — not stuck at “Downloading…”).
3. Open your **Downloads** folder (or tap the completed notification) and tap the APK to install.
4. If Android blocks the install, enable **Install unknown apps** (or **Install unknown apps from this source**) for **Chrome** (or your browser) in system Settings.

**Download stuck at 100% / “Downloading…”?**

- Tap **Cancel**, then try the [direct APK link](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.4/Smiley-3.1.4-android-debug.apk) again.
- Or open [latest release](https://github.com/1tsRajuWu/Smiley/releases/latest) in the browser and download `Smiley-*-android-debug.apk` from the assets list.
- Try **Firefox** if Chrome keeps hanging.
- The latest APK should be **~3.5–4 MB+**. If the file is much smaller or an old version (e.g. 3.0.2), clear the partial download and grab the current release.

## Quick start (developers)

```bash
cd mobile
npm install
npm run build          # sync src → www → dist
npx cap add android    # first time only
npx cap add ios        # first time only (macOS + Xcode)
npm run sync           # build + cap sync
```

### Android

**Requirements:** Android Studio, JDK 17+, Android SDK 34

```bash
npm run android        # opens Android Studio
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

Or from terminal (after `npm run sync`):

```bash
npm run apk:debug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

**Target SDK:** 34 · **Min SDK:** 26 (Android 8.0+)

Enable **Install from unknown sources** if sideloading the APK.

### iOS

**Requirements:** macOS, Xcode 15+, Apple Developer account ($99/yr) for device/TestFlight

```bash
npm run ios            # opens Xcode
```

1. Select your Team in **Signing & Capabilities**
2. Set deployment target **iOS 16.0+** (recommended 17+ for latest safe areas)
3. **Product → Run** for Simulator, or **Archive → Distribute App** for device/TestFlight

TestFlight steps: upload archive → App Store Connect → invite testers.

> Without an Apple Developer account you can run on the **Simulator** only. There is no `.ipa` for others to download — Apple does not allow unsigned IPA distribution like Android APK sideloading.

## Web preview (no native build)

```bash
cd mobile
npm install
npm run dev            # http://localhost:5173
# or
npm run preview        # production build preview
```

## Project layout

```
mobile/
├── www/           # Mobile UI source (index.html, styles.css, app.js)
├── dist/          # Vite build output → Capacitor webDir
├── scripts/       # build-www.js copies activities from ../src
├── android/       # Capacitor Android project (after cap add)
├── ios/           # Capacitor iOS project (after cap add)
└── capacitor.config.json
```

Shared data (`activities.js`, `discord-images.js`, assets) is copied from `../src` on each build so mobile stays aligned with desktop v3.1.4.

## Honest limitation: why no Rich Presence on phone?

Smiley talks to the **Discord desktop client** over a local IPC socket (`discord-rpc`). The Discord mobile apps do not expose this API to third-party apps. A phone cannot set Rich Presence on your PC or on mobile Discord.

**Workflow:** Pick an activity on your phone → **Copy status** → use the same activity on desktop Smiley (or paste details manually).

## Settings

- **GIF previews** — toggle nekos.best / waifu.pics loading
- **Themes** — Dark, Midnight, Ocean, Sakura, Low Light (OLED)
- **Download latest** — opens GitHub Releases in your browser for the newest APK
- **Report a bug** — opens a pre-filled GitHub issue for the developer
- Favorites persist via Capacitor Preferences (native) or localStorage (web)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| APK download stuck | Cancel, use [direct link](https://github.com/1tsRajuWu/Smiley/releases/download/v3.1.4/Smiley-3.1.4-android-debug.apk), or try Firefox — see [Android install](#android-install-sideload) |
| GIF won't load | Check internet; APIs may rate-limit — fallback GIFs still work |
| Copy fails on web | Use HTTPS or localhost; grant clipboard permission |
| Android build fails | Open Android Studio → SDK Manager → install SDK 34 |
| iOS signing error | Add Apple ID in Xcode → Settings → Accounts |

## Version

Aligned with **Smiley desktop v3.1.4**. See [Releases](https://github.com/1tsRajuWu/Smiley/releases).

---

© Raj ([@1tsRaj](https://github.com/1tsRaj)) — [Terms](../ToS.md) · [Privacy](../PRIVACY.md) · [Report a bug](https://github.com/1tsRajuWu/Smiley/issues/new?template=bug_report.md&labels=bug)
