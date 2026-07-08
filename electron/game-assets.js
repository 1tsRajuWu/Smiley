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

/** Valorant queueId → gamemode UUID (valorant-api.com, verified 2026-07) */
const VALORANT_MODE_UUID = {
  competitive: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
  unrated: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
  swiftplay: '5d0f264b-4ebe-cc63-c147-809e1374484b',
  deathmatch: 'a8790ec5-4237-f2f0-e93b-08a8e89865b2',
  ggteam: 'e921d1e6-416b-c31f-1291-74930c330b7b',
  spikeRush: 'e921d1e6-416b-c31f-1291-74930c330b7b',
  onefa: 'e086db66-47fd-e791-ca81-06a645ac7661',
  escalation: 'a4ed6518-4741-6dcb-35bd-f884aecdc859',
  replication: '4744698a-4513-dc96-9c22-a9aa437e4a58',
  snowball: '57038d6d-49b1-3a74-c5ef-3395d9f23a97',
  custom: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
  newmap: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
  premier: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
};

const VALORANT_MAP_UUID = {
  ascent: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319',
  bind: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba',
  breeze: '2fb9a4fd-47b8-4e7d-a969-74b4046ebd53',
  fracture: 'b529448b-4d60-346e-e89e-00a4c527a405',
  haven: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047',
  icebox: 'e2ad5c54-4114-a870-9641-8ea21279579a',
  lotus: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9',
  pearl: 'fd267378-4d1d-484f-ff52-77821ed10dc2',
  split: 'd960549e-485c-e861-8d71-aa9d1aed12a2',
  sunset: '92584fbe-486a-b1b2-9faa-39b0f486b498',
  abyss: '224b0a95-48b9-f703-1bd8-67aca101a61f',
  corrode: '1c18ab1f-420d-0d8b-71d0-77ad3c439115',
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
    if (session.inMatch) {
      const agent = valorantAgentIcon(session.agentId);
      if (agent) return agent;
    }
    if (session.inPregame || session.inMatch) {
      const map = valorantMapIcon(session.mapId || session.map);
      if (map) return map;
    }
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
  if (session.provider === 'riot-valorant') {
    if (session.inMatch && session.agent) return session.agent;
    if ((session.inPregame || session.inMatch) && session.map) return session.map;
    if (session.mode) return session.mode;
    return session.title || '';
  }
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
