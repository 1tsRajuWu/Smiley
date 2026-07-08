# Platform upgrade — for other chats / agents

**Status (2026-07-08):** Smiley v8 (Tauri + Rust) is the next major desktop platform.

## Do this in other conversations

1. Prefer **`Smiley.v8/`** for new UI / presence / security work.
2. Treat repo-root Electron (`main.js`, `electron/`, `src/`) as **v7.9.x shipping** — see `legacy/electron-v7/README.md`.
3. v8 now has **safe live layers** (no malware patterns):
   - Custom GIF activities (Tenor HTTPS)
   - **Riot lockfile Valorant/LoL** presence (`riot.rs`) — local only, timed HTTPS to 127.0.0.1
   - **Music** Spotify/Apple Music (`music.rs`) — timed osascript with hard kill
   - Process gaming probe still optional
4. Donation = PayPal tip (`paypal.me/1tsRaj`). Discord = Application Client ID + desktop IPC — **not a bot**.
5. After full Electron-depth parity (agent/map/score art, multi-provider), tag/release and point website downloads at v8.

## Newbie map

`Smiley.v8/docs/NEWBIE-MAP.md`
