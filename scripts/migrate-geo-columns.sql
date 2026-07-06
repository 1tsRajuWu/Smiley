-- Geo columns migration (safe to re-run). Paste into Supabase SQL Editor → Run.

alter table public.installs add column if not exists country_name text;
alter table public.installs add column if not exists region_name text;
alter table public.installs add column if not exists city text;
alter table public.installs add column if not exists isp text;
alter table public.installs add column if not exists geo_timezone text;

create index if not exists installs_city_idx on public.installs (city);

comment on column public.installs.country_name is 'Country name from IP geolocation.';
comment on column public.installs.city is 'City from edge headers or IP geolocation.';
comment on column public.installs.isp is 'ISP from IP geolocation.';
comment on column public.installs.geo_timezone is 'IANA timezone from IP geolocation.';

-- Refresh trigger (city from cf-ipcity + existing IP/country logic)
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

  if forwarded is not null then
    new.ip_address := trim(split_part(forwarded, ',', 1));
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
