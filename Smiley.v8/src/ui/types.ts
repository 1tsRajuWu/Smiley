export type Activity = {
  id: string;
  details: string;
  state: string;
  emoji: string;
  category: string;
  color: string;
  gif: string;
};

export type Category = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  activities: Activity[];
};

export type MatchPlayer = {
  seat: string;
  name: string;
  agent?: string | null;
  agentId?: string | null;
  agentIcon?: string | null;
  kda?: string | null;
  isSelf: boolean;
  team?: string | null;
};

export type MatchBoard = {
  active: boolean;
  product: string;
  title: string;
  details: string;
  state: string;
  phase: string;
  map?: string | null;
  mode?: string | null;
  score?: string | null;
  party?: string | null;
  selfAgent?: string | null;
  selfKda?: string | null;
  players: MatchPlayer[];
  updatedAt: number;
};

export type Status = {
  connected: boolean;
  message: string;
  activityId?: string | null;
  details?: string | null;
  state?: string | null;
  gif?: string | null;
  paused: boolean;
  elapsedSecs?: number | null;
  rotateActive: boolean;
  matchBoard?: MatchBoard | null;
};

export type CustomActivity = {
  id: string;
  details: string;
  state: string;
  emoji: string;
  gif?: string | null;
};

export type SkinId = "studio" | "arcade" | "terminal" | "zen";

export type Config = {
  skin: SkinId | string;
  themeAccent: string;
  autoConnect: boolean;
  minimizeToTray: boolean;
  launchMinimized: boolean;
  confirmClear: boolean;
  favoritesFirst: boolean;
  reduceMotion: boolean;
  showElapsed: boolean;
  showButton: boolean;
  buttonLabel: string;
  buttonUrl: string;
  largeText: string;
  donationUrl: string;
  showDonate: boolean;
  wallpaperEnabled: boolean;
  gamingProbe: boolean;
  liveGaming: boolean;
  musicNowPlaying: boolean;
  staticTiles: boolean;
  idleEnabled: boolean;
  idleDetails: string;
  idleState: string;
  idleGif: string;
  rotateEnabled: boolean;
  rotateSeconds: number;
  rotateFavoritesOnly: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  gridDensity: string;
  defaultCategory: string;
  maxRecents: number;
  toastEnabled: boolean;
  focusSearchOnOpen: boolean;
  rememberLast: boolean;
  presenceCooldownMs: number;
  favorites: string[];
  recents: string[];
  lastActivityId?: string | null;
  custom: CustomActivity[];
  theme: string;
};

export type Snapshot = {
  version: string;
  status: Status;
  config: Config;
  categories: Category[];
};

export const SKINS: { id: SkinId; title: string; forWho: string }[] = [
  { id: "studio", title: "Studio", forWho: "Visual & creative" },
  { id: "arcade", title: "Arcade", forWho: "Gamers & neon" },
  { id: "terminal", title: "Terminal", forWho: "Power users" },
  { id: "zen", title: "Zen", forWho: "Calm & minimal" },
];

export function formatElapsed(secs?: number | null): string {
  if (secs == null || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function allActivities(snap: Snapshot): Activity[] {
  return snap.categories.flatMap((c) => c.activities);
}

export function findActivity(snap: Snapshot, id?: string | null) {
  return id ? allActivities(snap).find((a) => a.id === id) : undefined;
}

export function listActivities(snap: Snapshot, cat: string, query: string): Activity[] {
  const q = query.trim().toLowerCase();
  let list = allActivities(snap);
  if (q) {
    list = list.filter(
      (a) =>
        a.details.toLowerCase().includes(q) ||
        a.state.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.emoji.includes(q),
    );
  } else if (cat === "favorites") {
    const favs = new Set(snap.config.favorites);
    list = list.filter((a) => favs.has(a.id));
  } else {
    list = list.filter((a) => a.category === cat);
  }
  if (snap.config.favoritesFirst) {
    const favs = new Set(snap.config.favorites);
    list = [...list].sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)));
  }
  return list;
}

export function normalizeSkin(raw?: string | null): SkinId {
  if (raw === "arcade" || raw === "cabinet") return "arcade";
  if (raw === "terminal" || raw === "console") return "terminal";
  if (raw === "zen") return "zen";
  return "studio";
}
