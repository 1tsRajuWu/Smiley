/**
 * Valorant map + queue registries (valorant-api.com / Riot queue IDs, 2026-07).
 * Map asset paths use internal codenames (Jam, Plummet, HURM_*) — never display those raw.
 */

/** queueId (chat / party) → Discord-friendly display name */
const VALORANT_QUEUES = {
  competitive: 'Competitive',
  unrated: 'Unrated',
  swiftplay: 'Swiftplay',
  deathmatch: 'Deathmatch',
  // Spike Rush — modern + legacy keys
  spikerush: 'Spike Rush',
  spikeRush: 'Spike Rush',
  // Escalation (ggteam is the live queue id; "escalation" kept for older payloads)
  ggteam: 'Escalation',
  escalation: 'Escalation',
  // Team Deathmatch — current id is hurm; onefa is legacy
  hurm: 'Team Deathmatch',
  onefa: 'Team Deathmatch',
  // Retake (Patch 13.00+)
  fortcollins: 'Retake',
  retake: 'Retake',
  // Other modes
  replication: 'Replication',
  snowball: 'Snowball Fight',
  custom: 'Custom',
  newmap: 'New Map',
  premier: 'Premier',
  valaram: 'All Random One Site',
  dodgeball: 'Knockout',
  knockout: 'Knockout',
  skirmish2v2: 'Skirmish 2v2',
  skirmishascension2v2: 'Skirmish: Ascension',
  skirmishascension1v1: 'Skirmish: Ascension',
  bot: 'Bot Match',
};

/** queueId → gamemode UUID (media.valorant-api.com/gamemodes) */
const VALORANT_MODE_UUID = {
  competitive: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
  unrated: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
  swiftplay: '5d0f264b-4ebe-cc63-c147-809e1374484b',
  deathmatch: 'a8790ec5-4237-f2f0-e93b-08a8e89865b2',
  spikerush: 'e921d1e6-416b-c31f-1291-74930c330b7b',
  spikeRush: 'e921d1e6-416b-c31f-1291-74930c330b7b',
  ggteam: 'a4ed6518-4741-6dcb-35bd-f884aecdc859',
  escalation: 'a4ed6518-4741-6dcb-35bd-f884aecdc859',
  hurm: 'e086db66-47fd-e791-ca81-06a645ac7661',
  onefa: 'e086db66-47fd-e791-ca81-06a645ac7661',
  fortcollins: '75b7b658-472c-0264-cbe6-049abf14f54b',
  retake: '75b7b658-472c-0264-cbe6-049abf14f54b',
  replication: '4744698a-4513-dc96-9c22-a9aa437e4a58',
  snowball: '57038d6d-49b1-3a74-c5ef-3395d9f23a97',
  custom: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
  newmap: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
  premier: '96bd3920-4f36-d026-2b28-c683eb0bcac5',
  valaram: '1cd8901f-47af-49cb-d758-e2afd0eb2a39',
  dodgeball: '1a4a3fd5-4966-62cb-7fe4-15b0317f5c80',
  knockout: '1a4a3fd5-4966-62cb-7fe4-15b0317f5c80',
  skirmish2v2: '0e9805d8-4af6-5ffb-f467-55806a6bc484',
  skirmishascension2v2: 'd08c45fe-4415-edcf-65a3-45885cc4349b',
  skirmishascension1v1: 'd08c45fe-4415-edcf-65a3-45885cc4349b',
  bot: 'd2d0f229-4514-517a-b10a-aaa0ef0d4a67',
};

/**
 * Internal map path segment / display slug → { name, uuid }.
 * Keys are lowercased; includes display names, asset folder names, and HURM_* path tails.
 */
