# Release upload (maintainers)

Build from repo root, then attach `dist/` to the GitHub release.

## Build

```bash
npm ci
npm run build:mac      # macOS
npm run build:win      # Windows
npm run build:linux    # Linux
```

`discord.app.json` is in the repo for local builds. CI needs the `DISCORD_CLIENT_ID` secret (see `.github/workflows/release.yml`).

## Upload v2.1.8 assets

```bash
gh release upload v2.1.8 --repo 1tsRajuWu/Smiley --clobber \
  dist/Smiley-Setup-2.1.8.exe \
  dist/Smiley-Portable-2.1.8.exe \
  dist/Smiley-2.1.8-arm64.dmg \
  dist/Smiley-2.1.8-x64.dmg \
  dist/Smiley-2.1.8.AppImage \
  dist/Smiley-2.1.8.deb \
  dist/latest-mac.yml \
  dist/latest.yml \
  dist/latest-linux.yml
```

## macOS "damaged"?

DMGs are ad-hoc signed. If Gatekeeper still blocks:

```bash
xattr -cr ~/Downloads/Smiley-*.dmg
```

Right-click → Open the first time.

## Verify

```bash
gh release view v2.1.8 --repo 1tsRajuWu/Smiley
```

Check every download URL returns HTTP 200.
