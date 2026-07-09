# Smiley repository layout

Two desktop platforms live in dedicated folders. Everything else at the repo root is shared (docs, legal, CI, infra scripts).

## Desktop apps

| Platform | Path | Stack | Status |
|----------|------|-------|--------|
| **v12** (shipping) | [`Smiley.v12/`](Smiley.v12/) | Tauri + Rust + Vite | Public downloads, `release-v12.yml` on `v12.*` tags |
| **v7** (archived) | [`legacy/electron-v7/`](legacy/electron-v7/) | Electron + Node | Reference / forks only, `release.yml` on `v7.*` tags |
| **v8** (archived) | [`legacy/smiley-v8-archived/`](legacy/smiley-v8-archived/) | Tauri + Rust | Superseded by v12 — do not ship |

### Smiley v12 — `Smiley.v12/`

```
Smiley.v12/
├── package.json          # Frontend + Tauri scripts
├── src/                  # UI (TypeScript, 4 skins)
├── src-tauri/            # Rust backend (riot, music, privacy, Discord)
└── docs/                 # NEWBIE-MAP, V12-SCOPE, PRIVACY-SECURITY
```

Run locally: `cd Smiley.v12 && npm install && npm run tauri dev`

### Smiley v7 — `legacy/electron-v7/`

```
legacy/electron-v7/
├── package.json          # Electron app + electron-builder
├── main.js               # Main process
├── electron/             # Backend modules (gaming, music, RPC)
└── src/                  # Renderer UI
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
| `README.md` | User-facing download page (v12) |
| `PLATFORM-UPGRADE.md` | Agent handoff — which tree to edit |
| `docs/` | Release notes, GitHub Pages site (`docs/site/`) |
| `scripts/` | Repo-wide infra (README downloads, v12 checks, Supabase SQL) |
| `.github/workflows/` | CI: v12 release, v7 release, Pages |

## CI mapping

| Workflow | Working directory |
|----------|-------------------|
| `release-v12.yml` | `Smiley.v12/` |
| `release-v8.yml` | *(legacy — use v12)* |
| `release.yml` (v7 tags) | `legacy/electron-v7/` |
| `pages.yml` | repo root |

## Quick reference

- **New UI / presence / security work** → `Smiley.v12/`
- **Electron v7 maintenance or forks** → `legacy/electron-v7/`
- **Old v8 tree** → `legacy/smiley-v8-archived/` (read-only reference)
- **Website** → `docs/site/`
- **Newbie map** → `Smiley.v12/docs/NEWBIE-MAP.md`

See also: [PLATFORM-UPGRADE.md](PLATFORM-UPGRADE.md) · [Smiley.v12/docs/V12-SCOPE.md](Smiley.v12/docs/V12-SCOPE.md)
