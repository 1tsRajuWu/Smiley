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
| `app_version` | `5.0.17` | Device |
| `locale` | `en-US` | Device |
| `timezone` | `Asia/Kolkata` | Device |
| `channel` | `release` | Device |
| `user_agent` | `Smiley/5.0.17 Electron/…` | Device |
| `consent_version` | `2026-07-09` | Device |
| `ip_address` | SHA-256 hash | **Server** |
| `country_code`, `country_name`, `region`, `region_name`, `city`, `isp`, `geo_timezone` | geo fields | IP geolocation + edge headers |
| `launch_count` | `12` | **Server** (increments each heartbeat) |
| `first_seen_at`, `last_seen_at` | UTC timestamps | Server |

**Not stored:** Discord username/token, email, name, hostname, serial number, or user files.

## User notice

- **Mandatory** — heartbeat on each packaged launch
- First-run modal is informational only (Continue to acknowledge)

## Setup (developer)

1. Create a Supabase project and run [scripts/install-database-schema.sql](../scripts/install-database-schema.sql) in SQL Editor.
2. Set GitHub secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, optionally `SUPABASE_DB_URL`.
   - For **schema migrations** (GitHub Actions → *Apply Supabase schema*): add **`SUPABASE_DB_URL`** *or* **`SUPABASE_ACCESS_TOKEN`** (Supabase dashboard → Account → Access Tokens). Without one of these, the workflow fails instead of skipping.
   - **`SUPABASE_DB_URL` must be the full URI**, e.g. `postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres` (Session mode). Do **not** paste host, password, or JDBC string alone. URL-encode special characters in the password (`@` → `%40`, `#` → `%23`). No surrounding quotes.
3. Trigger [`.github/workflows/supabase-schema.yml`](../.github/workflows/supabase-schema.yml) to apply schema and backfill geo.

**Backfill existing rows:**

```bash
SUPABASE_SERVICE_KEY=sb_secret_… node scripts/backfill-install-geo.js
```
