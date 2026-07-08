# Changelog

All notable Smiley releases are documented here. Full release notes live in [docs/releases/](releases/).

## [7.9.25] — 2026-07-08

### Fixed
- Valorant Team Deathmatch Discord score missing: `TeamDeathmatch` ModeID no longer misclassified as FFA Deathmatch
- TDM parses `NumPoints` / chat ally–enemy; DM stays kills-only; spike modes keep round scores
- Richer in-match state (agent · map · score · party · mode) without trackers or injection

## [7.9.24] — 2026-07-08

### Fixed
- Steam Discord `small_image` used a 404 URL (spinner); now Steam client capsule AppID 753
- Fixtures for CS2 lobby / in-match presence + validated Twitch logos for Fortnite/OW/Roblox/Minecraft

## [7.9.23] — 2026-07-08

### Fixed
- Steam / CS2 live Rich Presence: game logo capsule + title + Playing (no vague “In the zone”)
- Steam AppID/artwork re-applied every poll from TTL cache (was dropped after first resolve)
- Non-Riot games (Fortnite / OW / Roblox / Minecraft) share CDN GAME_LOGOS

### Notes
- Discord streak badges are Discord’s feature — Smiley does not set them

## [7.9.0] — 2026-07-08

### Added
- Gaming Rich Presence settings panel with per-field toggles
- Discord preview card in settings (state pills + live session)
- Optional encrypted Riot API key for Valorant rank on Discord
- Small image overlay (agent / rank badge) on gaming presence
- Match elapsed timer on Discord (in-match only)
- Website redesign — orange + navy palette, music & gaming hero features

### Changed
- Valorant presence: map/mode large art, pipe-separated state lines per phase
- Queue and lobby states distinguished via Riot provisioning flow

### Project status
- **v8.0.0 announced as the final planned release** — occasional bug fixes after that; community forks welcome. See [FINAL.md](FINAL.md).

## [7.8.3] — 2026-07-08

- Valorant lobby vs in-match presence fix; corrected valorant-api UUIDs

Earlier history: [docs/releases/](releases/)
