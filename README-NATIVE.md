# ⚡ Smiley Native (.NET / Avalonia)

> **Deprecated (v3.0.0+)** — Smiley.Native is no longer offered for download. Use the main **[Electron app](README.md)** instead. The `Smiley.Native/` source remains in the repo for development reference only.

Former lightweight alternative (.NET / Avalonia). Historical dev docs are commented out below.

---

## ⬇️ Download

**No longer available.** Download the main Electron app from [README.md](README.md).

<!--

## Electron vs Native

| | Electron | **Smiley Native** |
|---|---|---|
| Runtime | Chromium (~150MB+) | .NET + Avalonia (~25–70MB trimmed) |
| RAM usage | Higher | Lower |
| Startup | Slower | Faster |
| UI | Web/HTML | Native GPU-accelerated |
| Discord RPC | ✅ | ✅ |
| Animated GIF on Discord | ✅ HTTPS URLs | ✅ HTTPS URLs |
| Custom GIF upload | ✅ | ❌ |
| Auto-update | ✅ | Opens Releases page if newer |

## Features

- Discord Rich Presence via local IPC (same official method)
- Activity picker: Food, Gaming, Chill, Work, Social
- **Low Light / OLED** theme (deep black, default)
- waifu.pics API + Tenor GIF fallbacks for Discord large image
- System tray, minimize to tray
- Session timer
- Start with Windows (registry toggle)
- 15s Discord rate limiting

## Requirements

### Minimum OS (end users)

Self-contained builds bundle .NET 10 — no separate runtime install.

| Platform | Minimum OS | Architecture | Artifact |
|----------|------------|--------------|----------|
| **macOS** | **14 Sonoma** or later | arm64 (M1–M5), Intel x64 | `Smiley-Native-{version}-osx-arm64.zip` or `osx-x64.zip` |
| **Windows** | Windows 10 64-bit (1809+) or Windows 11 | x64 | `Smiley-Native-{version}-win-x64.zip` |
| **Linux** | Ubuntu 22.04+, Debian 12+, Fedora 42+ | x64 | `Smiley-Native-{version}-linux-x64.zip` |

Native needs **macOS 14+** (stricter than Electron’s macOS 11+). On Macs running 11–13, use the [Electron build](README.md) instead.

Full matrix (Electron vs Native): **[docs/MINIMUM-REQUIREMENTS.md](docs/MINIMUM-REQUIREMENTS.md)**

### Other

- [.NET 10 SDK](https://dotnet.microsoft.com/download) — only for building from source
- **Discord desktop app** open (not Invisible mode)

## Run (development)

```bash
cd Smiley.Native
dotnet run
```

## Build installers

### All platforms (zip for GitHub releases)

```bash
chmod +x build-native-all.sh
./build-native-all.sh
```

Output: `dist-native/Smiley-Native-<version>-<rid>.zip` for `win-x64`, `osx-arm64`, `osx-x64`, `linux-x64`.

### macOS (.app / optional .dmg)

```bash
chmod +x build-native.sh
./build-native.sh osx-arm64   # Apple Silicon
./build-native.sh osx-x64     # Intel Mac
```

Output: `dist-native/osx-arm64/Smiley`

For `.dmg`, install [create-dmg](https://github.com/create-dmg/create-dmg) and re-run the script.

### Windows (.exe)

```powershell
.\build-native.ps1 win-x64
```

Output: `dist-native/win-x64/Smiley.exe` (single file, self-contained)

### Linux

```bash
./build-native.sh linux-x64
```

## Configuration

Client ID is bundled in `appsettings.json` (not editable by end users):

```json
{ "DiscordClientId": "1522538045989982279" }
```

User settings stored in:
- Windows: `%APPDATA%\Smiley.Native\settings.json`
- macOS: `~/Library/Application Support/Smiley.Native/settings.json`

## Mobile (.apk / iPhone)

Discord Rich Presence **requires the desktop Discord client**. Mobile apps cannot set presence via the same IPC. See `mobile/README.md`.

## Which app to use?

Use **Smiley (Electron)** — the only supported desktop app. See [README.md](README.md).

-->