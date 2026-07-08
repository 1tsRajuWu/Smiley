// Steam metadata + lightweight CDN artwork (URL strings only — never bundle game art).
const fs = require('fs');
const path = require('path');
const { steamArtworkCandidates, steamCapsule, SMILEY_LOGO } = require('./game-assets');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 30 * 60 * 1000;
const URL_VALIDATE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MEM_ENTRIES = 200;
const VALIDATE_TIMEOUT_MS = 2500;
const SEARCH_TIMEOUT_MS = 5000;

/** Well-known Steam AppIDs — skip store search for popular process/title aliases. */
const STEAM_APP_ALIASES = {
  // Counter-Strike 2
  cs2: 730,
  'counter-strike 2': 730,
  'counter strike 2': 730,
  'counter-strike': 730,
  'counter strike': 730,
  csgo: 730,
  'cs:go': 730,
  'cs go': 730,
  // Other popular Steam titles
  dota2: 570,
  'dota 2': 570,
  tf2: 440,
  'team fortress 2': 440,
  gta5: 271590,
  gtav: 271590,
  'gta v': 271590,
  'gta 5': 271590,
  'grand theft auto v': 271590,
  rust: 252490,
  apex: 1172470,
  'apex legends': 1172470,
  'elden ring': 1245620,
  eldenring: 1245620,
  'pubg': 578080,
  'playerunknowns battlegrounds': 578080,
  terraria: 105600,
  amongus: 945360,
  'among us': 945360,
  hades: 1145360,
  stardew: 413150,
  'stardew valley': 413150,
  destiny2: 1085660,
  'destiny 2': 1085660,
  warframe: 230410,
  rocketleague: 252950,
  'rocket league': 252950,
  cyberpunk: 1091500,
  'cyberpunk 2077': 1091500,
  valheim: 892970,
  helldivers2: 553850,
  'helldivers 2': 553850,
};

const memCache = new Map(); // key → { at, ttl, data }
const urlOkCache = new Map(); // url → { at, ok }

let diskCachePath = null;
let diskLoaded = false;
let diskDirty = false;
let diskFlushTimer = null;

function setSteamCachePath(userDataDir) {
  if (!userDataDir) return;
  diskCachePath = path.join(userDataDir, 'steam-artwork-cache.json');
  diskLoaded = false;
}

function pruneMap(map, max) {
  while (map.size > max) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
}

function loadDiskCache() {
  if (diskLoaded || !diskCachePath) return;
  diskLoaded = true;
  try {
    const raw = fs.readFileSync(diskCachePath, 'utf8');
    const parsed = JSON.parse(raw);
    const entries = parsed?.entries;
    if (!entries || typeof entries !== 'object') return;
    const now = Date.now();
    for (const [key, row] of Object.entries(entries)) {
      if (!row || typeof row !== 'object') continue;
      const at = Number(row.at) || 0;
      const ttl = Number(row.ttl) || CACHE_TTL_MS;
      if (now - at > ttl) continue;
      memCache.set(String(key).toLowerCase(), { at, ttl, data: row.data ?? null });
    }
    pruneMap(memCache, MAX_MEM_ENTRIES);
  } catch {
    // ignore corrupt / missing cache
  }
}

function scheduleDiskFlush() {
  if (!diskCachePath || diskFlushTimer) return;
  diskFlushTimer = setTimeout(() => {
    diskFlushTimer = null;
    if (!diskDirty || !diskCachePath) return;
    diskDirty = false;
    try {
      const entries = {};
      for (const [key, row] of memCache.entries()) {
        entries[key] = { at: row.at, ttl: row.ttl, data: row.data };
      }
      fs.writeFileSync(
        diskCachePath,
        JSON.stringify({ v: 1, updatedAt: Date.now(), entries }),
        'utf8',
      );
    } catch {
      // non-fatal
    }
  }, 1500);
}

function cacheGet(key) {
  loadDiskCache();
  const hit = memCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > hit.ttl) {
    memCache.delete(key);
    return undefined;
  }
  return hit.data;
}

function cacheSet(key, data, ttl = CACHE_TTL_MS) {
  memCache.delete(key); // refresh insertion order
  memCache.set(key, { at: Date.now(), ttl, data });
  pruneMap(memCache, MAX_MEM_ENTRIES);
  diskDirty = true;
  scheduleDiskFlush();
}

