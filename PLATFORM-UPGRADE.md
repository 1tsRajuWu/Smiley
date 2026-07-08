# Platform upgrade — for other chats / agents

**Status (2026-07-08):** **Smiley v8.0.7** is the recommended desktop download (Tauri + Rust).

## Do this in other conversations

1. Prefer **`Smiley.v8/`** for new UI / presence / security work.
2. Repo-root Electron (`main.js`, `electron/`, `src/`) is **v7.9.x legacy** — see `legacy/electron-v7/README.md`.
3. v8 safe live layers (no malware patterns):
   - Custom Tenor GIF activities
   - **Riot lockfile Valorant** — local match board + privacy toggles (`riot.rs`, `privacy.rs`)
   - **Music** Spotify/Apple Music (`music.rs`)
   - Process gaming probe optional
4. Donation = PayPal tip (`paypal.me/1tsRaj`). Discord = Application Client ID + desktop IPC — **not a bot**.
5. Website + GitHub release **v8.0.7** point end users at native installers.
6. v8 in-app updates: `docs/RELEASING-V8-SIGNING.md` — `TAURI_SIGNING_PRIVATE_KEY` GitHub secret required for signed `latest.json`.

## Newbie map

`Smiley.v8/docs/NEWBIE-MAP.md` · Privacy: `Smiley.v8/docs/PRIVACY-SECURITY.md`
