# Minimum system requirements

Smiley is an **Electron** desktop app. It targets the **lowest practical OS versions** supported by Electron 33, with separate builds per CPU architecture — not universal/fat binaries.

## Quick reference

| Platform | Minimum OS | Architectures | Recommended download |
|----------|------------|---------------|----------------------|
| **macOS** | macOS **11 Big Sur** or later | Intel x64, Apple Silicon (M1–M5) arm64 | `Smiley-{version}-arm64.dmg` (Apple Silicon) or `Smiley-{version}-x64.dmg` (Intel) |
| **Windows** | Windows **10 64-bit** (build **1809+**) or Windows 11 | x64 | `Smiley-Setup-{version}.exe` (installer) or `Smiley-Portable-{version}.exe` |
| **Linux** | Ubuntu **20.04+** / Debian 10+ / Fedora 32+ (glibc 2.28+) | x64 | `Smiley-{version}.AppImage` or `Smiley-{version}.deb` |

## Which file for your device?

| Device | Download artifact |
|--------|-------------------|
| **M5 / M4 / M3 / M2 / M1 Mac** | `Smiley-{version}-arm64.dmg` |
| **Intel Mac** (2013–2020) | `Smiley-{version}-x64.dmg` |
| **Windows 11** (64-bit) | `Smiley-Setup-{version}.exe` or `Smiley-Portable-{version}.exe` |
| **Windows 10** (64-bit, 1809+) | Same as Windows 11 |
| **Linux** (most x64 distros) | `Smiley-{version}.AppImage` (portable) or `.deb` (Debian/Ubuntu) |

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

## Hardware

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 4 GB | 8 GB |
| **Disk** | ~200 MB | 500 MB free |
| **Other** | Discord **desktop** app running on the same machine | — |

---

## Runtime sources

- [Electron 33 — macOS 10.15 removed](https://www.electronjs.org/blog/electron-33-0)
- [Electron breaking changes](https://github.com/electron/electron/blob/main/docs/breaking-changes.md)
