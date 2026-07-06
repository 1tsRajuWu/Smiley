# `scripts/` — Build & release helpers

Shell/Node scripts used when **building** Smiley — not loaded by the app at runtime.

| Script | What it does |
|--------|----------------|
| `generate-icons.sh` | Regenerate `build/icon*` from master logo (`npm run icons`) |
| `afterSign-mac.js` | electron-builder hook — Mac notarization |
| `update-readme-downloads.sh` | Refresh download links in README (`npm run update-readme-downloads`) |
| `validate-gif-options.mjs` | Check activity GIF mappings |
| `install-database-schema.sql` | Supabase schema for opt-in install stats |
| `build-native-all.sh` | Build Smiley.Native for all platforms |
| `build-native.sh` | Build Smiley.Native for one target (e.g. `osx-arm64`) |
| `build-native.ps1` | Windows native build (PowerShell) |

Run from **repo root**, e.g.:

```bash
npm run icons
bash scripts/build-native-all.sh
```

See [README-NATIVE.md](../README-NATIVE.md) for native builds.
