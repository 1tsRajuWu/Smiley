// Foreground coding-app detection — editors, terminals, and AI dev tools
const { pollRawForeground } = require('./now-gaming');

const POLL_MS = process.platform === 'darwin' ? 3000 : 2500;
const BACKGROUND_POLL_MS = process.platform === 'darwin' ? 12000 : 8000;

const CODING_APPS = [
  { id: 'cursor', name: 'Cursor', processes: ['cursor'], bundles: ['com.todesktop.230313mzl4w4u92'] },
  {
    id: 'vscode',
    name: 'VS Code',
    processes: ['code', 'code - insiders', 'code - oss', 'visual studio code'],
    bundles: ['com.microsoft.vscode', 'com.microsoft.vscodeinsiders', 'com.microsoft.VSCode'],
  },
  { id: 'vscodium', name: 'VSCodium', processes: ['vscodium'], bundles: ['com.vscodium', 'com.visualstudio.code.oss'] },
  { id: 'windsurf', name: 'Windsurf', processes: ['windsurf'], bundles: ['com.exafunction.windsurf'] },
  { id: 'zed', name: 'Zed', processes: ['zed'], bundles: ['dev.zed.zed'] },
  { id: 'sublime', name: 'Sublime Text', processes: ['sublime text', 'sublime_text', 'subl'], bundles: ['com.sublimetext.4', 'com.sublimetext.3'] },
  { id: 'idea', name: 'IntelliJ IDEA', processes: ['idea', 'idea64', 'intellij idea'], bundles: ['com.jetbrains.intellij'] },
  { id: 'pycharm', name: 'PyCharm', processes: ['pycharm', 'pycharm64'], bundles: ['com.jetbrains.pycharm'] },
  { id: 'webstorm', name: 'WebStorm', processes: ['webstorm', 'webstorm64'], bundles: ['com.jetbrains.webstorm'] },
  { id: 'androidstudio', name: 'Android Studio', processes: ['studio', 'studio64', 'android studio'], bundles: ['com.google.android.studio'] },
  { id: 'xcode', name: 'Xcode', processes: ['xcode'], bundles: ['com.apple.dt.xcode'] },
  { id: 'nvim', name: 'Neovim', processes: ['nvim', 'neovide'], bundles: [] },
  { id: 'vim', name: 'Vim', processes: ['vim', 'gvim'], bundles: [] },
  { id: 'emacs', name: 'Emacs', processes: ['emacs'], bundles: [] },
  { id: 'opencode', name: 'OpenCode', processes: ['opencode'], bundles: [] },
  { id: 'openclaw', name: 'OpenClaw', processes: ['openclaw'], bundles: [] },
  { id: 'ollama', name: 'Ollama', processes: ['ollama'], bundles: ['com.electron.ollama', 'ai.ollama.ollama'] },
  { id: 'chatgpt', name: 'ChatGPT', processes: ['chatgpt'], bundles: ['com.openai.chat'] },
  { id: 'claude', name: 'Claude', processes: ['claude'], bundles: ['com.anthropic.claude', 'com.anthropic.claudefordesktop'] },
  { id: 'copilot', name: 'GitHub Copilot', processes: ['github copilot', 'copilot'], bundles: [] },
  { id: 'trae', name: 'Trae', processes: ['trae'], bundles: [] },
  { id: 'fleet', name: 'Fleet', processes: ['fleet'], bundles: ['com.jetbrains.fleet'] },
  {
    id: 'terminal',
    name: 'Terminal',
    processes: ['terminal', 'iterm2', 'warp', 'alacritty', 'kitty', 'wezterm'],
    bundles: ['com.apple.terminal', 'com.googlecode.iterm2', 'dev.warp.Warp-Stable'],
  },
];

const IDE_SUFFIX = /(?:visual studio code|cursor|windsurf|vscodium|vs code|intellij idea|pycharm|webstorm|android studio|xcode|zed|sublime text)$/i;
const IDLE_TITLES = /^(welcome|get started|settings|extensions?|keyboard shortcuts|release notes|walkthrough)/i;

function humanize(v) {
  return String(v || '').replace(/\.(exe|app)$/i, '').replace(/[_-]+/g, ' ').trim();
}

function matchCodingApp(raw) {
  if (!raw) return null;
  const processName = humanize(raw.processName);
  const bundleId = String(raw.bundleId || '').toLowerCase();
  const key = processName.toLowerCase();
  // Ignore helpers / crashpads / Smiley itself.
  if (!processName || /smiley/i.test(processName)) return null;
  if (/\bhelper\b|\bcrashpad\b|\bgpu\b|\brenderer\b/i.test(key) && !/^cursor$/i.test(key)) return null;

  for (const app of CODING_APPS) {
    const procMatch = app.processes.some((p) => {
      const needle = String(p).toLowerCase();
      return key === needle || key.startsWith(`${needle} `) || key.includes(needle);
    });
    const bundleMatch = bundleId && app.bundles.some((b) => {
      const needle = String(b).toLowerCase();
      return bundleId === needle || bundleId.startsWith(`${needle}.`);
    });
    if (procMatch || bundleMatch) return { ...app, processName, bundleId };
  }
  return null;
}

