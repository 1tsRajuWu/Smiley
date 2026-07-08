// Riot local client — lockfile auth + HTTPS to 127.0.0.1 (Valorant / LoL)
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const REQUEST_TIMEOUT_MS = 4000;

function getLockfilePath() {
  if (process.platform === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'Riot Games', 'Riot Client', 'Config', 'lockfile',
    );
  }
  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library', 'Application Support', 'Riot Games', 'Riot Client', 'Config', 'lockfile',
    );
  }
  return path.join(os.homedir(), '.config', 'Riot Games', 'Riot Client', 'Config', 'lockfile');
}

function readLockfile() {
  try {
    const text = fs.readFileSync(getLockfilePath(), 'utf8').trim();
    const [, , port, password] = text.split(':');
    if (!port || !password) return null;
    return { port, password };
  } catch {
    return null;
  }
}

function isLockfileAvailable() {
  try { return fs.existsSync(getLockfilePath()); } catch { return false; }
}

function localHttpsRequest(port, endpoint, password) {
  return new Promise((resolve) => {
    const auth = Buffer.from(`riot:${password}`).toString('base64');
    const req = https.request({
      hostname: '127.0.0.1',
      port: Number(port),
      path: endpoint,
      method: 'GET',
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) { resolve(null); return; }
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(REQUEST_TIMEOUT_MS, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function localHttpsPort2999(endpoint) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: '127.0.0.1', port: 2999, path: endpoint, method: 'GET',
      headers: { Accept: 'application/json' }, rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) { resolve(null); return; }
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(REQUEST_TIMEOUT_MS, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function decodePrivatePresence(privateValue) {
  if (!privateValue || typeof privateValue !== 'string') return null;
  try {
    return JSON.parse(Buffer.from(privateValue, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function getSelfPresence(lockfile) {
  const [session, presences] = await Promise.all([
    localHttpsRequest(lockfile.port, '/chat/v1/session', lockfile.password),
    localHttpsRequest(lockfile.port, '/chat/v4/presences', lockfile.password),
  ]);
  const puuid = session?.puuid || session?.cid;
  if (!puuid || !Array.isArray(presences?.presences)) return null;
  const self = presences.presences.find((e) => e?.puuid === puuid);
  if (!self) return null;
  return {
    puuid,
    product: self.product,
    gameName: self.game_name,
    gameTag: self.game_tag,
    privateData: decodePrivatePresence(self.private),
  };
}

module.exports = {
  readLockfile, isLockfileAvailable, localHttpsRequest, localHttpsPort2999,
  decodePrivatePresence, getSelfPresence,
};