function normalizeTerm(term) {
  return String(term || '')
    .trim()
    .toLowerCase()
    .replace(/\.exe$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasAppId(term) {
  const key = normalizeTerm(term);
  if (!key) return null;
  if (STEAM_APP_ALIASES[key]) return STEAM_APP_ALIASES[key];
  // strip trailing version-ish tokens
  const stripped = key.replace(/\s+(x64|x86|dx11|dx12|win64|shipping)$/i, '').trim();
  if (stripped !== key && STEAM_APP_ALIASES[stripped]) return STEAM_APP_ALIASES[stripped];
  return null;
}

async function fetchWithTimeout(url, { method = 'GET', timeoutMs = SEARCH_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      signal: ctrl.signal,
      headers: { Accept: '*/*', 'User-Agent': 'Smiley' },
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validate that Discord can fetch this URL (2xx + image/*). Cache results aggressively.
 */
async function validateImageUrl(url) {
  const u = String(url || '').trim();
  if (!u || !/^https:\/\//i.test(u) || u.length > 2048) return false;

  const cached = urlOkCache.get(u);
  if (cached && Date.now() - cached.at < URL_VALIDATE_TTL_MS) return cached.ok;

  let ok = false;
  try {
    let res = await fetchWithTimeout(u, { method: 'HEAD', timeoutMs: VALIDATE_TIMEOUT_MS });
    if (res.status === 405 || res.status === 403 || res.status === 400) {
      res = await fetchWithTimeout(u, { method: 'GET', timeoutMs: VALIDATE_TIMEOUT_MS });
    }
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    ok = res.ok && (ct.startsWith('image/') || ct === '' || ct.includes('octet-stream'));
    // Reject HTML error pages mistakenly marked ok
    if (ok && ct.includes('text/html')) ok = false;
  } catch {
    ok = false;
  }

  urlOkCache.delete(u);
  urlOkCache.set(u, { at: Date.now(), ok });
  pruneMap(urlOkCache, MAX_MEM_ENTRIES);
  return ok;
}

async function pickValidatedSteamArtwork(steamAppId) {
  const candidates = steamArtworkCandidates(steamAppId);
  for (const url of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await validateImageUrl(url)) return url;
  }
  return null;
}

function scoreSteamItem(item, query) {
  const name = String(item?.name || '').toLowerCase();
  if (!name) return -1;
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.includes(query)) return 60;
  // token overlap
  const qTokens = query.split(' ').filter(Boolean);
  const hits = qTokens.filter((t) => name.includes(t)).length;
  return hits * 15;
}

function pickBestSteamItem(items, query) {
  const apps = (items || []).filter((e) => e?.type === 'app' && e?.name && e?.id);
  if (!apps.length) return null;
  // Prefer exact / high-score; avoid soundtracks / DLCs that often match loosely
  const ranked = apps
    .map((item) => ({
      item,
      score: scoreSteamItem(item, query)
        - (/soundtrack|ost\b|artbook|dlc|demo\b|dedicated server/i.test(item.name) ? 40 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score > 0 ? ranked[0].item : apps[0];
}

function metaFromAppId(steamAppId, name = null) {
  const id = Number(steamAppId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    name: name || null,
    steamAppId: id,
    metascore: null,
    tags: [],
    artworkUrl: steamCapsule(id),
  };
}

async function enrichMetaArtwork(meta) {
  if (!meta?.steamAppId) return meta;
  const validated = await pickValidatedSteamArtwork(meta.steamAppId);
  if (validated) {
    return { ...meta, artworkUrl: validated, steamArtworkUrl: validated };
  }
  // Do not ship a 404 URL — fall back to Smiley logo rather than spinner
  return { ...meta, artworkUrl: SMILEY_LOGO, steamArtworkUrl: null };
}

async function searchSteamStore(term) {
  const q = encodeURIComponent(term);
  const res = await fetchWithTimeout(
    `https://store.steampowered.com/api/storesearch/?term=${q}&l=english&cc=US`,
    { timeoutMs: SEARCH_TIMEOUT_MS },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return pickBestSteamItem(data?.items, term);
}

/**
 * Resolve Steam AppID + light CDN artwork for a game title / process name.
 * Cached in memory (+ optional disk under userData). Never downloads image bytes.
 */
async function lookupSteamMetadata(term) {
  const key = normalizeTerm(term);
  if (!key) return null;

  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  try {
    const aliased = aliasAppId(key);
    let meta = null;

    if (aliased) {
      meta = metaFromAppId(aliased, term);
    } else {
      const item = await searchSteamStore(key);
      if (item) {
        meta = {
          name: item.name,
          steamAppId: Number(item.id) || null,
          metascore: item.metascore ? String(item.metascore) : null,
          tags: (item.tags || []).map((t) => t?.name || t).filter(Boolean).slice(0, 3),
          artworkUrl: Number(item.id) ? steamCapsule(item.id) : null,
        };
      }
    }

    if (!meta?.steamAppId) {
      cacheSet(key, null, NEGATIVE_TTL_MS);
      return null;
    }

    meta = await enrichMetaArtwork(meta);
    cacheSet(key, meta, CACHE_TTL_MS);
    // Also cache under canonical AppID for reuse
    cacheSet(`app:${meta.steamAppId}`, meta, CACHE_TTL_MS);
    return meta;
  } catch {
    cacheSet(key, null, NEGATIVE_TTL_MS);
    return null;
  }
}

/** Sync helper for tests — AppID alias table only (no network). */
function resolveSteamAppIdAlias(term) {
  return aliasAppId(term);
}

module.exports = {
  lookupSteamMetadata,
  validateImageUrl,
  setSteamCachePath,
  resolveSteamAppIdAlias,
  STEAM_APP_ALIASES,
  pickValidatedSteamArtwork,
};
