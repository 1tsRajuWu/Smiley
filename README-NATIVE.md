# ⚡ Smiley Native (.NET / Avalonia)

**Lightweight alternative to the Electron app** — recommended for low-end PCs.

No Chromium. No Electron. Same Discord Rich Presence, way less RAM and disk space.

👉 **Full app (Electron):** [README.md](README.md) · **Download Native builds:** [Releases v2.1.10](https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.10)

---

## ⬇️ Download (v2.1.10)

| Platform | Download |
|----------|----------|
| 🪟 Windows | [**Smiley-Native-2.1.10-win-x64.zip**](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Native-2.1.10-win-x64.zip) |
| 🍎 macOS ARM (M1+) | [**Smiley-Native-2.1.10-osx-arm64.zip**](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Native-2.1.10-osx-arm64.zip) |
| 🍎 macOS Intel | [**Smiley-Native-2.1.10-osx-x64.zip**](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Native-2.1.10-osx-x64.zip) |
| 🐧 Linux | [**Smiley-Native-2.1.10-linux-x64.zip**](https://github.com/1tsRajuWu/Smiley/releases/download/v2.1.10/Smiley-Native-2.1.10-linux-x64.zip) |

Unzip and run `Smiley` (or `Smiley.exe` on Windows). Keep **Discord desktop** open.

---

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

- [.NET 10 SDK](https://dotnet.microsoft.com/download) (or .NET 8+) — only for building from source
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

| Use case | App |
|----------|-----|
| Low-end PC, small download | **Smiley.Native** ⚡ |
| Full web UI, auto-updater, custom animations upload | Smiley (Electron) 😊 |

Both share the same Discord Application ID and activity list.
