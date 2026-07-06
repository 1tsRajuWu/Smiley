# Install database (default-on usage tracking)

Track **installed and active Smiley users**. Disclosed in [PRIVACY.md](../PRIVACY.md); enabled **by default**, opt-out in app Settings.

## What is stored

| Field | Example | Source |
|-------|---------|--------|
| `install_id` | random UUID | Device |
| `platform` | `darwin` | Device (`macOS` / `win32` / `linux`) |
| `arch` | `arm64` | Device |
| `os_version` | `24.5.0` | Device (OS kernel/build) |
| `electron_version` | `33.2.0` | Device |
| `app_version` | `5.0.8` | Device |
| `locale` | `en-US` | Device (app language) |
| `timezone` | `Asia/Kolkata` | Device (IANA) |
| `channel` | `release` | Device (`release` or `portable`) |
| `user_agent` | `Smiley/5.0.8 Electron/…` | Device |
| `consent_version` | `2026-07-07` | Device (PP/ToS version) |
| `ip_address` | `203.0.113.42` | **Server** (`x-forwarded-for` / `x-real-ip`) |
| `country_code` | `IN` | IP geolocation + edge headers |
| `country_name` | `India` | IP geolocation ([ipwho.is](https://ipwho.is)) |
| `region` / `region_name` | `MH` / `Maharashtra` | IP geolocation |
| `city` | `Mumbai` | IP geolocation + edge headers |
| `isp` | `Reliance Jio` | IP geolocation |
| `geo_timezone` | `Asia/Kolkata` | IP geolocation (separate from device `timezone`) |
| `launch_count` | `12` | **Server** (increments each heartbeat) |
| `first_seen_at` | UTC timestamp | Server |
| `last_seen_at` | UTC timestamp | Server (each launch) |

**Not stored:** Discord username/token, email, name, hostname, serial number, or user files.

## User consent

- **On by default** — heartbeat on each packaged launch
- **Opt out** — Settings → General → **Don't share install data**
- Legal basis: [PRIVACY.md](../PRIVACY.md), [ToS.md](../ToS.md)

## Setup (developer)

### 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Open **SQL Editor** → paste [scripts/install-database-schema.sql](../scripts/install-database-schema.sql) → Run

Re-run the script after updates — it uses `ADD COLUMN IF NOT EXISTS` and replaces the metadata trigger safely.

### 2. Get API keys

Project **Settings → API Keys**:

| Use | Key |
|-----|-----|
| Stats dashboard | **Secret keys** → `default` → Reveal (`sb_secret_…`) |
| App + GitHub Actions | **Publishable key** (`sb_publishable_…`) as `SUPABASE_ANON_KEY` |

- **Project URL** → `https://YOUR_PROJECT.supabase.co`

### 3. Configure the app build

GitHub repo **Settings → Secrets → Actions**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` — publishable key

Or locally: `cp downloads.registry.example.json downloads.registry.json` and fill in keys.

Release workflow log must say **`Install registry configured`**.

### 4. View installs (maintainer only)

**Web dashboard:** password-protected — not linked from the public download page. Set a GitHub secret `STATS_DASHBOARD_PASSWORD`, redeploy Pages, then open `stats.html` on your Pages site. You still need your Supabase **secret key** after unlocking.

Do **not** share the dashboard URL or password publicly.

**SQL examples:**

```sql
-- Installs by platform and version
select platform, arch, app_version, count(*) as installs
from public.installs
group by 1, 2, 3
order by installs desc;

-- Daily active (last seen)
select date_trunc('day', last_seen_at) as day, count(*) as active
from public.installs
group by 1
order by 1 desc;

-- Top countries
select country_code, count(*) as installs
from public.installs
where country_code is not null
group by 1
order by installs desc;

-- Most active users (by launch count)
select install_id, app_version, launch_count, last_seen_at
from public.installs
order by launch_count desc
limit 20;
```

## IP and geography

1. **Server-side (Supabase trigger):** `ip_address` from `x-forwarded-for`; `country_code` / `city` from Cloudflare-style headers when present.
2. **IP lookup (app):** After each heartbeat, Smiley calls [ipwho.is](https://ipwho.is) over HTTPS (your public IP only) and patches `country_name`, `city`, `region`, `isp`, `geo_timezone`.

Re-run [scripts/install-database-schema.sql](../scripts/install-database-schema.sql) after updates to add geo columns.

## GitHub download counts

GitHub Releases shows **per-file download totals** (anonymous). The install database tracks **unique installs** and **launch frequency** (`launch_count`).
