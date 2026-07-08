-- Smiley v8 / richer install telemetry (safe to re-run)
-- Apply in Supabase SQL Editor after install-database-schema.sql

alter table public.installs add column if not exists runtime_kind text;
alter table public.installs add column if not exists tauri_version text;
alter table public.installs add column if not exists ui_skin text;
alter table public.installs add column if not exists last_game_title text;
alter table public.installs add column if not exists last_game_state text;
alter table public.installs add column if not exists last_game_seen_at timestamptz;
alter table public.installs add column if not exists wallpaper_enabled boolean;
alter table public.installs add column if not exists app_channel text;

comment on column public.installs.runtime_kind is 'electron | tauri | native — which desktop shell reported this install.';
comment on column public.installs.tauri_version is 'Tauri crate / shell version when runtime_kind=tauri.';
comment on column public.installs.ui_skin is 'Active Smiley v8 skin id (studio/arcade/terminal/zen).';
comment on column public.installs.last_game_title is 'Last detected game title from light/full gaming sync.';
comment on column public.installs.last_game_state is 'Last detected game state line.';
comment on column public.installs.wallpaper_enabled is 'Whether animated wallpaper was enabled at last heartbeat.';
comment on column public.installs.app_channel is 'stable | beta | local-dev';

create index if not exists installs_runtime_kind_idx on public.installs (runtime_kind);
create index if not exists installs_last_game_seen_at_idx on public.installs (last_game_seen_at desc);
create index if not exists installs_ui_skin_idx on public.installs (ui_skin);
