# Smiley Native (.NET / Avalonia)

**Lightweight alternative to the Electron app** — recommended for low-end PCs.

| | Electron | **Smiley Native** |
|---|---|---|
| Runtime | Chromium (~150MB+) | .NET + Avalonia (~40–70MB trimmed) |
| RAM usage | Higher | Lower |
| Startup | Slower | Faster |
| UI | Web/HTML | Native GPU-accelerated |
| Discord RPC | ✅ | ✅ |
| Animated GIF on Discord | ✅ HTTPS URLs | ✅ HTTPS URLs |

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

- [.NET 10 SDK](https://dotnet.microsoft.com/download) (or .NET 8+)
- **Discord desktop app** open (not Invisible mode)

## Run (development)

```bash
cd Smiley.Native
dotnet run
```

## Build installers

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
| Low-end PC, small download | **Smiley.Native** |
| Full web UI, auto-updater, custom animations upload | Smiley (Electron) |

Both share the same Discord Application ID and activity list.
