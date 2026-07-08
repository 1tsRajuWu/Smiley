import type { Config, Snapshot } from "./types";
import { SKINS } from "./types";

function isHhMm(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s.trim());
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function settingsMarkup(): string {
  const skinCards = SKINS.map(
    (s) => `
    <button type="button" class="cfg-card" data-act="pick-skin" data-skin="${s.id}">
      <b>${s.title}</b>
      <i>${s.forWho}</i>
    </button>`,
  ).join("");

  return `
  <div class="cfg" id="cfgRoot">
    <nav class="cfg-tabs" role="tablist">
      <button type="button" class="on" data-act="cfg-tab" data-tab="look">Look</button>
      <button type="button" data-act="cfg-tab" data-tab="discord">Discord</button>
      <button type="button" data-act="cfg-tab" data-tab="auto">Auto</button>
      <button type="button" data-act="cfg-tab" data-tab="privacy">Privacy</button>
      <button type="button" data-act="cfg-tab" data-tab="app">App</button>
    </nav>
    <div class="cfg-panels">
      <section class="cfg-panel on" data-panel="look">
        <p class="cfg-lede">Four UIs for four kinds of people. Save to switch.</p>
        <div class="cfg-cards">${skinCards}</div>
        <select id="cfgSkin" class="sr-only" tabindex="-1" aria-hidden="true">
          ${SKINS.map((s) => `<option value="${s.id}">${s.title}</option>`).join("")}
        </select>

        <p class="cfg-label">Accent</p>
        <div class="cfg-swatches">
          ${["ember", "ink", "moss", "violet", "gold"]
            .map(
              (a) =>
                `<button type="button" class="cfg-swatch" data-act="pick-accent" data-accent="${a}" data-sw="${a}" title="${a}"></button>`,
            )
            .join("")}
        </div>
        <select id="cfgAccent" class="sr-only" tabindex="-1" aria-hidden="true">
          <option value="ember">ember</option>
          <option value="ink">ink</option>
          <option value="moss">moss</option>
          <option value="violet">violet</option>
          <option value="gold">gold</option>
        </select>

        <p class="cfg-label">Density</p>
        <div class="cfg-chips">
          ${["cozy", "comfy", "compact"]
            .map(
              (d) =>
                `<button type="button" data-act="pick-density" data-density="${d}">${d[0].toUpperCase()}${d.slice(1)}</button>`,
            )
            .join("")}
        </div>
        <select id="cfgDensity" class="sr-only" tabindex="-1" aria-hidden="true">
          <option value="cozy">cozy</option>
          <option value="comfy">comfy</option>
          <option value="compact">compact</option>
        </select>

        <div class="cfg-toggles">
          <label class="cfg-tog"><input type="checkbox" id="cfgReduceMotion" /><span>Reduce motion</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgToast" /><span>Show toasts</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgWallpaper" /><span>Animated wallpaper (pauses in tray)</span></label>
        </div>
      </section>

      <section class="cfg-panel" data-panel="discord">
        <p class="cfg-lede">How presence looks on Discord.</p>
        <div class="cfg-toggles">
          <label class="cfg-tog"><input type="checkbox" id="cfgElapsed" /><span>Show elapsed timer</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgShowBtn" /><span>Show Download button on Discord</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgRemember" /><span>Restore last activity on connect</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgGaming" /><span>Process gaming probe (optional)</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgLiveGaming" /><span>Live Valorant match board (local Riot — Valshy-style, no Tracker)</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgMusic" /><span>Live music (Spotify / Apple Music)</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgStaticTiles" /><span>Static tiles (GIFs on hover — saves CPU)</span></label>
        </div>
      </section>

      <section class="cfg-panel" data-panel="auto">
        <p class="cfg-lede">Background automation.</p>
        <div class="cfg-toggles">
          <label class="cfg-tog"><input type="checkbox" id="cfgRotate" /><span>Auto-rotate</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgRotateFav" /><span>Rotate favorites only</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgQuiet" /><span>Quiet hours</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgIdle" /><span>Idle during quiet hours</span></label>
        </div>
        <div class="cfg-fields">
          <label><span>Rotate every (sec)</span><input id="cfgRotateSecs" type="number" min="30" max="3600" step="10" /></label>
          <label><span>Quiet start</span><input id="cfgQuietStart" placeholder="23:00" /></label>
          <label><span>Quiet end</span><input id="cfgQuietEnd" placeholder="08:00" /></label>
          <label><span>Idle details</span><input id="cfgIdleDetails" maxlength="128" /></label>
          <label><span>Idle state</span><input id="cfgIdleState" maxlength="128" /></label>
          <label><span>Idle GIF</span><input id="cfgIdleGif" /></label>
        </div>
      </section>

      <section class="cfg-panel" data-panel="privacy">
        <p class="cfg-lede">Your data stays on your machine. Smiley v8 never uses Tracker.gg or game injectors.</p>
        <div class="cfg-toggles">
          <label class="cfg-tog"><input type="checkbox" id="cfgMatchBoard" /><span>Show live Valorant match board in-app</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgOtherNames" /><span>Show other players' Riot IDs (opt-in)</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgOtherStats" /><span>Show other players' KDA on the board</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgShareDiscord" /><span>Share score &amp; KDA on Discord</span></label>
        </div>
        <p class="cfg-hint">Off by default: other players' names and stats. Lockfile passwords and PUUIDs never leave Rust. Match board hides in tray.</p>
      </section>

      <section class="cfg-panel" data-panel="app">
        <p class="cfg-lede">Startup & library.</p>
        <div class="cfg-toggles">
          <label class="cfg-tog"><input type="checkbox" id="cfgAuto" /><span>Auto-connect</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgTray" /><span>Minimize to tray</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgLaunchMin" /><span>Launch minimized</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgConfirmClear" /><span>Confirm clear</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgFocusSearch" /><span>Focus search on open</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgFavFirst" /><span>Favorites first</span></label>
          <label class="cfg-tog"><input type="checkbox" id="cfgDonate" /><span>Show Donate in UI / tray</span></label>
        </div>
        <div class="cfg-fields">
          <label><span>Default category</span><select id="cfgDefaultCat"></select></label>
          <label><span>Max recents</span><input id="cfgMaxRecents" type="number" min="3" max="20" /></label>
        </div>
      </section>
    </div>
  </div>`;
}

