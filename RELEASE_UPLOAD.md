# Manual GitHub release upload (Smiley)

**Status:** Use `gh auth login` if not authenticated. Upload matching `dist/*` for the version in `package.json`.

## macOS says "damaged and can't be opened"?

Gatekeeper blocks unsigned/quarantined downloads. **v2.1.8+** DMGs are ad-hoc signed at build time (`identity: "-"` + `scripts/sign-mac-app.sh`).

**User workaround** (tell downloaders):

```bash
xattr -cr ~/Downloads/Smiley-*.dmg          # before opening DMG
xattr -cr /Applications/Smiley.app          # after install
```

Right-click → **Open** the first time.

## 1. `dist/` inventory (newest builds)

| Version | Files in `dist/` |
|--------|-------------------|
| **2.1.3** (newest **mac**) | `Smiley-2.1.3-arm64.dmg`, `Smiley-2.1.3-x64.dmg`, zips + blockmaps, `latest-mac.yml` (version **2.1.3**) |
| **2.1.0** (newest **win** in dist) | `Smiley-Setup-2.1.0.exe`, `Smiley 2.1.0.exe` (portable) |
| **2.1.5** | **No binaries** — `package.json` is `2.1.5` but local `dist/` was last built at **2.1.3** (mac) / **2.1.0** (win) |

Git tags present locally: `v2.1.2` … `v2.1.6`. Pick a tag that **matches the filenames** you upload, or rebuild first (see below).

## 2. `DISCORD_CLIENT_ID` — CI only for releases

| Context | Needed? |
|--------|---------|
| **Manual `gh release create` / upload** | **No** |
| **GitHub Actions** (`.github/workflows/release.yml`) | **Yes** — secret `DISCORD_CLIENT_ID` writes `discord.app.json` before `electron-builder --publish always` |
| **Local build** | Use existing `discord.app.json` in repo (or env `DISCORD_CLIENT_ID`); not required to upload assets |

CI failure on missing `DISCORD_CLIENT_ID` does **not** block manual release uploads.

## 3. One-time: authenticate GitHub CLI

```bash
/opt/homebrew/bin/gh auth login
# Choose: GitHub.com → HTTPS or SSH → Login via browser
cd "/Users/raj/Project Smiley"
```

## 4. Recommended: rebuild for v2.1.5, then publish

Avoid shipping `latest-mac.yml` that says `2.1.3` on a `v2.1.5` release (breaks auto-update).

```bash
cd "/Users/raj/Project Smiley"
npm ci
# discord.app.json already in repo; optional: export DISCORD_CLIENT_ID=...
npm run build:mac    # and/or build:win on Windows
```

Then upload **matching** `dist/*` for version in `package.json`.

## 5. Upload v2.1.8 (macOS Gatekeeper fix)

```bash
cd "/Users/raj/Project Smiley"
npm ci && npm run build:mac
hdiutil verify dist/Smiley-2.1.8-arm64.dmg
hdiutil verify dist/Smiley-2.1.8-x64.dmg

gh release create v2.1.8 --repo 1tsRajuWu/Smiley \
  --title "Smiley v2.1.8" \
  --notes "Fix macOS 'damaged' install: ad-hoc signed DMGs. If blocked, run: xattr -cr ~/Downloads/Smiley-*.dmg then right-click Open."

gh release upload v2.1.8 --repo 1tsRajuWu/Smiley --clobber \
  dist/Smiley-2.1.8-arm64.dmg \
  dist/Smiley-2.1.8-x64.dmg \
  dist/latest-mac.yml
```

## 6. Create release **v2.1.5** and upload assets

From repo root, after `gh auth login`:

```bash
cd "/Users/raj/Project Smiley"
REPO="1tsRajuWu/Smiley"
TAG="v2.1.5"

# Create release (use --target if tag already exists on GitHub)
/opt/homebrew/bin/gh release create "$TAG" \
  --repo "$REPO" \
  --title "Smiley v2.1.5" \
  --notes "Download for your platform below." \
  --draft=false

# macOS (use 2.1.3 filenames only if you have NOT rebuilt — prefer rebuild first)
/opt/homebrew/bin/gh release upload "$TAG" --repo "$REPO" \
  "dist/Smiley-2.1.3-arm64.dmg" \
  "dist/Smiley-2.1.3-x64.dmg" \
  "dist/latest-mac.yml"

# Windows (best available in dist today)
/opt/homebrew/bin/gh release upload "$TAG" --repo "$REPO" \
  "dist/Smiley-Setup-2.1.0.exe" \
  "dist/Smiley 2.1.0.exe"
```

**If you rebuilt at 2.1.5**, replace paths with `Smiley-2.1.5-*.dmg` / `Smiley-Setup-2.1.5.exe` and upload the new `latest-mac.yml` / `latest.yml`.

### Alternative: release **v2.1.3** (matches current mac artifacts exactly)

```bash
TAG="v2.1.3"
/opt/homebrew/bin/gh release create "$TAG" --repo 1tsRajuWu/Smiley \
  --title "Smiley v2.1.3" \
  --notes "Download for your platform below." \
  "dist/Smiley-2.1.3-arm64.dmg" \
  "dist/Smiley-2.1.3-x64.dmg" \
  "dist/latest-mac.yml" \
  "dist/Smiley-Setup-2.1.0.exe" \
  "dist/Smiley 2.1.0.exe"
```

## 6. Verify

```bash
/opt/homebrew/bin/gh release view v2.1.5 --repo 1tsRajuWu/Smiley
open "https://github.com/1tsRajuWu/Smiley/releases"
```

Expected release URL after success:

**https://github.com/1tsRajuWu/Smiley/releases/tag/v2.1.5**

(or `/tag/v2.1.3` if you used the alternative)

## 7. GitHub UI (no CLI)

1. Open https://github.com/1tsRajuWu/Smiley/releases/new  
2. Choose tag `v2.1.5` (or create from `main`).  
3. Title: `Smiley v2.1.5`  
4. Drag-and-drop the DMGs, EXEs, and `latest-mac.yml`.  
5. Publish release.
