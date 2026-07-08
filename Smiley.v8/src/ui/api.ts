import { invoke } from "@tauri-apps/api/core";
import type { Config, CustomActivity, Snapshot, Status } from "./types";

export type GameHit = {
  id: string;
  title: string;
  details: string;
  state: string;
};

export const api = {
  snapshot: () => invoke<Snapshot>("get_snapshot"),
  connect: () => invoke<Status>("connect"),
  setActivity: (activityId: string) => invoke<Status>("set_activity", { activityId }),
  clear: () => invoke<Status>("clear_activity"),
  pause: (paused: boolean) => invoke<Status>("set_paused", { paused }),
  idle: () => invoke<Status>("set_idle"),
  rotateOnce: () => invoke<Status | null>("rotate_once"),
  status: () => invoke<Status>("get_status"),
  saveConfig: (config: Config) => invoke<Config>("save_config", { config }),
  resetConfig: () => invoke<Config>("reset_config"),
  toggleFavorite: (activityId: string) =>
    invoke<Config>("toggle_favorite", { activityId }),
  addCustom: (activity: CustomActivity) => invoke<Config>("add_custom", { activity }),
  removeCustom: (activityId: string) =>
    invoke<Config>("remove_custom", { activityId }),
  probeGame: () => invoke<GameHit | null>("probe_game"),
  log: (message: string) => invoke<void>("append_log", { message }),
  /** Donate opens only from Rust allowlist (no arbitrary https from UI). */
  openDonate: () => invoke<void>("open_donation_url"),
};

export function errMsg(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as Error).message);
  return String(e);
}

/** Escape text before inserting into HTML attribute/text contexts. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
