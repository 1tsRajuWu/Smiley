# Releasing Smiley.Native

> **Deprecated (v3.0.0+)** — Smiley.Native is no longer published in GitHub Releases. Use the main Electron app release workflow in [RELEASING.md](./RELEASING.md). This doc is kept for historical reference.

The .NET native app is **~25MB** and recommended for low-end PCs. It does not use electron-updater — users get update notifications via GitHub Releases API.

## Build

```bash
# macOS Apple Silicon
./scripts/build-native.sh osx-arm64

# macOS Intel
./scripts/build-native.sh osx-x64

# Windows
.\scripts\build-native.ps1 win-x64
```

Output: `dist-native/<runtime>/Smiley` (or `Smiley.exe` on Windows)

## Publish a native release

1. Bump `<Version>` in `Smiley.Native/Smiley.Native.csproj`
2. Build for each platform
3. Upload binaries to the same GitHub Release as Electron (or a separate release asset)

```bash
# Example: attach to existing release
gh release upload v2.1.2 dist-native/osx-arm64/Smiley --clobber
```

## Auto-update behavior

On startup, `VersionCheckService` calls:

```
GET https://api.github.com/repos/1tsRaj/smiley-rpc/releases/latest
```

If a newer tag exists, the app opens the release page in the browser so users can download the latest build.

Future: [Velopack](https://github.com/velopack/velopack) or Squirrel.Windows for true silent updates on native builds.
