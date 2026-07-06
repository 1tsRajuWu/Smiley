# Releasing Smiley — Push Updates to Installed Users

Installed Smiley apps (Electron) **check GitHub Releases automatically** on launch and download updates in the background. Users restart when prompted.

## Quick release (3 steps)

```bash
# 1. Bump version in package.json (e.g. 2.1.1 → 2.1.2)
# 2. Commit your changes
git add -A && git commit -m "Release v2.1.2"

# 3. Tag and push — GitHub Actions builds + publishes installers
git tag v2.1.2
git push origin main --tags
```

That's it. Within ~15–30 minutes, GitHub Actions uploads `.dmg`, `.exe`, and Linux packages to [Releases](https://github.com/1tsRaj/smiley-rpc/releases). Installed users get the update automatically.

## One-time GitHub setup

1. **Repository secret** (Settings → Secrets → Actions):
   - `DISCORD_CLIENT_ID` = your Discord Application ID (`1522538045989982279`)

2. **Workflow** is at `.github/workflows/release.yml` — runs on every `v*` tag push.

3. **First release**: push a tag after merging to `main`.

## What users experience

| Step | What happens |
|------|----------------|
| App launch | Checks GitHub for newer version (5s after open) |
| Update found | Downloads silently in background |
| Download done | Dialog + banner: **"Restart to update"** |
| User restarts | New version installed |

Users can also use **Settings → Check for Updates** or tray → **Check for Updates**.

## Manual publish (from your Mac/PC)

If you prefer building locally instead of CI:

```bash
# Ensure discord.app.json exists with your Client ID
echo '{"clientId":"YOUR_ID"}' > discord.app.json

npm ci
npm run publish    # builds + uploads to GitHub Releases
```

Requires `GH_TOKEN` env var with `repo` scope, or logged-in `gh auth`.

## Version numbering

- Use **semver** in `package.json`: `MAJOR.MINOR.PATCH`
- Tag must match: `v2.1.2` for version `2.1.2`

## Smiley.Native (.NET)

The lightweight native app does **not** auto-update yet. Users download new builds from GitHub Releases.

- On startup, Native checks GitHub and opens the releases page if a newer version exists.
- See [RELEASING-NATIVE.md](./RELEASING-NATIVE.md) for building native binaries.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Users don't get updates | Ensure they installed from a **packaged** build (not `npm start`) |
| CI fails on discord.app.json | Add `DISCORD_CLIENT_ID` secret in repo settings |
| macOS "app is damaged" | Code-sign the build, or users right-click → Open |
| Windows SmartScreen | Sign with a code-signing cert, or users click "More info → Run anyway" |

---

© Raj (@1tsRaj) — [smiley-rpc](https://github.com/1tsRaj/smiley-rpc)
