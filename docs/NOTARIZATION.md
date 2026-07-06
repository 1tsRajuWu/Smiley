# macOS notarization (future — requires Apple Developer account)

Smiley is currently distributed **ad-hoc signed** only. That is enough for some Gatekeeper cases but **not** for the macOS 13+ dialog:

> Apple could not verify Smiley is free of malware…

**Permanent fix:** sign with a **Developer ID Application** certificate and **notarize** with Apple, then staple the ticket to the `.app` and `.dmg`.

Until then, users must right-click → Open once (see [INSTALL-MAC.md](../INSTALL-MAC.md)).

---

## Prerequisites

1. **Apple Developer Program** membership ($99/year) — [developer.apple.com/programs](https://developer.apple.com/programs/)
2. **Developer ID Application** certificate (Keychain / Xcode → Certificates)
3. Machine with **Xcode Command Line Tools** (`xcode-select --install`)
4. **App-specific password** for `notarytool` (Apple ID → Sign-In and Security → App-Specific Passwords)

Store secrets in CI, never in the repo:

| Secret | Purpose |
|--------|---------|
| `APPLE_ID` | Apple ID email for notarytool |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Team ID from developer.apple.com |
| `CSC_LINK` | Base64 `.p12` of Developer ID Application cert |
| `CSC_KEY_PASSWORD` | Password for the `.p12` |

---

## electron-builder configuration

In `package.json` → `build.mac`:

```json
{
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAMID)",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist",
    "notarize": true
  }
}
```

Or use env vars (recommended for CI):

```bash
export CSC_LINK="$(base64 -i DeveloperID.p12)"
export CSC_KEY_PASSWORD="..."
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

Remove ad-hoc-only settings:

- `"identity": "-"` → real Developer ID identity
- Keep `scripts/afterSign-mac.js` only if you still need extra nested signing; otherwise electron-builder + `notarize` may be sufficient

electron-builder 25 supports `notarize: true` (uses `@electron/notarize` / `notarytool`).

---

## Local notarization workflow

```bash
npm ci
npm run build:mac

# Manual notarytool (if not using electron-builder notarize hook):
xcrun notarytool submit dist/Smiley-2.1.9-arm64.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

xcrun stapler staple dist/mac-arm64/Smiley.app
xcrun stapler staple dist/Smiley-2.1.9-arm64.dmg
```

Verify:

```bash
spctl -a -vv /Applications/Smiley.app
# Expected: accepted / Notarized Developer ID
```

---

## GitHub Actions (`.github/workflows/release.yml`)

After secrets are set:

1. Import `CSC_LINK` / `CSC_KEY_PASSWORD` on the macOS runner (electron-builder does this automatically).
2. Set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
3. Enable `mac.notarize: true` in `package.json`.
4. Tag push builds notarized `.dmg` / `.zip` artifacts.

Test on a clean Mac (or VM) without prior right-click Open.

---

## Checklist when Raj gets a Developer account

- [ ] Enroll in Apple Developer Program
- [ ] Create Developer ID Application certificate
- [ ] Add CI secrets (`CSC_*`, `APPLE_*`)
- [ ] Update `package.json` `mac.identity` and `notarize: true`
- [ ] Decide whether to remove or narrow `afterSign-mac.js` ad-hoc script
- [ ] Run release build, verify `spctl` and fresh-user open (no dialog)
- [ ] Update README / INSTALL-MAC.md — notarization complete, Methods B/C optional
- [ ] Optional: sign DMG (`dmg.sign: true`) if distributing `.dmg` outside the app bundle staple

---

## References

- [electron-builder — macOS code signing](https://www.electron.build/code-signing#macos)
- [Apple — Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [notarytool](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow)
