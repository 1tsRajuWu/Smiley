-- Hotfix: install heartbeats were failing with
--   function digest(text, unknown) does not exist
-- because pgcrypto lives in the `extensions` schema on Supabase and the
-- trigger search_path was `public` only. Safe to re-run.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgcrypto;

alter table public.installs add column if not exists client_heartbeat_at timestamptz;

create or replace function public.set_install_request_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  headers json;
  forwarded text;
  country_hdr text;
  region_hdr text;
  city_hdr text;
  ip_raw text;
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
    ip_raw := trim(split_part(forwarded, ',', 1));
    new.ip_address := encode(
      extensions.digest(convert_to(ip_raw || ':smiley-ip-hash-v1', 'UTF8'), 'sha256'::text),
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
    -- Prefer client_heartbeat_at (set only by app heartbeats, not geo patches).
    if new.client_heartbeat_at is distinct from old.client_heartbeat_at then
      new.launch_count := coalesce(old.launch_count, 1) + 1;
    elsif
      new.app_version is not distinct from old.app_version
      and new.user_agent is not distinct from old.user_agent
      and new.consent_version is not distinct from old.consent_version
      and new.section_overview is not distinct from old.section_overview
      and new.last_activity_section is not distinct from old.last_activity_section
      and new.os_version is not distinct from old.os_version
      and new.locale is not distinct from old.locale
      and new.timezone is not distinct from old.timezone
      and (
        new.country_code is distinct from old.country_code
        or new.country_name is distinct from old.country_name
        or new.region is distinct from old.region
        or new.region_name is distinct from old.region_name
        or new.city is distinct from old.city
        or new.isp is distinct from old.isp
        or new.geo_timezone is distinct from old.geo_timezone
        or new.ip_address is distinct from old.ip_address
      )
    then
      new.launch_count := coalesce(old.launch_count, 1);
    else
      new.launch_count := coalesce(old.launch_count, 1) + 1;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists installs_set_request_metadata on public.installs;
create trigger installs_set_request_metadata
  before insert or update on public.installs
  for each row
  execute function public.set_install_request_metadata();
