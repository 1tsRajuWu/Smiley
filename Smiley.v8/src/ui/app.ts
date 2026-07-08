import { api, errMsg, esc } from "./api";
import {
  fillSettings,
  readSettings,
  setCfgTab,
  syncPickers,
} from "./settings";
import {
  findActivity,
  formatElapsed,
  listActivities,
  normalizeSkin,
  type Snapshot,
  type UpdateCheck,
} from "./types";
import { markupFor } from "../skins/markup";
import "../skins/all.css";

export class AppController {
  private root: HTMLElement;
  private snap: Snapshot | null = null;
  private cat = "food";
  private gen = 0;
  private busy = false;
  private log: string[] = [];
  private clockTimer = 0;
  private pollTimer = 0;
  private toastTimer = 0;
  private mounted = false;

  private lastGridKey = "";
  private lastBoardKey = "";
  private lastGameProbe = 0;
  private lastUpdateCheck: UpdateCheck | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start() {
    this.snap = await api.snapshot();
    this.cat = this.snap.config.defaultCategory || this.snap.categories[0]?.id || "food";
    this.mount();
    this.pollTimer = window.setInterval(() => void this.poll(), 12_000);
    void api.log("ui: ready");

    // Wallpaper pause/resume from Rust tray events
    try {
      const { listen } = await import("@tauri-apps/api/event");
      await listen("wallpaper-pause", () => this.setWallpaperPaused(true));
      await listen("wallpaper-resume", () => this.setWallpaperPaused(false));
      await listen<UpdateCheck>("update-check-result", (e) => {
        this.showUpdateResult(e.payload);
      });
    } catch {
      /* browser preview without Tauri events */
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.setWallpaperPaused(true);
      else if (this.snap?.config.wallpaperEnabled) this.setWallpaperPaused(false);
    });
  }

  destroy() {
    window.clearInterval(this.pollTimer);
    window.clearInterval(this.clockTimer);
    this.root.onclick = null;
    this.root.oninput = null;
    this.root.onsubmit = null;
    this.mounted = false;
  }

  private mount() {
    if (!this.snap) return;
    const skin = normalizeSkin(this.snap.config.skin);
    document.documentElement.dataset.skin = skin;
    document.documentElement.dataset.accent = this.snap.config.themeAccent || "ember";
    document.documentElement.classList.toggle("calm", this.snap.config.reduceMotion);

    window.clearInterval(this.clockTimer);
    this.root.innerHTML = markupFor(skin);
    this.bind();
    this.mounted = true;
    this.paint();

    if (skin === "terminal") {
      this.pushLog("ready — type help");
      this.clockTimer = window.setInterval(() => {
        const el = this.$<HTMLElement>("clock");
        if (el) el.textContent = new Date().toLocaleTimeString();
      }, 1000);
    }

    if (this.snap.config.focusSearchOnOpen) {
      this.$<HTMLInputElement>("search")?.focus();
    }
  }

  private remount() {
    this.mount();
  }

  /** Single delegated click handler — every button uses data-act. */
  private bind() {
    this.root.onclick = (e) => {
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
      if (!t || !this.root.contains(t)) return;
      const act = t.dataset.act;
      if (!act) return;
      e.preventDefault();
      void this.handle(act, t, e);
    };

    this.root.oninput = (e) => {
      const t = e.target as HTMLElement;
      if (t.id === "search") {
        this.lastGridKey = "";
        this.paintGridIfNeeded();
      }
    };

    this.root.onsubmit = (e) => {
      const form = e.target as HTMLFormElement;
      if (form.id === "settingsForm" || form.id === "createForm") {
        e.preventDefault();
        return;
      }
      if (form.dataset.act === "cmd-form" || form.classList.contains("tm-prompt")) {
        e.preventDefault();
        void this.runCmd();
      }
    };

    window.onkeydown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        this.openSettings();
      }
    };
  }

  private async handle(act: string, el: HTMLElement, ev: MouseEvent) {
    switch (act) {
      case "connect":
        return this.connect();
      case "pause":
        return this.togglePause();
      case "clear":
        return this.clear();
      case "idle":
        return this.idle();
      case "rotate":
        return this.rotate();
      case "donate":
        return this.donate();
      case "check-updates":
        return this.checkUpdates();
      case "open-release":
        return this.openRelease();
      case "settings":
        return this.openSettings();
      case "create":
        return this.openCreate();
      case "close-settings":
        return this.$<HTMLDialogElement>("settingsDlg")?.close();
      case "close-create":
        return this.$<HTMLDialogElement>("createDlg")?.close();
      case "save-settings":
        return this.saveSettings();
      case "reset-settings":
        return this.resetSettings();
      case "save-custom":
        return this.saveCustom();
      case "cfg-tab":
        return setCfgTab(this.$("settingsBody")!, el.dataset.tab || "look");
      case "pick-skin": {
        const sel = this.$<HTMLSelectElement>("cfgSkin");
        if (sel && el.dataset.skin) sel.value = el.dataset.skin;
        syncPickers(this.$("settingsBody")!);
        return;
      }
      case "pick-accent": {
        const sel = this.$<HTMLSelectElement>("cfgAccent");
        if (sel && el.dataset.accent) sel.value = el.dataset.accent;
        syncPickers(this.$("settingsBody")!);
        return;
      }
      case "pick-density": {
        const sel = this.$<HTMLSelectElement>("cfgDensity");
        if (sel && el.dataset.density) sel.value = el.dataset.density;
        syncPickers(this.$("settingsBody")!);
        return;
      }
      case "cat":
        this.cat = el.dataset.cat || this.cat;
        this.lastGridKey = "";
        this.paint();
        return;
      case "pick":
        return this.pick(el.dataset.id || "");
      case "fav": {
        ev.stopPropagation();
        return this.toggleFav(el.dataset.id || "");
      }
      case "del-custom": {
        ev.stopPropagation();
        return this.deleteCustom(el.dataset.id || "");
      }
      case "search":
        return;
      default:
        return;
    }
  }

  private $<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return this.root.querySelector(`#${id}`);
  }

  private toast(msg: string) {
    if (this.snap && !this.snap.config.toastEnabled) return;
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      document.body.appendChild(el);
    }
    el.hidden = false;
    el.textContent = msg;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      el!.hidden = true;
    }, 2200);
  }

  private pushLog(line: string) {
    const ts = new Date().toLocaleTimeString();
    this.log.push(`[${ts}] ${line}`);
    if (this.log.length > 60) this.log.shift();
    const box = this.$<HTMLElement>("log");
    if (box) {
      box.textContent = this.log.join("\n");
      box.scrollTop = box.scrollHeight;
    }
  }

  private async poll() {
    if (document.hidden || !this.snap || this.busy || !this.mounted) return;
    try {
      this.snap.status = await api.status();
      this.paintStatusOnly();
      this.paintLiveBoard();
    } catch {
      /* ignore */
    }
  }

  private paintStatusOnly() {
    if (!this.snap) return;
    const s = this.snap.status;
    const pill = this.$<HTMLElement>("statusPill");
    if (pill) {
      pill.dataset.state = s.paused ? "paused" : s.connected ? "ok" : "off";
    }
    const label = this.$("statusLabel");
    if (label) {
      label.textContent = s.paused ? "Paused" : s.connected ? "Live" : "Offline";
    }
    const msg = this.$("statusMsg");
    if (msg) msg.textContent = s.message;
    const elapsed = this.$("elapsed");
    if (elapsed && this.snap.config.showElapsed) {
      elapsed.textContent = formatElapsed(s.elapsedSecs);
    }
  }

  private paint() {
    if (!this.snap || !this.mounted) return;
    const s = this.snap.status;
    const cfg = this.snap.config;
    const skin = normalizeSkin(cfg.skin);
    document.documentElement.dataset.accent = cfg.themeAccent || "ember";
    this.root.querySelector("#skin")?.setAttribute("data-density", cfg.gridDensity || "cozy");
    this.syncWallpaper();

    this.paintStatusOnly();
    this.paintLiveBoard();

    // Optional light gaming probe — throttled, never blocks clicks
    if ((cfg.gamingProbe || cfg.liveGaming) && s.connected && !s.paused) {
      const now = Date.now();
      if (now - this.lastGameProbe > 20_000) {
        this.lastGameProbe = now;
        void api.probeGame().then((hit) => {
          if (!hit || !this.snap) return;
          if (normalizeSkin(this.snap.config.skin) !== "terminal") return;
          const meta = this.$("meta");
          if (meta) meta.textContent = `game-hint: ${hit.title}\n${hit.state}`;
        }).catch(() => { /* ignore */ });
      }
    }

    const pause = this.$<HTMLButtonElement>("btnPause");
    const clear = this.$<HTMLButtonElement>("btnClear");
    const connect = this.$<HTMLButtonElement>("btnConnect");
    if (pause) {
      pause.hidden = !s.connected && skin !== "arcade" && skin !== "terminal";
      pause.textContent =
        skin === "arcade"
          ? s.paused
            ? "RESUME"
            : "PAUSE"
          : skin === "terminal"
            ? s.paused
              ? "./resume"
              : "./pause"
            : s.paused
              ? "Resume"
              : "Pause";
    }
    if (clear) {
      clear.hidden = !s.activityId && skin !== "arcade" && skin !== "terminal";
    }
    if (connect) {
      connect.textContent =
        skin === "arcade"
          ? s.connected
            ? "RELINK"
            : "CONNECT"
          : skin === "terminal"
            ? s.connected
              ? "./reconnect"
              : "./connect"
            : skin === "zen"
              ? s.connected
                ? "reconnect"
                : "connect"
              : s.connected
                ? "Reconnect"
                : "Connect";
    }

    const act = findActivity(this.snap, s.activityId);
    const gifUrl = s.gif || act?.gif || "";
    const hero = this.$<HTMLImageElement>("heroGif");
    const card = this.$<HTMLElement>("discordCard");
    const empty = this.$<HTMLElement>("emptyHero");

    if (gifUrl) {
      if (hero && hero.src !== gifUrl) hero.src = gifUrl;
      if (card) card.hidden = false;
      if (empty) empty.hidden = true;
      const art = this.$<HTMLElement>("art");
      if (art) {
        const safe = gifUrl.replace(/["'()\\\s]/g, "");
        art.style.backgroundImage = safe ? `url("${safe}")` : "";
      }
    } else {
      if (hero) hero.removeAttribute("src");
      if (card) card.hidden = true;
      if (empty) empty.hidden = false;
    }

    const title = this.$("title");
    const subtitle = this.$("subtitle");
    const details = this.$("details");
    const stateLine = this.$("stateLine");
    const kicker = this.$("kicker");
    const meta = this.$("meta");

    if (s.activityId && (s.details || act)) {
      if (title) title.textContent = `${act?.emoji ?? ""} ${s.details || act?.details || ""}`.trim();
      if (subtitle) subtitle.textContent = s.state || act?.state || s.message;
      if (details) details.textContent = s.details || act?.details || "—";
      if (stateLine) stateLine.textContent = s.state || act?.state || "—";
      if (kicker) kicker.textContent = s.rotateActive ? "Auto-rotating" : "Now playing";
      if (meta) {
        meta.textContent = [
          `details: ${s.details || act?.details}`,
          `state: ${s.state || act?.state}`,
          `id: ${s.activityId}`,
        ].join("\n");
      }
    } else {
      if (title) {
        title.textContent =
          skin === "arcade"
            ? s.connected
              ? "SELECT STAGE"
              : "INSERT COIN"
            : skin === "zen"
              ? "what are you doing?"
              : "Pick a vibe";
      }
      if (subtitle) {
        subtitle.textContent = s.connected
          ? "Tap any activity below"
          : "Connect Discord, then pick an activity";
      }
      if (kicker) kicker.textContent = s.connected ? "Ready" : "No presence";
      if (meta) meta.textContent = "no presence.bin";
    }

    if (skin === "terminal") {
      const block = this.$("statusBlock");
      if (block) {
        block.textContent = [
          `link: ${s.connected ? "hot" : "cold"}`,
          `job: ${s.activityId ?? "none"}`,
          `msg: ${s.message}`,
          `elapsed: ${formatElapsed(s.elapsedSecs)}`,
          `rotate: ${s.rotateActive ? "on" : "off"}`,
        ].join("\n");
      }
    }

    this.paintCats();
    this.paintGridIfNeeded();
  }

  private gridCacheKey(): string {
    if (!this.snap) return "";
    const q = this.$<HTMLInputElement>("search")?.value ?? "";
    return [
      this.cat,
      q,
      this.snap.status.activityId ?? "",
      this.snap.config.favorites.join(","),
      this.snap.config.staticTiles ? "1" : "0",
      normalizeSkin(this.snap.config.skin),
    ].join("|");
  }

  private paintGridIfNeeded() {
    const key = this.gridCacheKey();
    if (key === this.lastGridKey) return;
    this.lastGridKey = key;
    this.paintGrid();
  }

  private paintLiveBoard() {
    if (!this.snap) return;
    let board = this.$<HTMLElement>("liveBoard");
    if (!board) {
      board = document.createElement("div");
      board.id = "liveBoard";
      board.className = "live-board";
      board.hidden = true;
      board.innerHTML = `
        <header class="live-head">
          <div>
            <p class="live-kicker" id="livePhase">Match</p>
            <h2 id="liveTitle">VALORANT</h2>
            <p id="liveMeta">—</p>
          </div>
          <div class="live-score" id="liveScore" hidden>—</div>
        </header>
        <div class="live-cols">
          <section><h3>Ally</h3><div id="liveAlly" class="live-list"></div></section>
          <section><h3>Enemy</h3><div id="liveEnemy" class="live-list"></div></section>
        </div>`;
      (this.root.querySelector(".skin") || this.root).appendChild(board);
    }

    const mb = this.snap.status.matchBoard;
    const show =
      !!mb?.active &&
      mb.product === "valorant" &&
      (mb.phase === "match" || mb.phase === "pregame" || (mb.players?.length ?? 0) > 0) &&
      !document.hidden &&
      this.snap.config.showMatchBoard !== false;

    board.hidden = !show;
    if (!show || !mb) return;

    const boardKey = JSON.stringify({
      phase: mb.phase,
      title: mb.title,
      map: mb.map,
      score: mb.score,
      players: mb.players?.map((p) => [p.seat, p.name, p.agent, p.kda]),
    });
    if (boardKey === this.lastBoardKey) return;
    this.lastBoardKey = boardKey;

    const phase = this.$("livePhase");
    const title = this.$("liveTitle");
    const meta = this.$("liveMeta");
    const score = this.$<HTMLElement>("liveScore");
    const ally = this.$("liveAlly");
    const enemy = this.$("liveEnemy");

    const phaseLabel =
      mb.phase === "match"
        ? "LIVE MATCH"
        : mb.phase === "pregame"
          ? "AGENT SELECT"
          : mb.phase === "queue"
            ? "IN QUEUE"
            : "LOBBY";

    if (phase) phase.textContent = phaseLabel;
    if (title) title.textContent = mb.map ? `${mb.title} · ${mb.map}` : mb.title;
    if (meta) {
      meta.textContent = [mb.mode, mb.party, mb.selfAgent && `You: ${mb.selfAgent}`, mb.selfKda]
        .filter(Boolean)
        .join(" · ") || mb.state || "—";
    }
    if (score) {
      if (mb.score) {
        score.hidden = false;
        score.textContent = mb.score;
      } else {
        score.hidden = true;
      }
    }

    const row = (p: import("./types").MatchPlayer) => {
      const icon = p.agentIcon
        ? `<img src="${esc(p.agentIcon)}" alt="" width="36" height="36" loading="lazy" />`
        : `<span class="live-fallback">?</span>`;
      return `<div class="live-row${p.isSelf ? " self" : ""}">
        ${icon}
        <div>
          <b>${esc(p.name)}${p.isSelf ? " · you" : ""}</b>
          <i>${esc(p.agent || "Selecting…")}${p.kda ? ` · ${esc(p.kda)}` : ""}</i>
        </div>
      </div>`;
    };

    const players = mb.players || [];
    if (ally) {
      const list = players.filter((p) => p.seat !== "Enemy");
      ally.innerHTML = list.length ? list.map(row).join("") : `<p class="live-empty">Waiting for parties…</p>`;
    }
    if (enemy) {
      const list = players.filter((p) => p.seat === "Enemy");
      enemy.innerHTML = list.length
        ? list.map(row).join("")
        : mb.phase === "pregame"
          ? `<p class="live-empty">Enemy team after lock-in</p>`
          : `<p class="live-empty">—</p>`;
    }
  }

  private paintCats() {
    if (!this.snap) return;
    const el = this.$("cats");
    if (!el) return;
    const skin = normalizeSkin(this.snap.config.skin);
    const items = [{ id: "favorites", emoji: "★", label: "Favorites" }, ...this.snap.categories];
    el.innerHTML = items
      .map((c) => {
        const on = c.id === this.cat ? " on" : "";
        const id = esc(c.id);
        if (skin === "terminal") {
          return `<button type="button" class="${on.trim()}" data-act="cat" data-cat="${id}">${this.cat === c.id ? ">" : " "} ${id}/</button>`;
        }
        return `<button type="button" class="${on.trim()}" data-act="cat" data-cat="${id}">${esc(c.emoji)} ${esc(c.label)}</button>`;
      })
      .join("");
  }

  private paintGrid() {
    if (!this.snap) return;
    const grid = this.$("grid");
    if (!grid) return;
    const q = this.$<HTMLInputElement>("search")?.value ?? "";
    const list = listActivities(this.snap, this.cat, q);
    const favs = new Set(this.snap.config.favorites);
    const active = this.snap.status.activityId;
    const skin = normalizeSkin(this.snap.config.skin);
    const staticTiles = this.snap.config.staticTiles || this.snap.config.reduceMotion;

    if (skin === "terminal") {
      grid.innerHTML = list
        .map((a) => {
          const on = a.id === active ? " on" : "";
          const star = favs.has(a.id) ? "*" : " ";
          const custom = a.category === "custom";
          return `<button type="button" class="row${on}" data-act="pick" data-id="${esc(a.id)}">
            <code>${star}${esc(a.id)}</code><span>${esc(a.emoji)} ${esc(a.details)}</span><em>${esc(a.state)}</em>
            ${custom ? `<span class="tile-del" data-act="del-custom" data-id="${esc(a.id)}" role="button" title="Delete">×</span>` : ""}
          </button>`;
        })
        .join("");
      return;
    }

    grid.innerHTML = list
      .map((a) => {
        const on = a.id === active ? " on" : "";
        const favOn = favs.has(a.id) ? " on" : "";
        const color = /^#[0-9a-fA-F]{3,8}$/.test(a.color) ? a.color : "#888";
        const gif = esc(a.gif);
        const custom = a.category === "custom";
        const img = staticTiles
          ? `<img data-src="${gif}" alt="" loading="lazy" decoding="async" class="tile-still" />`
          : `<img src="${gif}" alt="" loading="lazy" decoding="async" />`;
        return `<button type="button" class="tile${on}" data-act="pick" data-id="${esc(a.id)}" style="--c:${color}">
          ${img}
          <div class="tile-fade">
            <b>${esc(a.emoji)} ${esc(a.details)}</b>
            <i>${esc(a.state)}</i>
          </div>
          <span class="tile-fav${favOn}" data-act="fav" data-id="${esc(a.id)}" role="button">${favs.has(a.id) ? "★" : "☆"}</span>
          ${custom ? `<span class="tile-del" data-act="del-custom" data-id="${esc(a.id)}" role="button" title="Delete">×</span>` : ""}
        </button>`;
      })
      .join("");

    // Lazy-load GIFs on hover when static tiles mode is on
    if (staticTiles) {
      grid.querySelectorAll<HTMLImageElement>("img.tile-still").forEach((img) => {
        const tile = img.closest(".tile");
        if (!tile) return;
        tile.addEventListener(
          "mouseenter",
          () => {
            const src = img.dataset.src;
            if (src && img.src !== src) img.src = src;
          },
          { once: true },
        );
      });
    }
  }

  private async connect() {
    if (this.busy) return;
    this.busy = true;
    try {
      const status = await api.connect();
      if (this.snap) this.snap.status = status;
      this.paint();
      this.toast(status.connected ? "Connected" : status.message);
      this.pushLog("link hot");
    } catch (e) {
      this.toast(errMsg(e));
      this.pushLog(`error ${errMsg(e)}`);
    } finally {
      this.busy = false;
    }
  }

  private async togglePause() {
    if (!this.snap) return;
    try {
      const status = await api.pause(!this.snap.status.paused);
      this.snap.status = status;
      this.paint();
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async clear() {
    if (!this.snap) return;
    if (this.snap.config.confirmClear && !confirm("Clear presence?")) return;
    try {
      this.snap.status = await api.clear();
      this.paint();
      this.toast("Cleared");
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async idle() {
    try {
      const status = await api.idle();
      if (this.snap) this.snap.status = status;
      this.paint();
      this.toast("Idle set");
      this.pushLog("idle");
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async rotate() {
    try {
      const status = await api.rotateOnce();
      if (status && this.snap) {
        this.snap.status = status;
        this.paint();
        this.toast("Rotated");
        this.pushLog(`rotate -> ${status.activityId}`);
      } else this.toast("Rotate off or empty");
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async donate() {
    try {
      await api.openDonate();
      void api.log("ui: opened donation link");
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async checkUpdates() {
    try {
      const result = await api.checkUpdates();
      this.showUpdateResult(result);
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async openRelease() {
    try {
      const url =
        this.lastUpdateCheck?.downloadUrl ||
        this.lastUpdateCheck?.releasesUrl ||
        null;
      await api.openRelease(url);
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private showUpdateResult(result: UpdateCheck) {
    this.lastUpdateCheck = result;
    const el = this.$("cfgUpdateStatus");
    if (el) {
      el.hidden = false;
      if (result.upToDate) {
        el.textContent = result.message;
      } else {
        el.innerHTML = `${esc(result.message)} <button type="button" data-act="open-release">Download</button>`;
      }
    }
    this.toast(result.message);
    void api.log(`update: ${result.message}`);
  }

  private setWallpaperPaused(paused: boolean) {
    const wall = this.$<HTMLElement>("wallpaper");
    if (!wall) return;
    wall.classList.toggle("paused", paused);
    document.documentElement.classList.toggle("wallpaper-paused", paused);
  }

  private syncWallpaper() {
    if (!this.snap) return;
    const wall = this.$<HTMLElement>("wallpaper");
    const on = this.snap.config.wallpaperEnabled && !this.snap.config.reduceMotion;
    if (wall) {
      wall.hidden = !on;
      wall.classList.toggle("on", on);
    }
    document.documentElement.classList.toggle("has-wallpaper", on);
    const donate = this.$<HTMLElement>("btnDonate");
    if (donate) donate.hidden = !this.snap.config.showDonate;
  }

  private async pick(id: string) {
    if (!id || !this.snap) return;
    if (!this.snap.status.connected) {
      this.toast("Connect Discord first");
      return;
    }
    const g = ++this.gen;
    this.busy = true;
    try {
      const status = await api.setActivity(id);
      if (g !== this.gen) return;
      this.snap.status = status;
      this.snap.config.recents = [
        id,
        ...this.snap.config.recents.filter((x) => x !== id),
      ].slice(0, this.snap.config.maxRecents);
      this.paint();
      this.toast("Presence updated");
      this.pushLog(`set ${id}`);
    } catch (e) {
      this.toast(errMsg(e));
      this.pushLog(`error ${errMsg(e)}`);
    } finally {
      this.busy = false;
    }
  }

  private async toggleFav(id: string) {
    if (!id || !this.snap) return;
    try {
      this.snap.config = await api.toggleFavorite(id);
      this.lastGridKey = "";
      this.paintGridIfNeeded();
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async deleteCustom(id: string) {
    if (!id || !this.snap) return;
    if (!confirm("Delete this custom activity?")) return;
    try {
      this.snap.config = await api.removeCustom(id);
      if (this.snap.status.activityId === id) {
        this.snap.status = await api.clear();
      }
      this.paint();
      this.toast("Deleted");
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private openSettings() {
    if (!this.snap) return;
    const body = this.$("settingsBody");
    const dlg = this.$<HTMLDialogElement>("settingsDlg");
    if (!body || !dlg) return;
    fillSettings(body, this.snap.config, this.snap);
    setCfgTab(body, "look");
    dlg.showModal();
  }

  private openCreate() {
    this.$<HTMLDialogElement>("createDlg")?.showModal();
  }

  private async saveSettings() {
    if (!this.snap) return;
    const body = this.$("settingsBody");
    if (!body) return;
    try {
      const prevSkin = normalizeSkin(this.snap.config.skin);
      const draft = readSettings(body, this.snap.config);
      const saved = await api.saveConfig(draft);
      this.snap.config = saved;
      this.$<HTMLDialogElement>("settingsDlg")?.close();
      const nextSkin = normalizeSkin(saved.skin);
      if (nextSkin !== prevSkin) {
        this.remount();
        this.toast(`Switched to ${nextSkin}`);
      } else {
        this.paint();
        this.toast("Settings saved");
      }
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async resetSettings() {
    if (!confirm("Reset ALL settings (including favorites & customs)?")) return;
    try {
      const saved = await api.resetConfig();
      if (this.snap) this.snap.config = saved;
      this.$<HTMLDialogElement>("settingsDlg")?.close();
      this.remount();
      this.toast("Factory reset");
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async saveCustom() {
    const details = this.$<HTMLInputElement>("caDetails")?.value.trim() ?? "";
    if (!details) {
      this.toast("Details required");
      return;
    }
    try {
      await api.addCustom({
        id: "",
        details,
        state: this.$<HTMLInputElement>("caState")?.value.trim() || "Custom",
        emoji: this.$<HTMLInputElement>("caEmoji")?.value.trim() || "✨",
        gif: this.$<HTMLInputElement>("caGif")?.value.trim() || null,
      });
      this.snap = await api.snapshot();
      this.cat = "custom";
      this.$<HTMLDialogElement>("createDlg")?.close();
      this.paint();
      this.toast("Activity added");
    } catch (e) {
      this.toast(errMsg(e));
    }
  }

  private async runCmd() {
    const input = this.$<HTMLInputElement>("search");
    if (!input) return;
    const raw = input.value.trim();
    input.value = "";
    if (!raw) return;
    const [cmd, ...rest] = raw.split(/\s+/);
    const arg = rest.join(" ");
    if (cmd === "help") {
      this.pushLog("help | search <q> | set <id> | cd <dir> | connect | clear | config");
    } else if (cmd === "search" || cmd === "ls") {
      input.value = arg;
      this.paintGrid();
      this.pushLog(`search ${arg}`);
    } else if (cmd === "set" && arg) {
      await this.pick(arg);
    } else if (cmd === "cd" && arg) {
      this.cat = arg.replace(/\/$/, "");
      this.paint();
    } else if (cmd === "connect") {
      await this.connect();
    } else if (cmd === "clear") {
      await this.clear();
    } else if (cmd === "config") {
      this.openSettings();
    } else {
      input.value = raw;
      this.paintGrid();
    }
  }
}
