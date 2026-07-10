-- Richer install telemetry columns (safe to re-run)
-- Apply in Supabase SQL Editor after install-database-schema.sql

alter table public.installs add column if not exists runtime_kind text;
alter table public.installs add column if not exists tauri_version text;
alter table public.installs add column if not exists ui_skin text;
alter table public.installs add column if not exists last_game_title text;
alter table public.installs add column if not exists last_game_state text;
alter table public.installs add column if not exists last_game_seen_at timestamptz;
alter table public.installs add column if not exists wallpaper_enabled boolean;
alter table public.installs add column if not exists app_channel text;
alter table public.installs add column if not exists host_os_name text;
alter table public.installs add column if not exists last_music_source text;
alter table public.installs add column if not exists last_music_title text;
alter table public.installs add column if not exists last_music_seen_at timestamptz;
alter table public.installs add column if not exists last_coding_source text;
alter table public.installs add column if not exists last_coding_title text;
alter table public.installs add column if not exists last_coding_seen_at timestamptz;
alter table public.installs add column if not exists music_enabled boolean;
alter table public.installs add column if not exists game_enabled boolean;
alter table public.installs add column if not exists coding_enabled boolean;
alter table public.installs add column if not exists client_heartbeat_at timestamptz;

comment on column public.installs.runtime_kind is 'electron | tauri — which desktop shell reported this install.';
comment on column public.installs.tauri_version is 'Tauri crate / shell version when runtime_kind=tauri.';
comment on column public.installs.ui_skin is 'Optional UI skin id (legacy v8).';
comment on column public.installs.last_game_title is 'Last detected game title from gaming sync.';
comment on column public.installs.last_game_state is 'Last detected game state line.';
comment on column public.installs.wallpaper_enabled is 'Whether animated wallpaper was enabled at last heartbeat (legacy).';
comment on column public.installs.app_channel is 'release | portable | stable | beta | local-dev';
comment on column public.installs.host_os_name is 'Friendly OS name (macOS, Windows, Linux distro).';
comment on column public.installs.last_music_source is 'Latest music player label (Spotify, Apple Music, …).';
comment on column public.installs.last_music_title is 'Latest track title seen while Listening.';
comment on column public.installs.last_coding_source is 'Latest coding editor/app label.';
comment on column public.installs.last_coding_title is 'Latest coding window/project label.';
comment on column public.installs.music_enabled is 'Music Now Playing toggle at last heartbeat.';
comment on column public.installs.game_enabled is 'Gaming sync / probe enabled at last heartbeat.';
comment on column public.installs.coding_enabled is 'Coding Now Playing enabled at last heartbeat.';
comment on column public.installs.client_heartbeat_at is 'Client-sent UTC timestamp on each launch heartbeat; used to increment launch_count without counting geo patches.';

create index if not exists installs_runtime_kind_idx on public.installs (runtime_kind);
create index if not exists installs_last_game_seen_at_idx on public.installs (last_game_seen_at desc);
create index if not exists installs_ui_skin_idx on public.installs (ui_skin);
create index if not exists installs_app_channel_idx on public.installs (app_channel);
create index if not exists installs_last_music_seen_at_idx on public.installs (last_music_seen_at desc);
create index if not exists installs_last_coding_seen_at_idx on public.installs (last_coding_seen_at desc);
create index if not exists installs_client_heartbeat_at_idx on public.installs (client_heartbeat_at desc);
