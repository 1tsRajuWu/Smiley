-- One-time migration: store SHA-256 hash of IP instead of raw IP (see SECURITY.md).
-- Run in Supabase SQL Editor after deploying app v5.0.7+.

create extension if not exists pgcrypto;

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

-- Optional: hash existing raw IPs (irreversible; run once if you stored raw IPs before)
-- update public.installs
-- set ip_address = encode(digest(ip_address || ':smiley-ip-hash-v1', 'sha256'), 'hex')
-- where ip_address is not null and ip_address !~ '^[a-f0-9]{64}$';
