// Game artwork — HTTPS CDN URLs only (never bundled binaries).
// Prefer small Discord-friendly assets (≤~256px / capsules) so RPC stays light.
const DDRAGON_VERSION = '14.24.1';

/**
 * Last-resort large_image when no game art resolves.
 * Never use a loading-spinner GIF — Discord would show that as the "broken" presence art.
 */
const SMILEY_LOGO = 'https://raw.githubusercontent.com/1tsRajuWu/Smiley/main/build/icon.png';

/** @deprecated was the Tenor loading spinner — maps to Smiley logo */
const GAMING_FALLBACK = SMILEY_LOGO;

/** Valorant competitive tier act UUID (valorant-api.com) */
const VALORANT_TIER_ACT = '03621f52-342b-cf4e-4f86-0cad5e4b6960';

/**
 * Official Valorant red "V" logomark — Riot CDN, already 128×128.
 * Never use map / gamemode display icons here — those look geometric, not the brand.
 */
const VALORANT_GAME_LOGO =
  'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/cbf4460132cdfeb2a97fad5f9dd25ba0bc058f76-128x128.png';

/** Steam CDN host Discord's image proxy reliably fetches. */
const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

/**
 * Per-game logo for Discord large_image.
 * Prefer square ~128–256 CDN icons over multi-MB key art.
 */
const GAME_LOGOS = {
  'riot-valorant': VALORANT_GAME_LOGO,
  'riot-lol': `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/662.png`,
  // Opaque store capsules / mid-size key arts (still URL-only — not bundled)
  fortnite: 'https://cdn2.unrealengine.com/fortnite-chapter-5-lobby-background-1920x1080-1920x1080-f550d56711fa.jpg',
  overwatch: 'https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440cf/blt77c4f0b6234b1b29/1683835839683/OW2_Launch_Key_Art.jpg',
  roblox: 'https://images.rbxcdn.com/5348266ea6c5e5c58c58b8667b5d8d01.jpg',
  minecraft: 'https://www.minecraft.net/content/dam/games/minecraft/key-art/Games_Subnav_Minecraft-300x465.jpg',
};

/** @deprecated alias — use GAME_LOGOS */
const GAME_DEFAULTS = { ...GAME_LOGOS, window: SMILEY_LOGO };

const {
  VALORANT_MODE_UUID,
  VALORANT_MAP_UUID,
  resolveMap,
  normalizeQueueKey,
} = require('./valorant-catalog');

function valorantAgentIcon(agentId) {
  const id = String(agentId || '').trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  // displayicon is 256×256 (~50KB) — Discord small_image friendly; no lighter stable square endpoint
  return `https://media.valorant-api.com/agents/${id}/displayicon.png`;
}

function valorantMapIcon(mapId) {
  const raw = String(mapId || '').trim();
  if (!raw) return null;
  const resolved = resolveMap(raw);
  const uuid = resolved.uuid
    || (/^[0-9a-f-]{36}$/i.test(raw) ? raw : null)
    || VALORANT_MAP_UUID[raw.toLowerCase().replace(/\s+/g, '')];
  if (!uuid) return null;
  // listviewicon (~456×100, ~65KB) — far lighter than splash (~2MB) or displayicon (1024²)
  return `https://media.valorant-api.com/maps/${uuid}/listviewicon.png`;
}

function valorantModeIcon(queueId) {
  const k = String(queueId || '').trim();
  if (!k) return null;
  const key = normalizeQueueKey(k);
  const uuid = VALORANT_MODE_UUID[key] || VALORANT_MODE_UUID[k];
  if (!uuid) return null;
  return `https://media.valorant-api.com/gamemodes/${uuid}/displayicon.png`;
}

function valorantRankIcon(tierNum) {
  const t = Number(tierNum);
  if (!Number.isFinite(t) || t < 3) return null;
  return `https://media.valorant-api.com/competitivetiers/${VALORANT_TIER_ACT}/${t}/smallicon.png`;
}

function lolChampionIcon(champ) {
  const name = String(champ || '').trim();
  if (!name) return null;
  const id = name.replace(/[^a-zA-Z0-9]/g, '');
  if (!id) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;
}

