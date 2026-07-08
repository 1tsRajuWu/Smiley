// Valorant rank — optional Riot API key (local, never sent to Smiley servers)
const { decryptSecret } = require('./security');

const RANK_CACHE_MS = 5 * 60 * 1000;
const rankCache = new Map();

const REGION_SHARDS = {
  na: 'na', latam: 'na', br: 'na',
  eu: 'eu', eune: 'eu', euw: 'eu', tr: 'eu', ru: 'eu',
  ap: 'ap', kr: 'kr', jp: 'ap',
};

function getRiotApiKey(config, userDataPath) {
  const enc = config?.riotRankKeyEnc;
  if (!enc) return null;
  const key = decryptSecret(enc, userDataPath);
  return key?.trim() || null;
}

function shardFromRegion(region) {
  const r = String(region || 'na').toLowerCase().replace(/[^a-z]/g, '');
  return REGION_SHARDS[r] || 'na';
}

function formatRankLine(tier, rr) {
  const t = String(tier || '').trim();
  if (!t) return null;
  const n = Number(rr);
  if (Number.isFinite(n) && n >= 0) return `${t} · ${n} RR`;
  return t;
}

async function fetchValorantRank(puuid, region, apiKey) {
  if (!puuid || !apiKey) return null;
  const shard = shardFromRegion(region);
  const cacheKey = `${shard}:${puuid}`;
  const hit = rankCache.get(cacheKey);
  if (hit && Date.now() - hit.at < RANK_CACHE_MS) return hit.data;

  try {
    const url = `https://${shard}.api.riotgames.com/val/rank/v1/by-puuid/${encodeURIComponent(puuid)}`;
    const res = await fetch(url, {
      headers: { 'X-Riot-Token': apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const latest = Array.isArray(data) ? data[data.length - 1] : data;
    if (!latest) return null;
    const tier = latest.currenttierpatched || latest.CurrentTierPatched || null;
    const rr = latest.rankingInTier ?? latest.RankingInTier;
    const tierNum = latest.currenttier ?? latest.CurrentTier;
    const result = {
      rank: formatRankLine(tier, rr),
      rankTier: tier,
      rankRR: Number.isFinite(Number(rr)) ? Number(rr) : null,
      rankTierNum: Number.isFinite(Number(tierNum)) ? Number(tierNum) : null,
    };
    rankCache.set(cacheKey, { at: Date.now(), data: result });
    return result;
  } catch {
    return null;
  }
}

module.exports = {
  getRiotApiKey,
  fetchValorantRank,
  formatRankLine,
  shardFromRegion,
};
