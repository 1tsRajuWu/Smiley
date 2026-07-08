import iconLight from "../assets/icon-light.png";
import icon from "../assets/icon.png";
import { settingsMarkup } from "../ui/settings";

const cfg = settingsMarkup();

/** Studio — visual creatives. Full-bleed media + floating actions. */
export function studioMarkup(): string {
  return `
  <div class="skin studio" id="skin">
    <div class="wallpaper" id="wallpaper" aria-hidden="true"></div>
    <div class="st-hero">
      <img id="heroGif" class="st-bg" alt="" />
      <div class="st-veil"></div>
      <header class="st-bar">
        <div class="st-brand"><img src="${iconLight}" width="40" height="40" alt="" /><div><b>Smiley</b><i>Studio</i></div></div>
        <div class="st-status" id="statusPill" data-state="off"><i></i><div><strong id="statusLabel">Offline</strong><em id="statusMsg">—</em></div></div>
        <div class="st-actions">
          <button type="button" data-act="idle">Idle</button>
          <button type="button" data-act="rotate">Rotate</button>
          <button type="button" data-act="pause" hidden id="btnPause">Pause</button>
          <button type="button" data-act="clear" hidden id="btnClear">Clear</button>
          <button type="button" class="primary" data-act="connect" id="btnConnect">Connect</button>
          <button type="button" data-act="donate" id="btnDonate">Donate</button>
          <button type="button" class="icon" data-act="create" title="Create">＋</button>
          <button type="button" class="icon" data-act="settings" title="Settings">⚙</button>
        </div>
      </header>
      <div class="st-copy">
        <p id="kicker">No presence</p>
        <h1 id="title">Pick a vibe</h1>
        <p id="subtitle">Connect Discord, then tap a card.</p>
        <div class="st-discord" id="discordCard" hidden>
          <div class="st-art" id="art"></div>
          <div>
            <small>PLAYING A GAME</small>
            <strong id="details">—</strong>
            <span id="stateLine">—</span>
            <em id="elapsed"></em>
          </div>
        </div>
        <div class="live-board" id="liveBoard" hidden>
          <header class="live-head">
            <div>
              <p class="live-kicker" id="livePhase">Match</p>
              <h2 id="liveTitle">VALORANT</h2>
              <p id="liveMeta">—</p>
            </div>
            <div class="live-score" id="liveScore" hidden>—</div>
          </header>
          <div class="live-cols">
            <section>
              <h3>Ally</h3>
              <div id="liveAlly" class="live-list"></div>
            </section>
            <section>
              <h3>Enemy</h3>
              <div id="liveEnemy" class="live-list"></div>
            </section>
          </div>
        </div>
      </div>
    </div>
    <div class="st-tool">
      <div class="st-cats" id="cats"></div>
      <input type="search" id="search" placeholder="Search" data-act="search" />
    </div>
    <div class="st-grid" id="grid"></div>
    ${dialogs("st")}
  </div>`;
}

/** Arcade — gamers. Side cabinet + neon board. */
export function arcadeMarkup(): string {
  return `
  <div class="skin arcade" id="skin">
    <div class="wallpaper" id="wallpaper" aria-hidden="true"></div>
    <aside class="ar-side">
      <div class="ar-logo"><img src="${icon}" width="48" height="48" alt="" /><span>SMILEY<br/>ARCADE</span></div>
      <div class="ar-screen">
        <img id="heroGif" alt="" />
        <div class="ar-cap"><b id="title">INSERT COIN</b><i id="subtitle">Connect Discord</i></div>
      </div>
      <div class="ar-leds" id="statusPill" data-state="off"><i></i><i></i><i></i></div>
      <p class="ar-msg" id="statusMsg">boot</p>
      <button type="button" class="ar-coin" data-act="connect" id="btnConnect">CONNECT</button>
      <div class="ar-keys">
        <button type="button" data-act="pause" id="btnPause">PAUSE</button>
        <button type="button" data-act="clear" id="btnClear">CLEAR</button>
        <button type="button" data-act="idle">IDLE</button>
        <button type="button" data-act="rotate">SPIN</button>
        <button type="button" data-act="settings">MENU</button>
        <button type="button" data-act="create">NEW</button>
        <button type="button" data-act="donate" id="btnDonate">TIP</button>
      </div>
      <div class="ar-timer"><label>TIMER</label><strong id="elapsed">0:00</strong></div>
    </aside>
    <main class="ar-main">
      <div class="ar-head">
        <h1>SELECT STAGE</h1>
        <input type="search" id="search" placeholder="SEARCH" data-act="search" />
      </div>
      <div class="ar-cats" id="cats"></div>
      <div class="ar-board" id="grid"></div>
      <span class="sr-only" id="statusLabel"></span>
      <span class="sr-only" id="details"></span>
      <span class="sr-only" id="stateLine"></span>
      <span class="sr-only" id="kicker"></span>
      <span class="sr-only" id="art"></span>
      <span class="sr-only" id="discordCard"></span>
    </main>
    ${dialogs("ar")}
  </div>`;
}

