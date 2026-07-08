/**
 * Silent signed UI live patches — UI overlay only (src/).
 * Fetches a signed zip from GitHub Pages, verifies ed25519 + sha256,
 * extracts to userData/live-ui, soft-reloads the window.
 * Never runs remote main-process / preload / native code.
 */
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const MANIFEST_URL = 'https://1tsrajuwu.github.io/Smiley/live/manifest.json';
const ALLOWED_HOST = '1tsrajuwu.github.io';
const CHECK_INTERVAL_MS = 45 * 60 * 1000;
const STATE_FILE = 'live-ui-state.json';
const LIVE_DIR = 'live-ui';
const LIVE_NEXT = 'live-ui-next';
const LIVE_PREV = 'live-ui-prev';
const MAX_ZIP_BYTES = 25 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  '.html', '.css', '.js', '.json',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf',
]);

function compareSemver(a, b) {
  const pa = String(a || '0').split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

function loadPublicKey(appRoot) {
  const pemPath = path.join(appRoot, 'build', 'live-patch-public.pem');
  if (!fs.existsSync(pemPath)) return null;
  try {
    return crypto.createPublicKey(fs.readFileSync(pemPath, 'utf8'));
  } catch {
    return null;
  }
}

function httpGetBuffer(url, { maxRedirects = 4, timeout = 20000, maxBytes = MAX_ZIP_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Invalid URL'));
      return;
    }
    if (parsed.protocol !== 'https:') {
      reject(new Error('HTTPS required'));
      return;
    }
    if (parsed.hostname.toLowerCase().replace(/^www\./, '') !== ALLOWED_HOST) {
      reject(new Error('Host not allowed'));
      return;
    }

    const req = https.get(
      url,
      {
        headers: { Accept: '*/*', 'User-Agent': 'Smiley-LiveUI' },
        timeout,
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'));
            return;
          }
          httpGetBuffer(res.headers.location, { maxRedirects: maxRedirects - 1, timeout, maxBytes })
            .then(resolve)
            .catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            reject(new Error('Response too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.on('error', reject);
  });
}

function httpGetJson(url) {
  return httpGetBuffer(url, { maxBytes: 256 * 1024 }).then((buf) => JSON.parse(buf.toString('utf8')));
}

async function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    const ps = `
$ErrorActionPreference = 'Stop'
Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force
`;
    await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true });
  } else {
    await execFileAsync('unzip', ['-oq', zipPath, '-d', destDir]);
  }
}

function assertSafeExtractedTree(rootDir) {
  const stack = [rootDir];
  const rootResolved = path.resolve(rootDir);
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      if (name === '..' || name.includes('\0')) throw new Error('Unsafe path in patch');
      const full = path.join(dir, name);
      const resolved = path.resolve(full);
      if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
        throw new Error('Path escape in patch');
      }
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) throw new Error('Symlinks not allowed in patch');
      if (st.isDirectory()) {
        stack.push(full);
        continue;
      }
      const ext = path.extname(name).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) throw new Error(`Disallowed file type: ${name}`);
    }
  }
  if (!fs.existsSync(path.join(rootDir, 'index.html'))) {
    throw new Error('Patch missing index.html');
  }
  if (!fs.existsSync(path.join(rootDir, 'renderer.js'))) {
    throw new Error('Patch missing renderer.js');
  }
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) {}
}

function renameReplace(from, to) {
  rmrf(to);
  fs.renameSync(from, to);
}

/**
 * @param {object} opts
 * @param {() => string} opts.getUserDataPath
 * @param {() => string} opts.getAppRoot
 * @param {string} opts.appVersion
 * @param {() => boolean} opts.isPackaged
 * @param {() => import('electron').BrowserWindow | null} opts.getMainWindow
 * @param {(msg: string) => void} [opts.log]
 */
