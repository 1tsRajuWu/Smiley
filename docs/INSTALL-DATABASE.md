# Install database (anonymous, legal-minimal)

Track **how many people installed Smiley** without collecting personal data.

## What is stored

| Field | Example | Notes |
|-------|---------|--------|
| `install_id` | random UUID | Generated on device; not tied to Discord or your Mac/Windows account |
| `platform` | `darwin` | macOS, Windows, or Linux |
| `arch` | `arm64` | CPU type |
| `app_version` | `4.1.11` | Smiley version at first opt-in |
| `first_seen_at` | UTC timestamp | When the row was created |

**Not stored:** name, email, IP address, country, Discord ID, hostname, serial number, or files from your PC.

## User consent

- **Off by default** — Settings → General → **Share anonymous install count (opt-in)**
- Sends **one request** when the user turns this on (or on next launch if already on)
- Disclosed in [PRIVACY.md](../PRIVACY.md)

## Setup (developer)

### 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Open **SQL Editor** → paste [scripts/install-database-schema.sql](../scripts/install-database-schema.sql) → Run

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

and create `downloads.registry.json` in the mac/win/linux build steps (same pattern as `discord.app.json`).

### 4. View installs

Supabase **Table Editor → installs**, or run:

```sql
select platform, arch, app_version, count(*) as installs
from public.installs
group by 1, 2, 3
order by installs desc;
```

## GitHub download counts

GitHub Releases still shows **per-file download totals** (anonymous, aggregate). The install database counts **opt-in active installs** — useful when you want installed-base vs raw DMG clicks.
