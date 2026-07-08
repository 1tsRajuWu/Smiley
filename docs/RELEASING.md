# Releasing Smiley — Push Updates to Installed Users

Smiley has **two update channels**, and the reinstall prompt is reserved for **major** versions:

| Channel | What it updates | User experience | When to use |
|--|--|--|--|
| **Live UI patches** (silent) | `src/` only — CSS, layout, `renderer.js`, assets | Soft window refresh — **no** reinstall | UI polish after the live-patch client is installed |
| **GitHub Releases** patch/minor (e.g. 7.9.18 → 7.9.19) | Full app binary | Downloads silently; applies on quit — **no** banner | Privileged / backend fixes within the same major |
| **GitHub Releases** major (e.g. 7.x → 8.0.0) | Full app binary | Banner: reinstall / restart required | Breaking changes, big platform shifts |

Privacy notes for live UI: apps only **GET** a public signed zip from GitHub Pages. No config, Discord token, or identity is uploaded. Offline users keep the last good local UI.

## Silent live UI (after first bootstrap release)

```bash
# Edit src/ (styles, layout, renderer) — then:
git add src/ && git commit -m "ui: polish layout"
git push origin main
```

GitHub Actions (Pages) zips + ed25519-signs `src/` and deploys to  
`https://1tsrajuwu.github.io/Smiley/live/`. Packaged apps pull, verify, and soft-reload.

Local dry-run (needs private key):

```bash
npm run live-ui:publish
```

### One-time live-patch signing setup

1. Generate keys (if missing): `npm run live-ui:keys`
2. Commit **`build/live-patch-public.pem`** only
3. Repo secret: `SMILEY_LIVE_PATCH_PRIVATE_KEY` = contents of `build/live-patch-private.pem`  
   (`gh secret set SMILEY_LIVE_PATCH_PRIVATE_KEY < build/live-patch-private.pem`)
4. Never commit the private key (gitignored)

Rotating keys requires shipping a new full release with the new public key.

## Full release (installer / privileged code)

```bash
# 1. Bump version in package.json (e.g. 2.1.1 → 2.1.2)
# 2. Commit your changes
git add -A && git commit -m "Release v2.1.2"

# 3. Tag and push — GitHub Actions builds + publishes installers
git tag v2.1.2
git push origin main --tags
```

Within ~15–30 minutes, CI uploads installers to [Releases](https://github.com/1tsRajuWu/Smiley/releases). Installed users get the update via `electron-updater`.

### After bumping version

1. Update download URLs in **README.md** (or wait for CI `update-readme-downloads`)
2. Add notes at `docs/releases/v{VERSION}.md` (CI attaches them)

## One-time GitHub setup

1. **Repository secrets** (Settings → Secrets → Actions):
   - `DISCORD_CLIENT_ID` — Discord Application ID
   - `SMILEY_LIVE_PATCH_PRIVATE_KEY` — ed25519 private PEM for live UI
2. **Workflows**: `.github/workflows/release.yml` (tags), `.github/workflows/pages.yml` (site + live UI)

## What users experience

### Live UI patch

| Step | What happens |
|------|----------------|
| App launch / every ~45 min | GET signed manifest from GitHub Pages |
| Newer UI patch | Download zip → verify hash + signature → extract to `userData/live-ui` |
| Applied | Window soft-reloads — **no installer dialog** |

### Full app update

| Version kind | What users see |
|--|--|
| **Patch / minor** (7.9.x → 7.9.y / 7.10.0) | Silent download; applies on quit — **no** “Restart to update” banner |
| **Major** (7.x → 8.0.0) | Banner asks to reinstall / restart |

Manual **Check for Updates** always shows status so you can confirm what’s pending.

Users can also use **Settings → Check for Updates** or tray → **Check for Updates**.

## Manual publish (from your Mac/PC)

```bash
echo '{"clientId":"YOUR_ID"}' > discord.app.json
npm ci
npm run publish    # builds + uploads to GitHub Releases
```

Requires `GH_TOKEN` with `repo` scope, or logged-in `gh auth`.

## Version numbering

- Use **semver** in `package.json`: `MAJOR.MINOR.PATCH`
- Tag must match: `v2.1.2` for version `2.1.2`
- Live UI `patchVersion` is a date stamp (independent of app semver); `minAppVersion` gates old clients

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Users don't get full updates | Packaged install only (not `npm start`) |
| Live UI not applying | Need a release that includes the live-patch client; secret must be set; check About → live UI hint |
| Signature errors after key rotate | Ship full release with new public PEM |
| CI fails on discord.app.json | Add `DISCORD_CLIENT_ID` secret |
| macOS "app is damaged" | See [INSTALL-MAC.md](../INSTALL-MAC.md) / [NOTARIZATION.md](./NOTARIZATION.md) |
| Windows SmartScreen | Code-signing cert, or “More info → Run anyway” |

---

© Raj (@1tsRaj) — [Smiley](https://github.com/1tsRajuWu/Smiley)
