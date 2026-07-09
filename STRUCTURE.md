# Smiley repository layout

**Smiley v12** is the only shipping desktop app. v7 and v8 live under `legacy/` for reference and forks.

## Desktop apps

| Platform | Path | Stack | Status |
|----------|------|-------|--------|
| **v12** (shipping) | [`Smiley.v12/`](Smiley.v12/) | Tauri + Rust + Vite | **Final** — `release-v12.yml` on `v12.*` tags; bugfix only |
| **v7** (archived) | [`legacy/electron-v7/`](legacy/electron-v7/) | Electron + Node | Reference / forks only, `release.yml` on `v7.*` tags |
| **v8** (archived) | [`legacy/smiley-v8/`](legacy/smiley-v8/) | Tauri + Rust | Superseded by v12 — do not ship |

### Smiley v12 — `Smiley.v12/`

```
Smiley.v12/
├── package.json          # Frontend + Tauri scripts (version 12.0.x)
├── src/                  # UI (TypeScript, 4 skins)
├── src-tauri/            # Rust backend (riot, music, privacy, Discord)
└── docs/                 # NEWBIE-MAP, FINAL-V12, V12-SCOPE, PRIVACY-SECURITY
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

### Smiley v8 — `legacy/smiley-v8/`

Archived Tauri tree from the v8 patch line. Read-only reference; all shipping work is in `Smiley.v12/`.

## Shared at repo root

| Path | Purpose |
|------|---------|
| `README.md` | User-facing download page (v12.0.x) |
| `PLATFORM-UPGRADE.md` | Agent handoff — **frozen** at v12 |
| `docs/` | Release notes, GitHub Pages site (`docs/site/`) |
| `docs/FINAL.md` | Author note — v12 is final |
| `scripts/` | Repo-wide infra (README downloads, v12 checks, Supabase SQL) |
| `.github/workflows/` | CI: v12 release (active), v7 release, Pages |
| `Smiley.Native/` | Optional lightweight native build (~25 MB) |
| `legacy/` | Archived v7 + v8 desktop trees |

## CI mapping

| Workflow | Working directory | Status |
|----------|-------------------|--------|
| `release-v12.yml` | `Smiley.v12/` | **Active** — `v12.*` tags |
| `release-v8.yml` | — | **Deprecated** — `workflow_dispatch` only |
| `release.yml` (v7 tags) | `legacy/electron-v7/` | Legacy |
| `pages.yml` | repo root | GitHub Pages → `docs/site/` |

## Quick reference

- **Bug fixes only** → `Smiley.v12/`
- **Electron v7 maintenance or forks** → `legacy/electron-v7/`
- **Old v8 tree** → `legacy/smiley-v8/` (read-only reference)
- **Website** → `docs/site/`
- **Newbie map** → `Smiley.v12/docs/NEWBIE-MAP.md`
- **Final release policy** → `Smiley.v12/docs/FINAL-V12.md`

See also: [PLATFORM-UPGRADE.md](PLATFORM-UPGRADE.md) · [Smiley.v12/docs/V12-SCOPE.md](Smiley.v12/docs/V12-SCOPE.md)
