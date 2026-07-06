-- Smiley install registry (Supabase / PostgreSQL)
-- Default-on install/usage tracking with legal-minimal fields (see PRIVACY.md).
-- Run in Supabase SQL Editor: https://supabase.com/dashboard

create table if not exists public.installs (
  install_id uuid primary key,
  platform text not null check (platform in ('darwin', 'win32', 'linux')),
  arch text,
  app_version text not null,
  user_agent text,
  consent_version text,
  ip_address text,
  country_code text,
  region text,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

-- Migrate existing tables (safe to re-run)
alter table public.installs add column if not exists user_agent text;
alter table public.installs add column if not exists consent_version text;
alter table public.installs add column if not exists ip_address text;
alter table public.installs add column if not exists country_code text;
alter table public.installs add column if not exists region text;
alter table public.installs add column if not exists last_seen_at timestamptz default timezone('utc', now());

update public.installs
set last_seen_at = coalesce(last_seen_at, first_seen_at)
where last_seen_at is null;

create index if not exists installs_first_seen_at_idx on public.installs (first_seen_at desc);
create index if not exists installs_last_seen_at_idx on public.installs (last_seen_at desc);
create index if not exists installs_platform_idx on public.installs (platform);

comment on table public.installs is 'Smiley installs — one row per install_id; IP captured server-side from request headers.';
comment on column public.installs.install_id is 'Random UUID generated on device; not linked to Discord username or OS login.';
comment on column public.installs.ip_address is 'Client public IP from x-forwarded-for / x-real-ip on REST insert/update (Supabase edge).';
comment on column public.installs.consent_version is 'Privacy Policy / ToS version acknowledged when data was sent.';

-- Capture IP and refresh last_seen_at on every insert/update from the app (anon REST).
create or replace function public.set_install_request_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  headers json;
  forwarded text;
begin
  begin
    headers := current_setting('request.headers', true)::json;
  exception
    when others then
      headers := '{}'::json;
  end;

  forwarded := coalesce(
    nullif(trim(headers->>'x-forwarded-for'), ''),
    nullif(trim(headers->>'x-real-ip'), ''),
    nullif(trim(headers->>'cf-connecting-ip'), '')
  );

  if forwarded is not null then
    new.ip_address := trim(split_part(forwarded, ',', 1));
  end if;

  new.last_seen_at := timezone('utc', now());

  if tg_op = 'INSERT' and new.first_seen_at is null then
    new.first_seen_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists installs_set_request_metadata on public.installs;
create trigger installs_set_request_metadata
  before insert or update on public.installs
  for each row
  execute function public.set_install_request_metadata();

alter table public.installs enable row level security;

-- App (anon key) may INSERT and UPDATE (upsert) only; reads use service role in dashboard.
drop policy if exists "installs_anon_insert" on public.installs;
create policy "installs_anon_insert"
  on public.installs
  for insert
  to anon
  with check (true);

drop policy if exists "installs_anon_update" on public.installs;
create policy "installs_anon_update"
  on public.installs
  for update
  to anon
  using (true)
  with check (true);

-- Optional: view for dashboard (service role only — do not expose to client)
-- select platform, arch, app_version, count(*) as installs
-- from public.installs
-- group by 1, 2, 3
-- order by installs desc;
