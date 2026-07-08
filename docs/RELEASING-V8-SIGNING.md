# Smiley v8 — updater signing (one-time)

Tauri’s in-app updater **requires minisign signatures**. The public key is embedded in `Smiley.v8/src-tauri/tauri.conf.json`; CI signs releases with the matching private key.

## GitHub secret (required for v8.0.7+ releases)

| Secret | Value |
|--------|--------|
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of the minisign **private** key file (one line, base64) |

Optional: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key was generated with a password (repo key has **no** password).

### Generate a new keypair (only if rotating or starting fresh)

```bash
cd Smiley.v8
printf '\n' | npm run tauri signer generate -w ~/.tauri/smiley-v8.key -p ""
```

- **Private:** `~/.tauri/smiley-v8.key` → paste into GitHub secret `TAURI_SIGNING_PRIVATE_KEY`. **Never commit.**
- **Public:** `~/.tauri/smiley-v8.key.pub` → paste into `tauri.conf.json` → `plugins.updater.pubkey`.

If you rotate keys, existing installs signed with the **old** public key cannot verify updates until users reinstall once from GitHub.

## CI / release

`.github/workflows/release-v8.yml` passes `TAURI_SIGNING_PRIVATE_KEY` to `tauri-action`, which:

1. Builds with `bundle.createUpdaterArtifacts: true`
2. Uploads `.sig` files and platform updater bundles (e.g. macOS `.app.tar.gz`)
3. Publishes `latest.json` on the GitHub release (`includeUpdaterJson` default)

Endpoint in the app:

`https://github.com/1tsRajuWu/Smiley/releases/latest/download/latest.json`

## macOS without notarization

Smiley v8 uses **ad-hoc** code signing (`signingIdentity: "-"`). Tauri updater still works: it verifies the **minisign** signature on the update archive, replaces the app bundle, and relaunches. Users may see Gatekeeper prompts when opening the updated app — install from `/Applications` and use the same workflow as v7.

## Local signed build test

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/smiley-v8.key)"
cd Smiley.v8 && npm run desktop
```

Artifacts appear under `src-tauri/target/release/bundle/` (updater `.tar.gz` + `.sig` on macOS).
