# Smiley on macOS — install & Gatekeeper

Smiley is **ad-hoc signed** but **not notarized** by Apple. We do not have an Apple Developer account ($99/year) yet, so macOS 13+ may block the app with:

> **Smiley Not Opened** — Apple could not verify Smiley is free of malware that may harm your Mac or compromise your privacy.

This is **not** a damaged file. The app is **safe** — [open source on GitHub](https://github.com/1tsRajuWu/Smiley). You only need to approve it once.

Notarization will remove this step when we have a Developer certificate. See [docs/NOTARIZATION.md](docs/NOTARIZATION.md) for the maintainer plan.

---

## Method A — Right-click Open (easiest)

1. Download the `.dmg` for your Mac ([Releases](https://github.com/1tsRajuWu/Smiley/releases/latest)) — ARM64 for Apple Silicon, x64 for Intel.
2. Open the DMG and drag **Smiley** **once** into the **Applications** folder alias (on the right). Do not drag the Applications icon itself, and do not drag multiple times — each drag adds another copy.
3. **Eject** the DMG (right-click the mounted disk → Eject). The app on the disk image is not your installed copy.
4. Open **Applications**, **right-click Smiley → Open** (do **not** double-click).
5. Click **Open** in the dialog that appears.
6. After the first successful launch, double-click works forever.

**See multiple Smiley apps?** Delete extras (`Smiley 2`, `Smiley 3`, …) in Applications and keep only `/Applications/Smiley.app`. You likely dragged more than once or ran from the DMG without ejecting.

---

## Method B — Terminal (if still blocked)

Clear quarantine flags on the download and/or installed app:

```bash
xattr -cr ~/Downloads/Smiley-*.dmg
# after installing to Applications:
xattr -cr /Applications/Smiley.app
```

Or use the repo script (clone or download from GitHub):

```bash
chmod +x scripts/install-mac.sh
./scripts/install-mac.sh /Applications/Smiley.app
```

Then **right-click → Open** once as in Method A.

---

## Method C — System Settings

1. Try to open Smiley (you may get the block dialog; click **Done**).
2. Open **System Settings → Privacy & Security**.
3. Scroll down — you should see **Smiley was blocked** with **Open Anyway**.
4. Click **Open Anyway** and confirm.

---


## Duplicate apps in Applications?

Each release DMG contains a single **Smiley.app** (ARM64 and Intel are separate files). Drag **once** into **Applications**. If you see **Smiley 2.app** or multiple copies, remove the extras and keep one **Smiley.app**.

## FAQ

**Why not just sign it?**  
We ad-hoc sign every build (`scripts/afterSign-mac.js`). That fixes some "damaged" errors but **does not replace Apple notarization**. Only notarization removes the "could not verify" dialog for most users.

**Is it malware?**  
No. Inspect the source, build yourself with `npm run build:mac`, or compare checksums from [Releases](https://github.com/1tsRajuWu/Smiley/releases).

**DMG install sheet**  
The `.dmg` includes **INSTALL.txt** with a short version of Method A.

**Why do I have 2–3 Smiley apps in Applications?**  
Each drag from the DMG adds a copy (`Smiley.app`, `Smiley 2.app`, …). Drag **once**, eject the DMG, and delete any extras. Keep only `/Applications/Smiley.app`. Do not run Smiley from the mounted disk image after copying.

---

[← Back to README](README.md)