function normalizeSteamAppId(steamAppId) {
  const id = Number(steamAppId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.floor(id);
}

/**
 * Smallest Steam CDN candidates first (Discord large_image).
 * Prefer opaque JPEG capsules over transparent logo.png (proxy often struggles).
 */
function steamArtworkCandidates(steamAppId) {
  const id = normalizeSteamAppId(steamAppId);
  if (!id) return [];
  return [
    `${STEAM_CDN}/${id}/capsule_231x87.jpg`,
    `${STEAM_CDN}/${id}/capsule_184x69.jpg`,
    `${STEAM_CDN}/${id}/header.jpg`,
    `${STEAM_CDN}/${id}/library_600x900.jpg`,
  ];
}

/** Preferred light Steam large_image (~9KB capsule). */
function steamCapsule(steamAppId) {
  const id = normalizeSteamAppId(steamAppId);
  if (!id) return null;
  return `${STEAM_CDN}/${id}/capsule_231x87.jpg`;
}

function steamHeader(steamAppId) {
  const id = normalizeSteamAppId(steamAppId);
  if (!id) return null;
  return `${STEAM_CDN}/${id}/header.jpg`;
}

/** @deprecated prefer steamCapsule — logo.png is often transparent / heavier */
function steamLogo(steamAppId) {
  return steamCapsule(steamAppId);
}

function partyLabel(partySize) {
  const n = Number(partySize);
  if (!Number.isFinite(n) || n < 1) return null;
  const labels = { 1: 'Solo', 2: 'Duo', 3: 'Trio', 4: 'Quad', 5: 'Full stack' };
  return labels[n] || `${n}-stack`;
}

function artEnabled(opts) {
  return !opts || opts.showMapArt !== false;
}

function isSpinnerFallbackUrl(url) {
  return /loading-gif\.gif|On7kvXhzml4/i.test(String(url || ''));
}

/**
 * Resolve Discord large_image — always the game logo (not map/agent/champion art).
 * Returns a CDN URL string only (no embedded bytes). Prefer light capsules / 128px logos.
 */
function resolveGameArtwork(session) {
  if (!session) return SMILEY_LOGO;

  if (session.provider && GAME_LOGOS[session.provider]) {
    return GAME_LOGOS[session.provider];
  }

  // Pre-validated URL from Steam lookup (capsule preferred)
  const pre = session.steamArtworkUrl || session.artworkUrl;
  if (typeof pre === 'string'
    && /^https:\/\//i.test(pre)
    && !isSpinnerFallbackUrl(pre)
    && pre.length < 2048) {
    return pre;
  }

  const steam = steamCapsule(session.steamAppId);
  if (steam) return steam;

  return SMILEY_LOGO;
}

/**
 * Resolve Discord small_image — contextual overlay (agent, map, rank, mode, champion).
 */
function resolveSmallImage(session, opts) {
  if (!session) return null;
  const o = opts || {};

  if (session.provider === 'riot-valorant') {
    if (o.showAgent !== false && (session.inMatch || session.inPregame) && session.agentId) {
      const agent = valorantAgentIcon(session.agentId);
      if (agent) return agent;
    }
    if (artEnabled(o) && (session.inPregame || session.inMatch)) {
      const map = valorantMapIcon(session.mapId || session.map);
      if (map) return map;
    }
    if (o.showRank !== false && session.rankTierNum) {
      const rank = valorantRankIcon(session.rankTierNum);
      if (rank) return rank;
    }
    if (o.showMode !== false && (session.inLobby || session.inQueue)) {
      const mode = valorantModeIcon(session.queueId || session.modeKey);
      if (mode) return mode;
    }
    return null;
  }

  if (session.provider === 'riot-lol' && session.champ) {
    return lolChampionIcon(session.champ);
  }

  return null;
}

function resolveLargeImageText(session) {
  if (!session) return '';
  if (session.provider === 'riot-valorant') return session.title || 'Valorant';
  return session.title || session.agent || session.champ || session.map || session.mode
    || session.experience || '';
}

module.exports = {
  SMILEY_LOGO,
  GAMING_FALLBACK,
  GAME_LOGOS,
  GAME_DEFAULTS,
  VALORANT_GAME_LOGO,
  STEAM_CDN,
  DDRAGON_VERSION,
  VALORANT_TIER_ACT,
  valorantAgentIcon,
  valorantMapIcon,
  valorantModeIcon,
  valorantRankIcon,
  lolChampionIcon,
  steamArtworkCandidates,
  steamCapsule,
  steamHeader,
  steamLogo,
  partyLabel,
  isSpinnerFallbackUrl,
  resolveGameArtwork,
  resolveSmallImage,
  resolveLargeImageText,
};
