// Game artwork — HTTPS URLs Discord's proxy can fetch (agent > map > mode > game default)
const DDRAGON_VERSION = '14.24.1';

/** Tenor GIF — trusted by Discord RPC image proxy */
const GAMING_FALLBACK = 'https://media.tenor.com/On7kvXhzml4AAAAi/loading-gif.gif';

const GAME_DEFAULTS = {
  'riot-valorant': 'https://media.valorant-api.com/agents/9338a55c-4ab7-4634-9ac9-e2e799c4f4d7/displayicon.png',
  'riot-lol': 'https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png',
  fortnite: 'https://cdn2.unrealengine.com/fortnite-chapter-5-lobby-background-1920x1080-1920x1080-f550d56711fa.jpg',
  overwatch: 'https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440cf/blt77c4f0b6234b1b29/1683835839683/OW2_Launch_Key_Art.jpg',
  roblox: 'https://images.rbxcdn.com/5348266ea6c5e5c58c58b8667b5d8d01.jpg',
  minecraft: 'https://www.minecraft.net/content/dam/games/minecraft/key-art/Games_Subnav_Minecraft-300x465.jpg',
  window: GAMING_FALLBACK,
};

/** Valorant queueId → gamemode UUID (valorant-api.com) */
const VALORANT_MODE_UUID = {
  competitive: '0f1203cb-0c83-46e0-8821-aa6edd3eb168',
  unrated: '96e37eab-7efb-4f93-9da4-0f9ab09387df',
  swiftplay: '680311d4-4def-8c8d-4d4d-b9b2b7a0c4ef',
  deathmatch: '3f0c3dcb-4c65-4f67-b573-0ec8cdbf3c04',
  ggteam: '952adb6a-4a9b-4d3a-b7c5-9c8a2e4e7b1f',
  spikeRush: '952adb6a-4a9b-4d3a-b7c5-9c8a2e4e7b1f',
  onefa: '952adb6a-4a9b-4d3a-b7c5-9c8a2e4e7b1f',
  escalation: '49ab6300-4f7f-4a8d-8b68d-2b0e3d3e8e48',
  replication: '0cee8f74-f0c5-4704-95fc-949a8996ab8c',
  snowball: '4b73d314-4c4c-4a4c-9d2e-0e8a4b5c3f2a',
  custom: '96e37eab-7efb-4f93-9da4-0f9ab09387df',
  newmap: '96e37eab-7efb-4f93-9da4-0f9ab09387df',
  premier: '0f1203cb-0c83-46e0-8821-aa6edd3eb168',
};

const VALORANT_MAP_UUID = {
  ascent: '7eaecc1b-1427-d35c-8a03-6b4a9e9e3705',
  bind: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5ba1',
  breeze: 'ad9f1c9e-4571-0f03-e8b3-5b4c9b7e1cde',
  fracture: 'b529448b-4d60-346e-e89d-757a59e60e28',
  haven: '2bee0dc9-4ffe-533b-a3f0-f7402f2e3f9f',
  icebox: 'e2ad5c54-4114-a870-9611-0ca7db44c2b9',
  lotus: '2d267977-4d25-8e9e-6c4e-2f8d4b8e5e1a',
  pearl: 'fd267378-4885-ccd4-7252-3671dfcc2a52',
  split: 'd960549e-485c-e861-8e71-9e2011a0129d',
  sunset: 'a7b1c2d3-e4f5-6789-abcd-ef0123456789',
};

function valorantAgentIcon(agentId) {
  const id = String(agentId || '').trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return `https://media.valorant-api.com/agents/${id}/displayicon.png`;
}

function valorantMapIcon(mapId) {
  const raw = String(mapId || '').trim();
  if (!raw) return null;
  if (/^[0-9a-f-]{36}$/i.test(raw)) {
    return `https://media.valorant-api.com/maps/${raw}/listviewicon.png`;
  }
  const slug = raw.split('/').pop()?.toLowerCase().replace(/\s+/g, '');
  const uuid = VALORANT_MAP_UUID[slug];
  return uuid ? `https://media.valorant-api.com/maps/${uuid}/listviewicon.png` : null;
}

function valorantModeIcon(queueId) {
  const k = String(queueId || '').trim();
  if (!k) return null;
  const uuid = VALORANT_MODE_UUID[k] || VALORANT_MODE_UUID[k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/\s/g, '')];
  if (!uuid) return null;
  return `https://media.valorant-api.com/gamemodes/${uuid}/displayicon.png`;
}

function lolChampionIcon(champ) {
  const name = String(champ || '').trim();
  if (!name) return null;
  const id = name.replace(/[^a-zA-Z0-9]/g, '');
  if (!id) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;
}

function steamHeader(steamAppId) {
  const id = Number(steamAppId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`;
}

function partyLabel(partySize) {
  const n = Number(partySize);
  if (!Number.isFinite(n) || n < 1) return null;
  const labels = { 1: 'Solo', 2: 'Duo', 3: 'Trio', 4: 'Quad', 5: 'Full stack' };
  return labels[n] || `${n}-stack`;
}

/**
 * Resolve Discord large_image URL — priority: agent > map > mode > explicit > steam > game default
 */
function resolveGameArtwork(session) {
  if (!session) return GAMING_FALLBACK;

  if (session.provider === 'riot-valorant') {
    const agent = valorantAgentIcon(session.agentId);
    if (agent) return agent;
    const map = valorantMapIcon(session.mapId || session.map);
    if (map) return map;
    const mode = valorantModeIcon(session.queueId || session.modeKey);
    if (mode) return mode;
    return GAME_DEFAULTS['riot-valorant'];
  }

  if (session.provider === 'riot-lol') {
    const champ = lolChampionIcon(session.champ);
    if (champ) return champ;
    return GAME_DEFAULTS['riot-lol'];
  }

  if (session.artworkUrl && /^https:\/\//i.test(session.artworkUrl)) {
    return session.artworkUrl;
  }

  const steam = steamHeader(session.steamAppId);
  if (steam) return steam;

  return GAME_DEFAULTS[session.provider] || GAMING_FALLBACK;
}

function resolveLargeImageText(session) {
  if (!session) return '';
  return session.agent || session.champ || session.map || session.mode
    || session.experience || session.title || '';
}

module.exports = {
  GAMING_FALLBACK,
  GAME_DEFAULTS,
  DDRAGON_VERSION,
  valorantAgentIcon,
  valorantMapIcon,
  valorantModeIcon,
  lolChampionIcon,
  steamHeader,
  partyLabel,
  resolveGameArtwork,
  resolveLargeImageText,
};