function createLiveUiPatch(opts) {
  const log = opts.log || ((msg) => console.log(`[live-ui] ${msg}`));
  let timer = null;
  let checking = false;
  let status = {
    enabled: false,
    appliedPatchVersion: null,
    lastCheckAt: null,
    lastError: null,
    status: 'idle',
  };

  function statePath() {
    return opts.getUserDataPath(STATE_FILE);
  }

  function liveDir() {
    return opts.getUserDataPath(LIVE_DIR);
  }

  function readState() {
    try {
      const raw = fs.readFileSync(statePath(), 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function writeState(next) {
    ensureParent(statePath());
    fs.writeFileSync(statePath(), `${JSON.stringify(next, null, 2)}\n`);
  }

  function ensureParent(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function isOverlayValid() {
    const dir = liveDir();
    const indexHtml = path.join(dir, 'index.html');
    const renderer = path.join(dir, 'renderer.js');
    if (!fs.existsSync(indexHtml) || !fs.existsSync(renderer)) return false;
    try {
      assertSafeExtractedTree(dir);
      return true;
    } catch (err) {
      log(`invalid overlay: ${err.message}`);
      return false;
    }
  }

  function getRendererIndexPath() {
    if (isOverlayValid()) return path.join(liveDir(), 'index.html');
    return path.join(opts.getAppRoot(), 'src', 'index.html');
  }

  function getStatus() {
    const st = readState();
    return {
      ...status,
      enabled: !!opts.isPackaged(),
      appliedPatchVersion: st.appliedPatchVersion || null,
      appliedAt: st.appliedAt || null,
      usingLiveUi: isOverlayValid(),
      lastCheckAt: status.lastCheckAt,
      lastError: status.lastError,
      status: status.status,
    };
  }

  function softReload() {
    const win = opts.getMainWindow?.();
    if (!win || win.isDestroyed()) return;
    try {
      const indexPath = getRendererIndexPath();
      win.loadFile(indexPath);
      log('loaded live UI overlay');
    } catch (err) {
      log(`reload failed: ${err.message}`);
    }
  }

  function rollbackOverlay() {
    const prev = opts.getUserDataPath(LIVE_PREV);
    const cur = liveDir();
    if (!fs.existsSync(prev)) {
      rmrf(cur);
      return false;
    }
    try {
      renameReplace(prev, cur);
      log('rolled back to previous live UI');
      return true;
    } catch (err) {
      log(`rollback failed: ${err.message}`);
      return false;
    }
  }

  async function applyManifest(manifest) {
    const publicKey = loadPublicKey(opts.getAppRoot());
    if (!publicKey) throw new Error('Missing live-patch public key');

    const patchVersion = String(manifest.patchVersion || '').trim();
    const minAppVersion = String(manifest.minAppVersion || '0.0.0').trim();
    const sha256 = String(manifest.sha256 || '').trim().toLowerCase();
    const signature = String(manifest.signature || '').trim();
    const bundleUrl = String(manifest.bundleUrl || `${MANIFEST_URL.replace(/manifest\.json$/, '')}bundle.zip`).trim();

    if (!patchVersion || !/^[a-zA-Z0-9._-]{1,64}$/.test(patchVersion)) {
      throw new Error('Invalid patchVersion');
    }
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid sha256');
    if (!signature) throw new Error('Missing signature');
    if (compareSemver(opts.appVersion, minAppVersion) < 0) {
      throw new Error(`App ${opts.appVersion} below minAppVersion ${minAppVersion}`);
    }

    const st = readState();
    if (st.appliedPatchVersion === patchVersion && isOverlayValid()) {
      status.status = 'up-to-date';
      return { applied: false, reason: 'already-applied', patchVersion };
    }

    const zipBuf = await httpGetBuffer(bundleUrl);
    const actualHash = crypto.createHash('sha256').update(zipBuf).digest('hex');
    if (actualHash !== sha256) throw new Error('SHA-256 mismatch');

    const ok = crypto.verify(
      null,
      Buffer.from(sha256, 'utf8'),
      publicKey,
      Buffer.from(signature, 'base64')
    );
    if (!ok) throw new Error('Signature verification failed');

    const tmpZip = path.join(os.tmpdir(), `smiley-live-${patchVersion}-${process.pid}.zip`);
    const nextDir = opts.getUserDataPath(LIVE_NEXT);
    const prevDir = opts.getUserDataPath(LIVE_PREV);
    const curDir = liveDir();

    try {
      fs.writeFileSync(tmpZip, zipBuf);
      rmrf(nextDir);
      await extractZip(tmpZip, nextDir);
      assertSafeExtractedTree(nextDir);

      if (fs.existsSync(curDir)) {
        renameReplace(curDir, prevDir);
      } else {
        rmrf(prevDir);
      }
      renameReplace(nextDir, curDir);

      writeState({
        appliedPatchVersion: patchVersion,
        appliedAt: new Date().toISOString(),
        sha256,
        minAppVersion,
      });
      status.appliedPatchVersion = patchVersion;
      status.status = 'updated';
      status.lastError = null;
      log(`applied patch ${patchVersion}`);
      softReload();
      // Keep prev for one successful cycle; prune next
      rmrf(nextDir);
      return { applied: true, patchVersion };
    } catch (err) {
      rmrf(nextDir);
      if (!isOverlayValid()) rollbackOverlay();
      throw err;
    } finally {
      try { fs.unlinkSync(tmpZip); } catch (_) {}
    }
  }

  async function checkForLiveUiPatch({ force = false } = {}) {
    if (!opts.isPackaged() && process.env.SMILEY_LIVE_UI !== '1') {
      status.status = 'disabled';
      return { ok: true, status: 'disabled' };
    }
    if (checking) return { ok: true, status: 'busy' };
    checking = true;
    status.status = 'checking';
    status.lastCheckAt = new Date().toISOString();
    try {
      const manifest = await httpGetJson(MANIFEST_URL);
      const result = await applyManifest(manifest);
      status.lastError = null;
      if (!result.applied) status.status = 'up-to-date';
      return { ok: true, ...result, status: status.status };
    } catch (err) {
      const msg = err?.message || String(err);
      // Missing remote patch is not fatal (first publish may lag)
      if (/HTTP 404|ENOENT/i.test(msg)) {
        status.status = 'none';
        status.lastError = null;
        return { ok: true, status: 'none' };
      }
      status.status = 'error';
      status.lastError = msg;
      log(`check failed: ${msg}`);
      return { ok: false, error: msg, status: 'error' };
    } finally {
      checking = false;
    }
  }

  function start() {
    if (!opts.isPackaged() && process.env.SMILEY_LIVE_UI !== '1') return;
    // Delay first check so window can finish starting; then poll.
    setTimeout(() => {
      checkForLiveUiPatch().catch(() => {});
    }, 8000);
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      checkForLiveUiPatch().catch(() => {});
    }, CHECK_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Initialize status from disk
  const existing = readState();
  status.appliedPatchVersion = existing.appliedPatchVersion || null;
  status.enabled = !!opts.isPackaged() || process.env.SMILEY_LIVE_UI === '1';

  return {
    start,
    stop,
    checkForLiveUiPatch,
    getRendererIndexPath,
    isOverlayValid,
    getStatus,
    rollbackOverlay,
    MANIFEST_URL,
  };
}

module.exports = {
  createLiveUiPatch,
  compareSemver,
  MANIFEST_URL,
  ALLOWED_HOST,
};
