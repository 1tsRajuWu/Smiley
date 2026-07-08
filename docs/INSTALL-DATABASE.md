# Install database (mandatory usage telemetry)

Track **installed and active Smiley users**. Disclosed in [PRIVACY.md](../PRIVACY.md); **required** for using packaged builds — no opt-out.

## What is stored

| Field | Example | Source |
|-------|---------|--------|
| `install_id` | random UUID | Device |
| `platform` | `darwin` | Device |
| `arch` | `arm64` | Device |
| `os_version` | `24.5.0` | Device |
| `electron_version` | `33.2.0` | Device |
| `app_version` | `7.9.27` | Device |
| `locale` | `en-US` | Device |
| `timezone` | `Asia/Kolkata` | Device |
| `channel` | `release` | Device |
| `user_agent` | `Smiley/7.9.27 Electron/…` | Device |
| `consent_version` | `2026-07-08` | Device |
| `ip_address` | SHA-256 hash | **Server** |
| `country_code`, `country_name`, `region`, `region_name`, `city`, `isp`, `geo_timezone` | geo fields | IP geolocation + edge headers |
| `launch_count` | `12` | **Server** (increments each heartbeat) |
| `first_seen_at`, `last_seen_at` | UTC timestamps | Server |
| `last_activity_section`, `last_activity_source`, `active_sections`, `section_overview` | section summary | Device + Server |

**Not stored:** Discord username/token, email, name, hostname, serial number, or user files.

## Sectioned telemetry tables

The schema now includes two additive rollup tables linked to `installs`:

- `install_sections`: one row per install + feature area such as `app`, `activity`, `music_sync`, `game_sync`, and `coding_sync`
- `install_section_sources`: one row per install + section + source, such as a music player app, coding editor, game provider, or selected activity preset

These rows store counters and latest sanitized metadata like:

- launches/seen counts by section
- latest source label seen in a section
- latest track/game/editor/activity label
- lightweight metadata such as album presence, coding status, game mode/map, or activity category

This is intended to answer dashboard questions like install overview, usage by sync type, latest source seen, and top sources by section without storing Discord tokens, Riot lockfile secrets, passwords, or message content.

## User notice

- **Mandatory** — heartbeat on each packaged launch
- First-run modal is informational only (Continue to acknowledge)

## Setup (developer)

1. Create a Supabase project and run [scripts/install-database-schema.sql](../scripts/install-database-schema.sql) in SQL Editor.
2. Set GitHub secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, and **`SUPABASE_ACCESS_TOKEN`** (Supabase dashboard → Account → Access Tokens).
   - For **schema migrations** (GitHub Actions → *Apply Supabase schema*), the workflow **prefers `SUPABASE_ACCESS_TOKEN`** (no database password needed).
   - Optional fallback: **`SUPABASE_DB_URL`** as the full Session pooler URI, e.g. `postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`. Do **not** paste host, password, or JDBC string alone. URL-encode special characters in the password (`@` → `%40`, `#` → `%23`). No surrounding quotes. Without a valid token or URI, the workflow fails instead of skipping.
3. Trigger [`.github/workflows/supabase-schema.yml`](../.github/workflows/supabase-schema.yml) to apply schema and backfill geo.

**Backfill existing rows:**

```bash
SUPABASE_SERVICE_KEY=sb_secret_… node scripts/backfill-install-geo.js
```
