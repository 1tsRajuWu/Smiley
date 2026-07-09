# Platform upgrade — for other chats / agents

**Status (2026-07-09):** **Smiley v12.0.0** is the **final shipping** desktop app (Tauri + Rust). Website and README promote v12 only.

## Do this in other conversations

1. Prefer **`Smiley.v12/`** for all new UI / presence / security work.
2. **`Smiley.v8/`** is archived under `legacy/smiley-v8-archived/` — do not ship or patch.
3. Repo-root Electron is **archived v7.9.x** under `legacy/electron-v7/` — reference only; see `legacy/electron-v7/README.md`.
4. v12 safe live layers (no malware patterns):
   - Custom Tenor GIF activities
   - **Riot lockfile Valorant** — local presence (map, self agent, score) + privacy toggles (`riot.rs`, `privacy.rs`) — **no roster board**
   - **Music** Spotify/Apple Music + system players (`music.rs`, macOS mediaremote-adapter stream)
   - Process gaming probe optional
5. Donation = PayPal tip (`paypal.me/1tsRaj`). Discord = Application Client ID + desktop IPC — **not a bot**.
6. Website + GitHub release **v12.0.0** point end users at native installers.
7. v12 in-app updates: `TAURI_SIGNING_PRIVATE_KEY` GitHub secret required for signed `latest.json` on `v12.*` tags.

## Newbie map

[`STRUCTURE.md`](STRUCTURE.md) (repo layout) · [`Smiley.v12/docs/NEWBIE-MAP.md`](Smiley.v12/docs/NEWBIE-MAP.md) · [`Smiley.v12/docs/V12-SCOPE.md`](Smiley.v12/docs/V12-SCOPE.md) · Privacy: `Smiley.v12/docs/PRIVACY-SECURITY.md`
