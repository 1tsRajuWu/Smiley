# `scripts/` — Repo-wide build & infra helpers

Shell/Node scripts at the **repository root** — not loaded by either desktop app at runtime.

| Script | What it does |
|--------|----------------|
| `update-readme-downloads.sh` | Refresh download links in README (`npm run update-readme-downloads`) |
| `v8-game-presence-check.js` | Valorant presence self-check for v8 (`npm run v8-game-presence-check`) |
| `sync-v8-icons.sh` | Copy icons into Smiley.v8 |
| `verify-mac-v8-bundle.sh` | Post-build macOS v8 bundle checks |
| `install-database-schema.sql` | Supabase schema for opt-in install stats |
| `apply-install-schema-management-api.js` | Apply schema via Supabase API |
| `build-native-all.sh` | Build Smiley.Native for all platforms |

**v7 Electron scripts** moved to [`legacy/electron-v7/scripts/`](../legacy/electron-v7/scripts/) (icons, signing, live-ui patch, game-presence-check, etc.).

Run from **repo root**, e.g.:

```bash
npm run update-readme-downloads
npm run v8-game-presence-check
bash scripts/build-native-all.sh
```

See [README-NATIVE.md](../README-NATIVE.md) for native builds · [STRUCTURE.md](../STRUCTURE.md) for folder layout.