export function fillSettings(root: HTMLElement, cfg: Config, snap: Snapshot) {
  const set = (id: string, value: string | number | boolean) => {
    const el = root.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) return;
    if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = Boolean(value);
    else el.value = String(value);
  };

  const cat = root.querySelector("#cfgDefaultCat") as HTMLSelectElement | null;
  if (cat) {
    cat.innerHTML = snap.categories
      .map((c) => `<option value="${c.id}">${c.emoji} ${c.label}</option>`)
      .join("");
    cat.value = cfg.defaultCategory;
    if (!cat.value && snap.categories[0]) cat.value = snap.categories[0].id;
  }

  set("cfgSkin", cfg.skin);
  set("cfgAccent", cfg.themeAccent || cfg.theme || "ember");
  set("cfgDensity", cfg.gridDensity || "cozy");
  set("cfgReduceMotion", cfg.reduceMotion);
  set("cfgToast", cfg.toastEnabled);
  set("cfgElapsed", cfg.showElapsed);
  set("cfgShowBtn", cfg.showButton);
  set("cfgRemember", cfg.rememberLast);
  set("cfgGaming", cfg.gamingProbe);
  set("cfgLiveGaming", cfg.liveGaming !== false);
  set("cfgMusic", cfg.musicNowPlaying !== false);
  set("cfgStaticTiles", cfg.staticTiles);
  set("cfgMatchBoard", cfg.showMatchBoard !== false);
  set("cfgOtherNames", cfg.showOtherRiotIds);
  set("cfgOtherStats", cfg.showOtherPlayerStats);
  set("cfgShareDiscord", cfg.shareValorantStatsDiscord !== false);
  set("cfgWallpaper", cfg.wallpaperEnabled);
  set("cfgDonate", cfg.showDonate);
  set("cfgRotate", cfg.rotateEnabled);
  set("cfgRotateFav", cfg.rotateFavoritesOnly);
  set("cfgQuiet", cfg.quietHoursEnabled);
  set("cfgIdle", cfg.idleEnabled);
  set("cfgRotateSecs", cfg.rotateSeconds);
  set("cfgQuietStart", cfg.quietStart);
  set("cfgQuietEnd", cfg.quietEnd);
  set("cfgIdleDetails", cfg.idleDetails);
  set("cfgIdleState", cfg.idleState);
  set("cfgIdleGif", cfg.idleGif);
  set("cfgAuto", cfg.autoConnect);
  set("cfgTray", cfg.minimizeToTray);
  set("cfgLaunchMin", cfg.launchMinimized);
  set("cfgConfirmClear", cfg.confirmClear);
  set("cfgFocusSearch", cfg.focusSearchOnOpen);
  set("cfgFavFirst", cfg.favoritesFirst);
  set("cfgMaxRecents", cfg.maxRecents);

  syncPickers(root);
}

