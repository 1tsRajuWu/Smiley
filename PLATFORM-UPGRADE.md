# Platform upgrade — for other chats / agents

**Status (2026-07-08):** Smiley v8 (Tauri + Rust) is the next major desktop platform.

## Do this in other conversations

1. Prefer **`Smiley.v8/`** for new UI / presence / security work.
2. Treat repo-root Electron (`main.js`, `electron/`, `src/`) as **v7.9.x shipping** — see `legacy/electron-v7/README.md`.
3. Full live **gaming status** still lands first on Electron; v8 has a **light, timed process probe** (`gaming.rs`) until full parity.
4. Donation = PayPal tip (`paypal.me/1tsRaj`). Discord = Application Client ID + desktop IPC — **not a bot**.
5. After gaming-status parity on v8 is solid, tag/release and point the website download rows at v8 artifacts.

## Newbie map

`Smiley.v8/docs/NEWBIE-MAP.md`
