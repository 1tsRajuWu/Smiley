# Smiley v12 — updater signing (one-time)

Tauri’s in-app updater **requires minisign signatures**. The public key is embedded in `Smiley.v12/src-tauri/tauri.conf.json`; CI signs releases with the matching private key.

## GitHub secret (required for v12 releases)

| Secret | Value |
|--------|--------|
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of the minisign **private** key file (one line, base64) |

Optional: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key was generated with a password (repo key has **no** password).

### Generate a new keypair (only if rotating or starting fresh)

```bash
cd Smiley.v12
printf '\n' | npm run tauri signer generate -w ~/.tauri/smiley-v12.key -p ""
```

- **Private:** `~/.tauri/smiley-v12.key` → paste into GitHub secret `TAURI_SIGNING_PRIVATE_KEY`. **Never commit.**
- **Public:** `~/.tauri/smiley-v12.key.pub` → paste into `tauri.conf.json` → `plugins.updater.pubkey`.

If you rotate keys, existing installs signed with the **old** public key cannot verify updates until users reinstall once from GitHub.

## CI / release

`.github/workflows/release-v12.yml` passes `TAURI_SIGNING_PRIVATE_KEY` to `tauri-action`, which:

1. Builds with `bundle.createUpdaterArtifacts: true`
2. Uploads `.sig` files and platform updater bundles (e.g. macOS `.app.tar.gz`)
3. Publishes `latest.json` on the GitHub release (`includeUpdaterJson` default)

The workflow keeps each v12 release as a **draft** until every matrix job finishes, then publishes it. That avoids exposing a half-built `latest.json` that only contains one platform.

Endpoint in the app:

`https://github.com/1tsRajuWu/Smiley/releases/latest/download/latest.json`

## macOS without notarization

Smiley v12 uses **ad-hoc** code signing (`signingIdentity: "-"`). Tauri updater still works: it verifies the **minisign** signature on the update archive, replaces the app bundle, and relaunches. Users may see Gatekeeper prompts when opening the updated app — install from `/Applications` and use the same workflow as v7.

## Local signed build test

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/smiley-v12.key)"
cd Smiley.v12 && npm run desktop
```

Artifacts appear under `src-tauri/target/release/bundle/` (updater `.tar.gz` + `.sig` on macOS).
