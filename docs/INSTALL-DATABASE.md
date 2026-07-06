# Install database (default-on usage tracking)

Track **installed and active Smiley users** with legal-minimal fields. Disclosed in [PRIVACY.md](../PRIVACY.md); enabled **by default**, opt-out in app Settings.

## What is stored

| Field | Example | Notes |
|-------|---------|--------|
| `install_id` | random UUID | Generated on device; not tied to Discord or OS account |
| `ip_address` | `203.0.113.42` | **Server-side** from `x-forwarded-for` / `x-real-ip` on Supabase REST |
| `platform` | `darwin` | macOS, Windows, or Linux |
| `arch` | `arm64` | CPU type |
| `app_version` | `4.1.13` | Smiley version at last heartbeat |
| `user_agent` | `Smiley/4.1.13 Electron/…` | App + runtime string from client |
| `consent_version` | `2026-07-06` | PP/ToS version acknowledged |
| `country_code`, `region` | `US`, `CA` | Optional; populate via edge geolocation if desired |
| `first_seen_at` | UTC timestamp | First heartbeat |
| `last_seen_at` | UTC timestamp | Updated on each launch (upsert) |

**Not stored:** Discord username/token, email, name, hostname, serial number, or user files.

## User consent

- **On by default** — heartbeat on each packaged launch
- **Opt out** — Settings → General → **Don't share install data**
- Legal basis and rights: [PRIVACY.md](../PRIVACY.md), [ToS.md](../ToS.md)

## Setup (developer)

### 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Open **SQL Editor** → paste [scripts/install-database-schema.sql](../scripts/install-database-schema.sql) → Run

The schema includes a `BEFORE INSERT OR UPDATE` trigger that sets `ip_address` from `current_setting('request.headers')` and refreshes `last_seen_at`.

### 2. Get API keys

Project **Settings → API**:

- **Project URL** → `supabaseUrl`
- **anon public** key → `supabaseAnonKey`

### 3. Configure the app build

Copy the example file and fill in your keys (do **not** commit the real file):

```bash
cp downloads.registry.example.json downloads.registry.json
```

For **GitHub Actions** releases, add secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

The release workflow creates `downloads.registry.json` per platform when secrets are set.

### 4. View installs

Supabase **Table Editor → installs**, or run:

```sql
select platform, arch, app_version, count(*) as installs
from public.installs
group by 1, 2, 3
order by installs desc;

select date_trunc('day', last_seen_at) as day, count(*) as active
from public.installs
group by 1
order by 1 desc;
```

## IP and geography

IP is captured **in Postgres** when the Electron app POSTs to `/rest/v1/installs` — Supabase injects request headers into `current_setting('request.headers', true)`. No client-side IP lookup is performed.

Optional `country_code` / `region` columns are reserved for a future Edge Function or external geolocation; they remain null unless you add that pipeline.

## GitHub download counts

GitHub Releases still shows **per-file download totals** (anonymous, aggregate). The install database tracks **active installs** (last seen) vs one-time DMG clicks.