export function syncPickers(root: HTMLElement) {
  const skin = (root.querySelector("#cfgSkin") as HTMLSelectElement)?.value;
  const accent = (root.querySelector("#cfgAccent") as HTMLSelectElement)?.value;
  const density = (root.querySelector("#cfgDensity") as HTMLSelectElement)?.value;
  root.querySelectorAll<HTMLElement>("[data-skin]").forEach((b) => {
    b.classList.toggle("on", b.dataset.skin === skin);
  });
  root.querySelectorAll<HTMLElement>("[data-accent]").forEach((b) => {
    b.classList.toggle("on", b.dataset.accent === accent);
  });
  root.querySelectorAll<HTMLElement>("[data-density]").forEach((b) => {
    b.classList.toggle("on", b.dataset.density === density);
  });
}

export function readSettings(root: HTMLElement, base: Config): Config {
  const v = (id: string) =>
    ((root.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "").trim();
  const c = (id: string) =>
    !!(root.querySelector(`#${id}`) as HTMLInputElement | null)?.checked;
  const n = (id: string, fallback: number, min: number, max: number) => {
    const raw = Number(v(id));
    if (!Number.isFinite(raw)) return fallback;
    return clamp(raw, min, max);
  };

  const quietStart = v("cfgQuietStart") || base.quietStart;
  const quietEnd = v("cfgQuietEnd") || base.quietEnd;
  if (!isHhMm(quietStart) || !isHhMm(quietEnd)) {
    throw new Error("Quiet hours must be HH:MM");
  }
  const skin = v("cfgSkin") || base.skin;
  if (!SKINS.some((s) => s.id === skin)) throw new Error("Invalid skin");
  const accent = v("cfgAccent") || base.themeAccent || "ember";

  return {
    ...base,
    skin,
    themeAccent: accent,
    theme: accent,
    autoConnect: c("cfgAuto"),
    minimizeToTray: c("cfgTray"),
    launchMinimized: c("cfgLaunchMin"),
    confirmClear: c("cfgConfirmClear"),
    favoritesFirst: c("cfgFavFirst"),
    reduceMotion: c("cfgReduceMotion"),
    showElapsed: c("cfgElapsed"),
    showButton: c("cfgShowBtn"),
    buttonLabel: base.buttonLabel || "Download Smiley",
    buttonUrl: base.buttonUrl || "https://1tsrajuwu.github.io/Smiley/#download",
    largeText: "",
    donationUrl: "https://paypal.me/1tsRaj",
    showDonate: c("cfgDonate"),
    wallpaperEnabled: c("cfgWallpaper"),
    gamingProbe: c("cfgGaming"),
    liveGaming: c("cfgLiveGaming"),
    musicNowPlaying: c("cfgMusic"),
    staticTiles: c("cfgStaticTiles"),
    showMatchBoard: c("cfgMatchBoard"),
    showOtherRiotIds: c("cfgOtherNames"),
    showOtherPlayerStats: c("cfgOtherStats"),
    shareValorantStatsDiscord: c("cfgShareDiscord"),
    idleEnabled: c("cfgIdle"),
    idleDetails: v("cfgIdleDetails") || base.idleDetails,
    idleState: v("cfgIdleState") || base.idleState,
    idleGif: v("cfgIdleGif") || base.idleGif,
    rotateEnabled: c("cfgRotate"),
    rotateSeconds: n("cfgRotateSecs", base.rotateSeconds, 30, 3600),
    rotateFavoritesOnly: c("cfgRotateFav"),
    quietHoursEnabled: c("cfgQuiet"),
    quietStart,
    quietEnd,
    gridDensity: v("cfgDensity") || base.gridDensity,
    defaultCategory: v("cfgDefaultCat") || base.defaultCategory,
    maxRecents: n("cfgMaxRecents", base.maxRecents, 3, 20),
    toastEnabled: c("cfgToast"),
    focusSearchOnOpen: c("cfgFocusSearch"),
    rememberLast: c("cfgRemember"),
    presenceCooldownMs: 400,
    favorites: [...(base.favorites ?? [])],
    recents: [...(base.recents ?? [])],
    lastActivityId: base.lastActivityId ?? null,
    custom: [...(base.custom ?? [])],
  };
}

export function setCfgTab(root: HTMLElement, tab: string) {
  root.querySelectorAll("[data-act='cfg-tab']").forEach((b) => {
    b.classList.toggle("on", (b as HTMLElement).dataset.tab === tab);
  });
  root.querySelectorAll("[data-panel]").forEach((p) => {
    p.classList.toggle("on", (p as HTMLElement).dataset.panel === tab);
  });
}