/** Terminal — power users. Log + command row. */
export function terminalMarkup(): string {
  return `
  <div class="skin terminal" id="skin">
    <div class="wallpaper" id="wallpaper" aria-hidden="true"></div>
    <div class="tm-bezel">
      <header class="tm-bar"><span>smiley@v8</span><span id="clock">--:--:--</span></header>
      <div class="tm-cols">
        <aside class="tm-side">
          <pre id="statusBlock">link: cold</pre>
          <div class="tm-btns">
            <button type="button" data-act="connect" id="btnConnect">./connect</button>
            <button type="button" data-act="pause" id="btnPause">./pause</button>
            <button type="button" data-act="clear" id="btnClear">./clear</button>
            <button type="button" data-act="idle">./idle</button>
            <button type="button" data-act="rotate">./rotate</button>
            <button type="button" data-act="settings">./config</button>
            <button type="button" data-act="create">./new</button>
            <button type="button" data-act="donate" id="btnDonate">./donate</button>
          </div>
          <nav id="cats" class="tm-dirs"></nav>
          <div class="tm-prev">
            <img id="heroGif" alt="" />
            <pre id="meta">no presence.bin</pre>
          </div>
        </aside>
        <section class="tm-main">
          <pre class="tm-log" id="log"></pre>
          <div id="grid" class="tm-list"></div>
          <form class="tm-prompt" data-act="cmd-form">
            <span>»</span>
            <input id="search" autocomplete="off" spellcheck="false" placeholder="search | set &lt;id&gt; | help" />
          </form>
        </section>
      </div>
    </div>
    <span class="sr-only" id="statusPill"></span>
    <span class="sr-only" id="statusLabel"></span>
    <span class="sr-only" id="statusMsg"></span>
    <span class="sr-only" id="title"></span>
    <span class="sr-only" id="subtitle"></span>
    <span class="sr-only" id="details"></span>
    <span class="sr-only" id="stateLine"></span>
    <span class="sr-only" id="elapsed"></span>
    <span class="sr-only" id="kicker"></span>
    <span class="sr-only" id="art"></span>
    <span class="sr-only" id="discordCard"></span>
    ${dialogs("tm")}
  </div>`;
}

/** Zen — calm minimal. One column, soft type, huge grid. */
export function zenMarkup(): string {
  return `
  <div class="skin zen" id="skin">
    <div class="wallpaper" id="wallpaper" aria-hidden="true"></div>
    <header class="zn-top">
      <div class="zn-brand"><img src="${iconLight}" width="36" height="36" alt="" /><b>smiley</b></div>
      <div class="zn-status" id="statusPill" data-state="off"><span id="statusLabel">offline</span></div>
      <div class="zn-acts">
        <button type="button" data-act="connect" id="btnConnect">connect</button>
        <button type="button" data-act="pause" id="btnPause" hidden>pause</button>
        <button type="button" data-act="clear" id="btnClear" hidden>clear</button>
        <button type="button" data-act="settings">settings</button>
        <button type="button" data-act="donate" id="btnDonate">donate</button>
      </div>
    </header>
    <section class="zn-now" id="discordCard" hidden>
      <img id="heroGif" alt="" />
      <div>
        <strong id="details">—</strong>
        <span id="stateLine">—</span>
        <em id="elapsed"></em>
      </div>
    </section>
    <div class="zn-empty" id="emptyHero">
      <h1 id="title">what are you doing?</h1>
      <p id="subtitle">one tap sets your discord vibe</p>
    </div>
    <div class="zn-tool">
      <div id="cats" class="zn-cats"></div>
      <input type="search" id="search" placeholder="find…" data-act="search" />
      <button type="button" data-act="create">＋</button>
      <button type="button" data-act="idle">idle</button>
      <button type="button" data-act="rotate">rotate</button>
    </div>
    <div id="grid" class="zn-grid"></div>
    <span class="sr-only" id="statusMsg"></span>
    <span class="sr-only" id="kicker"></span>
    <span class="sr-only" id="art"></span>
    ${dialogs("zn")}
  </div>`;
}

function dialogs(_prefix: string): string {
  return `
  <dialog class="dlg" id="settingsDlg">
    <form method="dialog" class="dlg-card" id="settingsForm">
      <header>
        <h2>Settings</h2>
        <button type="button" data-act="close-settings" aria-label="Close">✕</button>
      </header>
      <div class="dlg-body" id="settingsBody">${cfg}</div>
      <footer>
        <button type="button" data-act="reset-settings">Reset</button>
        <button type="button" class="primary" data-act="save-settings">Save</button>
      </footer>
    </form>
  </dialog>
  <dialog class="dlg" id="createDlg">
    <form method="dialog" class="dlg-card slim" id="createForm">
      <header>
        <h2>New activity</h2>
        <button type="button" data-act="close-create" aria-label="Close">✕</button>
      </header>
      <div class="dlg-body">
        <label><span>Details</span><input id="caDetails" maxlength="128" /></label>
        <label><span>State</span><input id="caState" maxlength="128" /></label>
        <label><span>Emoji</span><input id="caEmoji" maxlength="8" value="✨" /></label>
        <label><span>GIF URL</span><input id="caGif" placeholder="https://media.tenor.com/…" /></label>
      </div>
      <footer>
        <button type="button" class="primary" data-act="save-custom">Add</button>
      </footer>
    </form>
  </dialog>`;
}

export function markupFor(skin: string): string {
  if (skin === "arcade") return arcadeMarkup();
  if (skin === "terminal") return terminalMarkup();
  if (skin === "zen") return zenMarkup();
  return studioMarkup();
}