function parseCodingContext(windowTitle, appName) {
  const title = String(windowTitle || '').trim();
  if (!title || title.toLowerCase() === appName.toLowerCase()) {
    return { status: 'idle' };
  }

  const triple = title.match(/^(.+?)\s*[—–-]\s*(.+?)\s*[—–-]\s*(.+)$/);
  if (triple) {
    const left = triple[1].trim();
    const middle = triple[2].trim();
    const right = triple[3].trim();
    if (IDE_SUFFIX.test(right)) {
      if (IDLE_TITLES.test(left)) return { status: 'idle', projectName: middle };
      return { status: 'editing', fileName: left, projectName: middle };
    }
    if (/\.[a-z0-9]{1,8}$/i.test(middle)) {
      return { status: 'editing', fileName: middle, projectName: left };
    }
    if (/\.[a-z0-9]{1,8}$/i.test(left)) {
      return { status: 'editing', fileName: left, projectName: middle };
    }
    return { status: 'working', label: left };
  }

  // Two-part titles: "file.py — Project" or "Project — Cursor"
  const duo = title.match(/^(.+?)\s*[—–|]\s*(.+)$/);
  if (duo) {
    const left = duo[1].trim();
    const right = duo[2].trim();
    if (IDE_SUFFIX.test(right)) {
      if (IDLE_TITLES.test(left)) return { status: 'idle' };
      if (/\.[a-z0-9]{1,8}$/i.test(left)) return { status: 'editing', fileName: left };
      return { status: 'working', label: left, projectName: left };
    }
    if (/\.[a-z0-9]{1,8}$/i.test(left)) {
      return { status: 'editing', fileName: left, projectName: right };
    }
    if (/\.[a-z0-9]{1,8}$/i.test(right)) {
      return { status: 'editing', fileName: right, projectName: left };
    }
    return { status: 'working', label: left, projectName: right };
  }

  if (/\.[a-z0-9]{1,8}$/i.test(title)) {
    return { status: 'editing', fileName: title };
  }

  if (/chatgpt|claude|copilot|ollama|openclaw|opencode/i.test(appName)) {
    return { status: 'working', label: title };
  }

  if (IDLE_TITLES.test(title)) return { status: 'idle' };
  return { status: 'working', label: title };
}

function buildLiveLine(ctx) {
  if (!ctx) return null;
  if (ctx.status === 'editing' && ctx.fileName) {
    const parts = [`Editing ${ctx.fileName}`];
    if (ctx.projectName) parts.push(ctx.projectName);
    return parts.join(' · ');
  }
  if (ctx.status === 'idle') {
    return ctx.projectName ? `Idle · ${ctx.projectName}` : 'Idle';
  }
  if (ctx.status === 'browsing' && ctx.label) return ctx.label;
  if (ctx.label) return ctx.label;
  return null;
}

function normalizeCoding(raw) {
  const app = matchCodingApp(raw);
  if (!app) return null;

  const windowTitle = String(raw.windowTitle || '').trim();
  const ctx = parseCodingContext(windowTitle, app.name);
  const liveLine = buildLiveLine(ctx);

  return {
    appId: app.id,
    appName: app.name,
    processName: app.processName,
    windowTitle,
    status: ctx.status,
    fileName: ctx.fileName || null,
    projectName: ctx.projectName || null,
    liveLine,
    title: app.name,
    updatedAt: Date.now(),
  };
}

function codingSig(session) {
  if (!session) return '';
  return [
    session.appId,
    session.appName,
    session.status,
    session.fileName,
    session.projectName,
    session.liveLine,
    session.windowTitle,
  ].join('\0');
}

function createNowCodingService({ onUpdate } = {}) {
  if (process.env.SMILEY_DISABLE_NOW_CODING === '1') {
    return { async start() {}, async stop() {}, setBackgroundMode() {} };
  }

  let timer = null;
  let running = false;
  let lastSig = '';
  let backgroundMode = false;

  const pollDelay = () => (backgroundMode ? BACKGROUND_POLL_MS : POLL_MS);

  const emit = (session) => {
    const sig = codingSig(session);
    if (sig === lastSig) return;
    lastSig = sig;
    onUpdate?.(session);
  };

  const tick = async () => {
    if (!running) return;
    try {
      const raw = await pollRawForeground();
      // On macOS, `pollRawForeground()` can return `undefined` while a previous JXA poll is still in-flight.
      // In that case we should keep the loop alive (don't early-return and don't skip scheduling the next timer).
      if (raw !== undefined) emit(raw ? normalizeCoding(raw) : null);
    } catch (_) {}
    timer = setTimeout(tick, pollDelay());
  };

  return {
    async start() {
      if (running) return;
      running = true;
      lastSig = '';
      const raw = await pollRawForeground();
      if (raw !== undefined) emit(raw ? normalizeCoding(raw) : null);
      timer = setTimeout(tick, pollDelay());
    },
    async stop() {
      running = false;
      if (timer) { clearTimeout(timer); timer = null; }
      lastSig = '';
    },
    setBackgroundMode(background) {
      backgroundMode = background === true;
    },
  };
}

module.exports = {
  createNowCodingService,
  normalizeCoding,
  codingSig,
  matchCodingApp,
  parseCodingContext,
  buildLiveLine,
};
