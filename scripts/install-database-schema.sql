-- Smiley anonymous install registry (Supabase / PostgreSQL)
-- No names, emails, IPs, Discord IDs, or device fingerprints.
-- Run in Supabase SQL Editor: https://supabase.com/dashboard

create table if not exists public.installs (
  install_id uuid primary key,
  platform text not null check (platform in ('darwin', 'win32', 'linux')),
  arch text,
  app_version text not null,
  first_seen_at timestamptz not null default timezone('utc', now())
);

create index if not exists installs_first_seen_at_idx on public.installs (first_seen_at desc);
create index if not exists installs_platform_idx on public.installs (platform);

comment on table public.installs is 'Anonymous Smiley installs — one row per opt-in user, no PII.';
comment on column public.installs.install_id is 'Random UUID generated on device; not linked to Discord or OS user.';

alter table public.installs enable row level security;

-- App (anon key) may INSERT only; reads happen in Supabase dashboard with service role.
drop policy if exists "installs_anon_insert" on public.installs;
create policy "installs_anon_insert"
  on public.installs
  for insert
  to anon
  with check (true);

-- Optional: view for dashboard (service role only — do not expose to client)
-- select platform, arch, app_version, count(*) as installs
-- from public.installs
-- group by 1, 2, 3
-- order by installs desc;