const VALORANT_MAPS = {
  // Standard / competitive maps (display + asset codenames)
  ascent: { name: 'Ascent', uuid: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319' },
  split: { name: 'Split', uuid: 'd960549e-485c-e861-8d71-aa9d1aed12a2' },
  bonsai: { name: 'Split', uuid: 'd960549e-485c-e861-8d71-aa9d1aed12a2' },
  fracture: { name: 'Fracture', uuid: 'b529448b-4d60-346e-e89e-00a4c527a405' },
  canyon: { name: 'Fracture', uuid: 'b529448b-4d60-346e-e89e-00a4c527a405' },
  bind: { name: 'Bind', uuid: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba' },
  duality: { name: 'Bind', uuid: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba' },
  breeze: { name: 'Breeze', uuid: '2fb9a4fd-47b8-4e7d-a969-74b4046ebd53' },
  foxtrot: { name: 'Breeze', uuid: '2fb9a4fd-47b8-4e7d-a969-74b4046ebd53' },
  abyss: { name: 'Abyss', uuid: '224b0a95-48b9-f703-1bd8-67aca101a61f' },
  infinity: { name: 'Abyss', uuid: '224b0a95-48b9-f703-1bd8-67aca101a61f' },
  lotus: { name: 'Lotus', uuid: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9' },
  jam: { name: 'Lotus', uuid: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9' },
  sunset: { name: 'Sunset', uuid: '92584fbe-486a-b1b2-9faa-39b0f486b498' },
  juliett: { name: 'Sunset', uuid: '92584fbe-486a-b1b2-9faa-39b0f486b498' },
  pearl: { name: 'Pearl', uuid: 'fd267378-4d1d-484f-ff52-77821ed10dc2' },
  pitt: { name: 'Pearl', uuid: 'fd267378-4d1d-484f-ff52-77821ed10dc2' },
  icebox: { name: 'Icebox', uuid: 'e2ad5c54-4114-a870-9641-8ea21279579a' },
  port: { name: 'Icebox', uuid: 'e2ad5c54-4114-a870-9641-8ea21279579a' },
  haven: { name: 'Haven', uuid: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047' },
  triad: { name: 'Haven', uuid: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047' },
  corrode: { name: 'Corrode', uuid: '1c18ab1f-420d-0d8b-71d0-77ad3c439115' },
  rook: { name: 'Corrode', uuid: '1c18ab1f-420d-0d8b-71d0-77ad3c439115' },
  // Patch 13.00+
  summit: { name: 'Summit', uuid: '756da597-416b-c0f2-f47b-afbdf28670bc' },
  plummet: { name: 'Summit', uuid: '756da597-416b-c0f2-f47b-afbdf28670bc' },
  // Team Deathmatch / HURM maps
  district: { name: 'District', uuid: '690b3ed2-4dff-945b-8223-6da834e30d24' },
  hurm_alley: { name: 'District', uuid: '690b3ed2-4dff-945b-8223-6da834e30d24' },
  hurmalley: { name: 'District', uuid: '690b3ed2-4dff-945b-8223-6da834e30d24' },
  kasbah: { name: 'Kasbah', uuid: '12452a9d-48c3-0b02-e7eb-0381c3520404' },
  hurm_bowl: { name: 'Kasbah', uuid: '12452a9d-48c3-0b02-e7eb-0381c3520404' },
  hurmbowl: { name: 'Kasbah', uuid: '12452a9d-48c3-0b02-e7eb-0381c3520404' },
  drift: { name: 'Drift', uuid: '2c09d728-42d5-30d8-43dc-96a05cc7ee9d' },
  hurm_helix: { name: 'Drift', uuid: '2c09d728-42d5-30d8-43dc-96a05cc7ee9d' },
  hurmhelix: { name: 'Drift', uuid: '2c09d728-42d5-30d8-43dc-96a05cc7ee9d' },
  glitch: { name: 'Glitch', uuid: 'd6336a5a-428f-c591-98db-c8a291159134' },
  hurm_hightide: { name: 'Glitch', uuid: 'd6336a5a-428f-c591-98db-c8a291159134' },
  hurmhightide: { name: 'Glitch', uuid: 'd6336a5a-428f-c591-98db-c8a291159134' },
  piazza: { name: 'Piazza', uuid: 'de28aa9b-4cbe-1003-320e-6cb3ec309557' },
  hurm_yard: { name: 'Piazza', uuid: 'de28aa9b-4cbe-1003-320e-6cb3ec309557' },
  hurmyard: { name: 'Piazza', uuid: 'de28aa9b-4cbe-1003-320e-6cb3ec309557' },
};

/** UUID → map entry (for raw UUID MapIDs) */
const VALORANT_MAP_BY_UUID = Object.create(null);
for (const entry of Object.values(VALORANT_MAPS)) {
  if (entry?.uuid) VALORANT_MAP_BY_UUID[entry.uuid.toLowerCase()] = entry;
}

/** Display-name slug → UUID (backward-compat for game-assets callers) */
const VALORANT_MAP_UUID = Object.create(null);
for (const [slug, entry] of Object.entries(VALORANT_MAPS)) {
  if (entry?.name && entry.uuid) {
    const displaySlug = entry.name.toLowerCase().replace(/\s+/g, '');
    VALORANT_MAP_UUID[displaySlug] = entry.uuid;
    VALORANT_MAP_UUID[slug] = entry.uuid;
  }
}

const FFA_QUEUES = new Set(['deathmatch']);
const TEAM_SCORE_QUEUES = new Set([
  'hurm', 'onefa', 'competitive', 'unrated', 'swiftplay', 'spikerush', 'spikeRush',
  'ggteam', 'escalation', 'premier', 'newmap', 'custom', 'fortcollins', 'retake',
  'valaram', 'replication', 'snowball', 'dodgeball', 'knockout',
]);

function normalizeQueueKey(id) {
  const k = String(id || '').trim();
  if (!k) return '';
  if (VALORANT_QUEUES[k]) return k;
  const camel = k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/\s+/g, '');
  if (VALORANT_QUEUES[camel]) return camel;
  return k;
}

function queueDisplayName(id) {
  const k = String(id || '').trim();
  if (!k) return null;
  if (VALORANT_QUEUES[k]) return VALORANT_QUEUES[k];
  const norm = normalizeQueueKey(k);
  if (VALORANT_QUEUES[norm]) return VALORANT_QUEUES[norm];
  // Don't show raw UUIDs as mode names
  if (/^[0-9a-f-]{36}$/i.test(k)) return null;
  return k.replace(/([a-z])([A-Z])/g, '$1 $2') || null;
}

function isDeathmatchQueue(id) {
  return FFA_QUEUES.has(normalizeQueueKey(id));
}

function isTeamDeathmatchQueue(id) {
  const k = normalizeQueueKey(id);
  return k === 'hurm' || k === 'onefa';
}

function slugifyMapToken(token) {
  return String(token || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Resolve MapID path, UUID, or display name → { name, uuid, mapId }.
 * Unknown paths fall back to a spaced last segment (never crash).
 */
function resolveMap(mapRef) {
  const raw = String(mapRef || '').trim();
  if (!raw) return { name: null, uuid: null, mapId: null };

  if (/^[0-9a-f-]{36}$/i.test(raw)) {
    const entry = VALORANT_MAP_BY_UUID[raw.toLowerCase()];
    return {
      name: entry?.name || null,
      uuid: entry?.uuid || raw,
      mapId: entry?.uuid || raw,
    };
  }

  const parts = raw.split(/[/\\]/).filter(Boolean);
  const candidates = [];
  if (parts.length) {
    candidates.push(parts[parts.length - 1]);
    if (parts.length >= 2) candidates.push(parts[parts.length - 2]);
  }
  candidates.push(raw);

  for (const c of candidates) {
    const slug = slugifyMapToken(c);
    if (!slug) continue;
    const entry = VALORANT_MAPS[slug];
    if (entry) {
      return { name: entry.name, uuid: entry.uuid, mapId: entry.uuid };
    }
  }

  // Graceful unknown: humanize last path segment
  const last = parts[parts.length - 1] || raw;
  const friendly = last
    .replace(/^HURM[_-]?/i, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return {
    name: friendly || null,
    uuid: null,
    mapId: raw,
  };
}

function mapDisplayName(mapRef) {
  return resolveMap(mapRef).name;
}

function mapUuid(mapRef) {
  return resolveMap(mapRef).uuid;
}

module.exports = {
  VALORANT_QUEUES,
  VALORANT_MODE_UUID,
  VALORANT_MAPS,
  VALORANT_MAP_UUID,
  VALORANT_MAP_BY_UUID,
  FFA_QUEUES,
  TEAM_SCORE_QUEUES,
  normalizeQueueKey,
  queueDisplayName,
  isDeathmatchQueue,
  isTeamDeathmatchQueue,
  resolveMap,
  mapDisplayName,
  mapUuid,
};
