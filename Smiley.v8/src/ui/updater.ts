import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import type { UpdateCheck } from "./types";

export type UpdateUiState =
  | { status: "checking" }
  | { status: "up-to-date"; check: UpdateCheck }
  | { status: "available"; version: string; notes?: string }
  | { status: "downloading"; version: string; percent: number }
  | { status: "ready"; version: string }
  | { status: "fallback"; check: UpdateCheck }
  | { status: "error"; message: string; check?: UpdateCheck };

let busy = false;

async function githubFallback(): Promise<UpdateUiState> {
  const checkResult = await invoke<UpdateCheck>("check_for_updates");
  if (checkResult.upToDate) {
    return { status: "up-to-date", check: checkResult };
  }
  return { status: "fallback", check: checkResult };
}

async function downloadUpdate(
  update: Update,
  onProgress: (percent: number) => void,
): Promise<void> {
  let downloaded = 0;
  let contentLength = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength ?? 0;
        onProgress(0);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        if (contentLength > 0) {
          onProgress(Math.min(99, Math.round((downloaded / contentLength) * 100)));
        }
        break;
      case "Finished":
        onProgress(100);
        break;
    }
  });
}

export async function runUpdateFlow(opts: {
  silent?: boolean;
  autoDownload?: boolean;
  onState?: (state: UpdateUiState) => void;
}): Promise<UpdateUiState> {
  if (busy) {
    return { status: "error", message: "Update check already in progress" };
  }
  busy = true;
  const emit = (state: UpdateUiState) => opts.onState?.(state);

  try {
    emit({ status: "checking" });

    let update: Update | null = null;
    try {
      update = await check();
    } catch {
      const fallback = await githubFallback();
      emit(fallback);
      return fallback;
    }

    if (!update) {
      const upToDate = await githubFallback();
      emit(upToDate);
      return upToDate;
    }

    const version = update.version;
    const notes = update.body ?? undefined;
    emit({ status: "available", version, notes });

    const shouldDownload = opts.autoDownload !== false;
    if (!shouldDownload) {
      return { status: "available", version, notes };
    }

    emit({ status: "downloading", version, percent: 0 });
    try {
      await downloadUpdate(update, (percent) => {
        emit({ status: "downloading", version, percent });
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not download update. Try again or install from GitHub.";
      const fallback = await githubFallback();
      const state: UpdateUiState = {
        status: "error",
        message,
        check: fallback.status === "fallback" ? fallback.check : undefined,
      };
      emit(state);
      return state;
    }

    const ready: UpdateUiState = { status: "ready", version };
    emit(ready);
    return ready;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const fallback = await githubFallback();
      const state: UpdateUiState = {
        status: "error",
        message,
        check: fallback.status === "fallback" ? fallback.check : undefined,
      };
      emit(state);
      return state;
    } catch {
      const state: UpdateUiState = { status: "error", message };
      emit(state);
      return state;
    }
  } finally {
    busy = false;
  }
}

export async function restartToUpdate(): Promise<void> {
  await relaunch();
}
