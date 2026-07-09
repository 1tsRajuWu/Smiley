# Smiley repository layout

Two desktop platforms live in dedicated folders. Everything else at the repo root is shared (docs, legal, CI, infra scripts).

## Desktop apps

| Platform | Path | Stack | Status |
|----------|------|-------|--------|
| **v8** (shipping) | [`Smiley.v8/`](Smiley.v8/) | Tauri + Rust + Vite | Public downloads, `release-v8.yml` on `v8.*` tags |
| **v7** (archived) | [`legacy/electron-v7/`](legacy/electron-v7/) | Electron + Node | Reference / forks only, `release.yml` on `v7.*` tags |

### Smiley v8 — `Smiley.v8/`

```
Smiley.v8/
├── package.json          # Frontend + Tauri scripts
├── src/                  # UI (TypeScript, skins)
├── src-tauri/            # Rust backend (riot, music, privacy, Discord)
└── docs/                 # NEWBIE-MAP, PRIVACY-SECURITY
```

Run locally: `cd Smiley.v8 && npm install && npm run tauri dev`

### Smiley v7 — `legacy/electron-v7/`

```
legacy/electron-v7/
├── package.json          # Electron app + electron-builder
├── main.js               # Main process
├── preload.js            # IPC bridge
├── electron/             # Backend modules (gaming, music, RPC)
├── src/                  # Renderer UI
├── build/                # Icons, entitlements, installer assets
├── scripts/              # v7 build, signing, live-ui patch
└── mobile/               # Capacitor Android/iOS companion
```

Run locally:

```bash
cd legacy/electron-v7
npm install
cp discord.app.example.json discord.app.json
npm start
```

## Shared at repo root

| Path | Purpose |
|------|---------|
| `README.md` | User-facing download page (v8) |
| `PLATFORM-UPGRADE.md` | Agent handoff — which tree to edit |
| `docs/` | Release notes, GitHub Pages site (`docs/site/`) |
| `scripts/` | Repo-wide infra (README downloads, v8 checks, Supabase SQL) |
| `Smiley.Native/` | Optional .NET native experiment |
| `.github/workflows/` | CI: v8 release, v7 release, Pages, Android |

## CI mapping

| Workflow | Working directory |
|----------|-------------------|
| `release-v8.yml` | `Smiley.v8/` |
| `release.yml` (v7 tags) | `legacy/electron-v7/` |
| `pages.yml` | repo root (`npm run live-ui:publish` delegates to v7) |
| `mobile-android.yml` | `legacy/electron-v7/mobile/` |

## Quick reference

- **New UI / presence / security work** → `Smiley.v8/`
- **Electron v7 maintenance or forks** → `legacy/electron-v7/`
- **Website** → `docs/site/` (unchanged)
- **Newbie map** → `Smiley.v8/docs/NEWBIE-MAP.md`

See also: [PLATFORM-UPGRADE.md](PLATFORM-UPGRADE.md) · [legacy/electron-v7/README.md](legacy/electron-v7/README.md) · [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md) (v7 code tour)
