# Smiley Mobile — Important Limitations

**Discord Rich Presence does not work on Android or iPhone the same way it does on desktop.**

Smiley's core feature connects to the **Discord desktop app** over a local IPC socket. Mobile Discord apps do not expose this API to third-party apps. A phone cannot set your PC's Rich Presence.

## What mobile can be (future)

| Platform | Format | Rich Presence? | Notes |
|----------|--------|----------------|-------|
| **Windows** | `.exe` (NSIS installer) | ✅ Yes | Built with Electron — primary platform |
| **macOS** | `.dmg` | ✅ Yes | Built with Electron — primary platform |
| **Android** | `.apk` | ❌ No RPC | Companion UI / PWA only unless Discord ships mobile RPC |
| **iOS** | `.ipa` (App Store) | ❌ No RPC | Requires Apple Developer ($99/yr) + Xcode; no desktop Discord IPC |

## Android APK (optional scaffold)

If you want a **companion shell** (browse activities, copy status text, link to download desktop app):

```bash
cd mobile
npm install
npx cap add android
npx cap sync android
npx cap open android
# Build → Generate Signed APK in Android Studio
```

Files in this folder are a minimal [Capacitor](https://capacitorjs.com/) scaffold pointing at the web UI.

## iOS / iPhone (.ipa)

1. Apple Developer account required
2. Install Xcode on a Mac
3. `cd mobile && npx cap add ios && npx cap open ios`
4. Archive in Xcode → Distribute App

**Smiley on iPhone cannot set Discord Rich Presence** without Discord's official mobile SDK (games only, not status pickers).

## PWA (install from browser)

The root `manifest.json` supports "Add to Home Screen" on Android/iOS as a **bookmark-style** shortcut — not a full native app, and still no Rich Presence.

## Recommendation

Share the **desktop** builds (`.exe` / `.dmg`) with users who want animated Discord status. Use this `mobile/` folder only if you later build a companion app for browsing activities or community features.
