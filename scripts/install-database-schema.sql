-- Smiley install registry (Supabase / PostgreSQL)
-- Default-on install/usage tracking (see PRIVACY.md).
-- Run in Supabase SQL Editor: https://supabase.com/dashboard

create extension if not exists pgcrypto;

create table if not exists public.installs (
  install_id uuid primary key,
  platform text not null check (platform in ('darwin', 'win32', 'linux')),
  arch text,
  app_version text not null,
  os_version text,
  electron_version text,
  locale text,
  timezone text,
  channel text,
  user_agent text,
  consent_version text,
  ip_address text,
  country_code text,
  region text,
  country_name text,
  region_name text,
  city text,
  isp text,
  geo_timezone text,
  launch_count integer not null default 1,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

-- Migrate existing tables (safe to re-run)
alter table public.installs add column if not exists user_agent text;
alter table public.installs add column if not exists consent_version text;
alter table public.installs add column if not exists ip_address text;
alter table public.installs add column if not exists country_code text;
alter table public.installs add column if not exists region text;
alter table public.installs add column if not exists country_name text;
alter table public.installs add column if not exists region_name text;
alter table public.installs add column if not exists city text;
alter table public.installs add column if not exists isp text;
alter table public.installs add column if not exists geo_timezone text;
alter table public.installs add column if not exists last_seen_at timestamptz default timezone('utc', now());
alter table public.installs add column if not exists os_version text;
alter table public.installs add column if not exists electron_version text;
alter table public.installs add column if not exists locale text;
alter table public.installs add column if not exists timezone text;
alter table public.installs add column if not exists channel text;
alter table public.installs add column if not exists launch_count integer default 1;
alter table public.installs add column if not exists last_activity_section text;
alter table public.installs add column if not exists last_activity_source text;
alter table public.installs add column if not exists last_activity_seen_at timestamptz;
alter table public.installs add column if not exists active_sections integer default 0;
alter table public.installs add column if not exists section_overview jsonb not null default '{}'::jsonb;

update public.installs set launch_count = 1 where launch_count is null;
alter table public.installs alter column launch_count set default 1;
alter table public.installs alter column launch_count set not null;

update public.installs
set last_seen_at = coalesce(last_seen_at, first_seen_at)
where last_seen_at is null;

create index if not exists installs_first_seen_at_idx on public.installs (first_seen_at desc);
create index if not exists installs_last_seen_at_idx on public.installs (last_seen_at desc);
create index if not exists installs_platform_idx on public.installs (platform);
create index if not exists installs_country_code_idx on public.installs (country_code);
create index if not exists installs_city_idx on public.installs (city);
create index if not exists installs_app_version_idx on public.installs (app_version);
create index if not exists installs_last_activity_section_idx on public.installs (last_activity_section);
create index if not exists installs_last_activity_seen_at_idx on public.installs (last_activity_seen_at desc);

comment on table public.installs is 'Smiley installs — one row per install_id; IP/country captured server-side from request headers.';
comment on column public.installs.install_id is 'Random UUID on device; not linked to Discord username or OS login.';
comment on column public.installs.ip_address is 'SHA-256 hash of client IP + static salt (not raw IP).';
comment on column public.installs.country_code is 'ISO 3166-1 alpha-2 from edge headers or IP geolocation.';
comment on column public.installs.country_name is 'Country name from IP geolocation (ipwho.is).';
comment on column public.installs.city is 'City from edge headers or IP geolocation.';
comment on column public.installs.isp is 'ISP/org from IP geolocation.';
comment on column public.installs.geo_timezone is 'IANA timezone derived from IP (may differ from device timezone).';
comment on column public.installs.launch_count is 'Incremented server-side on each heartbeat (UPDATE).';
comment on column public.installs.os_version is 'OS kernel/build string (e.g. macOS Darwin version).';
comment on column public.installs.locale is 'App UI locale (e.g. en-US).';
comment on column public.installs.timezone is 'IANA timezone from the device (e.g. Asia/Kolkata).';
comment on column public.installs.last_activity_section is 'Latest telemetry section seen for this install (music_sync, game_sync, coding_sync, activity, app).';
comment on column public.installs.last_activity_source is 'Latest source label seen inside the latest section (player/editor/provider/activity id).';
comment on column public.installs.section_overview is 'Per-section usage summary posted by the app; contains counts and latest source labels.';

create table if not exists public.install_sections (
  install_id uuid not null references public.installs (install_id) on delete cascade,
  section_key text not null,
  section_label text not null,
  enabled boolean not null default false,
  launch_count integer not null default 0,
  seen_count integer not null default 0,
  last_source_key text,
  last_source_label text,
  last_source_group text,
  last_title text,
  last_state text,
  last_metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (install_id, section_key)
);

alter table public.install_sections add column if not exists section_label text;
alter table public.install_sections add column if not exists enabled boolean default false;
alter table public.install_sections add column if not exists launch_count integer default 0;
alter table public.install_sections add column if not exists seen_count integer default 0;
alter table public.install_sections add column if not exists last_source_key text;
alter table public.install_sections add column if not exists last_source_label text;
alter table public.install_sections add column if not exists last_source_group text;
alter table public.install_sections add column if not exists last_title text;
alter table public.install_sections add column if not exists last_state text;
alter table public.install_sections add column if not exists last_metadata jsonb default '{}'::jsonb;
alter table public.install_sections add column if not exists first_seen_at timestamptz;
alter table public.install_sections add column if not exists last_seen_at timestamptz;
alter table public.install_sections add column if not exists updated_at timestamptz default timezone('utc', now());

update public.install_sections set launch_count = 0 where launch_count is null;
update public.install_sections set seen_count = 0 where seen_count is null;
update public.install_sections set last_metadata = '{}'::jsonb where last_metadata is null;
alter table public.install_sections alter column section_label set not null;
alter table public.install_sections alter column enabled set default false;
alter table public.install_sections alter column enabled set not null;
alter table public.install_sections alter column launch_count set default 0;
alter table public.install_sections alter column launch_count set not null;
alter table public.install_sections alter column seen_count set default 0;
alter table public.install_sections alter column seen_count set not null;
alter table public.install_sections alter column last_metadata set default '{}'::jsonb;
alter table public.install_sections alter column last_metadata set not null;

create table if not exists public.install_section_sources (
  install_id uuid not null references public.installs (install_id) on delete cascade,
  section_key text not null,
  source_key text not null,
  source_label text not null,
  source_group text,
  launch_count integer not null default 0,
  seen_count integer not null default 0,
  last_title text,
  last_state text,
  last_metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (install_id, section_key, source_key)
);

alter table public.install_section_sources add column if not exists source_label text;
alter table public.install_section_sources add column if not exists source_group text;
alter table public.install_section_sources add column if not exists launch_count integer default 0;
alter table public.install_section_sources add column if not exists seen_count integer default 0;
alter table public.install_section_sources add column if not exists last_title text;
alter table public.install_section_sources add column if not exists last_state text;
alter table public.install_section_sources add column if not exists last_metadata jsonb default '{}'::jsonb;
alter table public.install_section_sources add column if not exists first_seen_at timestamptz;
alter table public.install_section_sources add column if not exists last_seen_at timestamptz;
alter table public.install_section_sources add column if not exists updated_at timestamptz default timezone('utc', now());

update public.install_section_sources set launch_count = 0 where launch_count is null;
update public.install_section_sources set seen_count = 0 where seen_count is null;
update public.install_section_sources set last_metadata = '{}'::jsonb where last_metadata is null;
alter table public.install_section_sources alter column source_label set not null;
alter table public.install_section_sources alter column launch_count set default 0;
alter table public.install_section_sources alter column launch_count set not null;
alter table public.install_section_sources alter column seen_count set default 0;
alter table public.install_section_sources alter column seen_count set not null;
alter table public.install_section_sources alter column last_metadata set default '{}'::jsonb;
alter table public.install_section_sources alter column last_metadata set not null;

create index if not exists install_sections_section_key_idx on public.install_sections (section_key);
create index if not exists install_sections_last_seen_at_idx on public.install_sections (last_seen_at desc);
create index if not exists install_sections_seen_count_idx on public.install_sections (seen_count desc);
create index if not exists install_section_sources_section_key_idx on public.install_section_sources (section_key);
create index if not exists install_section_sources_source_label_idx on public.install_section_sources (source_label);
create index if not exists install_section_sources_last_seen_at_idx on public.install_section_sources (last_seen_at desc);
create index if not exists install_section_sources_seen_count_idx on public.install_section_sources (seen_count desc);

comment on table public.install_sections is 'Per-install rollups by telemetry section such as app, activity, music_sync, game_sync, and coding_sync.';
comment on table public.install_section_sources is 'Per-install rollups by section source such as player app, game provider, coding editor, or activity preset.';

-- IP, country, launch_count, last_seen_at on every insert/update from the app (anon REST).
create or replace function public.set_install_request_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  headers json;
  forwarded text;
  country_hdr text;
  region_hdr text;
  city_hdr text;
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

  if forwarded is not null and coalesce(auth.role(), '') is distinct from 'service_role' then
    new.ip_address := encode(
      digest(trim(split_part(forwarded, ',', 1)) || ':smiley-ip-hash-v1', 'sha256'),
      'hex'
    );
  end if;

  country_hdr := coalesce(
    nullif(trim(headers->>'cf-ipcountry'), ''),
    nullif(trim(headers->>'x-vercel-ip-country'), ''),
    nullif(trim(headers->>'x-country-code'), '')
  );
  if country_hdr is not null and length(country_hdr) <= 8 then
    new.country_code := upper(country_hdr);
  end if;

  city_hdr := coalesce(
    nullif(trim(headers->>'cf-ipcity'), ''),
    nullif(trim(headers->>'x-vercel-ip-city'), '')
  );
  if city_hdr is not null and length(city_hdr) <= 64 and new.city is null then
    new.city := city_hdr;
  end if;

  region_hdr := coalesce(
    nullif(trim(headers->>'cf-region'), ''),
    nullif(trim(headers->>'x-vercel-ip-country-region'), '')
  );
  if region_hdr is not null and length(region_hdr) <= 64 then
    new.region := region_hdr;
  end if;

  new.last_seen_at := timezone('utc', now());

  if tg_op = 'INSERT' then
    if new.first_seen_at is null then
      new.first_seen_at := timezone('utc', now());
    end if;
    if new.launch_count is null or new.launch_count < 1 then
      new.launch_count := 1;
    end if;
  elsif tg_op = 'UPDATE' then
    new.launch_count := coalesce(old.launch_count, 1) + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists installs_set_request_metadata on public.installs;
create trigger installs_set_request_metadata
  before insert or update on public.installs
  for each row
  execute function public.set_install_request_metadata();

create or replace function public.set_install_section_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  if new.first_seen_at is null and coalesce(new.seen_count, 0) > 0 then
    new.first_seen_at := timezone('utc', now());
  end if;
  if coalesce(new.seen_count, 0) > 0 and new.last_seen_at is null then
    new.last_seen_at := timezone('utc', now());
  end if;
  return new;
end;
$$;

drop trigger if exists install_sections_set_timestamps on public.install_sections;
create trigger install_sections_set_timestamps
  before insert or update on public.install_sections
  for each row
  execute function public.set_install_section_timestamps();

drop trigger if exists install_section_sources_set_timestamps on public.install_section_sources;
create trigger install_section_sources_set_timestamps
  before insert or update on public.install_section_sources
  for each row
  execute function public.set_install_section_timestamps();

alter table public.installs enable row level security;
alter table public.install_sections enable row level security;
alter table public.install_section_sources enable row level security;

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

drop policy if exists "install_sections_anon_insert" on public.install_sections;
create policy "install_sections_anon_insert"
  on public.install_sections
  for insert
  to anon
  with check (true);

drop policy if exists "install_sections_anon_update" on public.install_sections;
create policy "install_sections_anon_update"
  on public.install_sections
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "install_section_sources_anon_insert" on public.install_section_sources;
create policy "install_section_sources_anon_insert"
  on public.install_section_sources
  for insert
  to anon
  with check (true);

drop policy if exists "install_section_sources_anon_update" on public.install_section_sources;
create policy "install_section_sources_anon_update"
  on public.install_section_sources
  for update
  to anon
  using (true)
  with check (true);
