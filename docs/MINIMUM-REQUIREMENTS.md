# Minimum system requirements

Smiley ships two desktop apps: **Smiley (Electron)** and **Smiley.Native** (.NET). Both target the **lowest practical OS versions** supported by their runtimes (Electron 33 and .NET 10), with separate builds per CPU architecture — not universal/fat binaries.

## Quick reference

| Platform | Minimum OS | Architectures | Recommended download |
|----------|------------|---------------|----------------------|
| **Mac (Electron)** | macOS **11 Big Sur** or later | Intel x64, Apple Silicon (M1–M5) arm64 | `Smiley-{version}-arm64.dmg` or `Smiley-{version}-x64.dmg` |
| **Windows (Electron)** | Windows **10 64-bit** (build **1809+**) or Windows 11 | x64 | `Smiley-Setup-{version}.exe` or `Smiley-Portable-{version}.exe` |
| **Linux (Electron)** | Ubuntu **20.04+** / Debian 10+ / Fedora 32+ (glibc 2.28+) | x64 | `Smiley-{version}.AppImage` or `Smiley-{version}.deb` |
| **Low-end (Native)** | Windows/Linux same as Electron; macOS **14 Sonoma+** (.NET 10) | x64, arm64 (Mac) | `Smiley-Native-{version}-{rid}.zip` |

## Which file for your device?

| Device | App | Download artifact |
|--------|-----|-------------------|
| **M5 / M4 / M3 / M2 / M1 Mac** | Electron | `Smiley-{version}-arm64.dmg` |
| **Intel Mac** (2013–2020) | Electron | `Smiley-{version}-x64.dmg` |
| **Windows 11** (64-bit) | Electron | `Smiley-Setup-{version}.exe` or `Smiley-Portable-{version}.exe` |
| **Windows 10** (64-bit, 1809+) | Electron | Same as Windows 11 |
| **Linux** (most x64 distros) | Electron | `Smiley-{version}.AppImage` or `.deb` |
| **Weak / low-RAM PC** | Native | `Smiley-Native-{version}-win-x64.zip` (or `osx-arm64` / `osx-x64` / `linux-x64`) |

Replace `{version}` with the release tag (e.g. `3.0.0`). See [Releases](https://github.com/1tsRajuWu/Smiley/releases/latest).

---

## macOS

| Setting | Value |
|---------|--------|
| **Minimum OS** | macOS **11.0 (Big Sur)** — Electron 33 dropped Catalina (10.15) |
| **`minimumSystemVersion`** | `11.0.0` in `package.json` |
| **Architectures** | **arm64** (Apple Silicon M1–M5) and **x64** (Intel) — **separate DMGs**, not a universal binary |
| **Artifacts** | `Smiley-{version}-arm64.dmg`, `Smiley-{version}-x64.dmg`, plus matching `.zip` for updates |

> **Note:** `minimumSystemVersion` in the DMG only declares compatibility to macOS. Electron 33 + Chromium will not run on 10.15 even if the plist says otherwise.

## Windows

| Setting | Value |
|---------|--------|
| **Minimum OS** | Windows **10** 64-bit (version **1809** or later) or **Windows 11** |
| **Architectures** | **x64** only (32-bit Windows is not targeted) |
| **Artifacts** | `Smiley-Setup-{version}.exe` (NSIS installer), `Smiley-Portable-{version}.exe` |

Chromium/Electron 23+ requires Windows 10; build **1809** is the practical floor for current Chromium builds.

## Linux

| Setting | Value |
|---------|--------|
| **Minimum OS** | Ubuntu **20.04+**, Debian **10+**, Fedora **32+**, or equivalent glibc **2.28+** |
| **Architectures** | **x64** |
| **Artifacts** | `Smiley-{version}.AppImage`, `Smiley-{version}.deb` |

AppImage is the most distro-agnostic option; `.deb` suits Debian/Ubuntu/Mint.

## Build commands

```bash
npm run build:mac      # dmg + zip, x64 + arm64
npm run build:win      # nsis + portable, x64
npm run build:linux    # AppImage + deb, x64
npm run build:compat   # all of the above (full compatibility matrix)
npm run build:all      # alias for build:compat
```

---

## Smiley.Native — lightweight app

Built with **.NET 10** (`net10.0`, self-contained). Zips from `build-native-all.sh`. See [README-NATIVE.md](../README-NATIVE.md).

| Platform | Minimum OS | Architectures | Artifact |
|----------|------------|---------------|----------|
| **macOS** | **14 Sonoma** or later | arm64 (M1–M5), Intel x64 | `Smiley-Native-{version}-osx-arm64.zip`, `osx-x64.zip` |
| **Windows** | Windows 10 64-bit (1809+) / Windows 11 | x64 | `Smiley-Native-{version}-win-x64.zip` |
| **Linux** | Ubuntu **22.04+**, Debian **12+**, Fedora **42+** | x64 | `Smiley-Native-{version}-linux-x64.zip` |

Native needs **macOS 14+** (stricter than Electron’s macOS 11+). On Macs running 11–13, use the Electron build.

---

## Hardware (both apps)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 4 GB | 8 GB |
| **Disk** | ~200 MB (Electron) / ~70 MB (Native) | 500 MB free |
| **Other** | Discord **desktop** app running on the same machine | — |

---

## Runtime sources

- [Electron 33 — macOS 10.15 removed](https://www.electronjs.org/blog/electron-33-0)
- [Electron breaking changes](https://github.com/electron/electron/blob/main/docs/breaking-changes.md)
- [.NET 10 supported operating systems](https://github.com/dotnet/core/blob/main/release-notes/10.0/supported-os.md)
