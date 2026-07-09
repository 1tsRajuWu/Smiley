/**
 * Valorant map + queue registries (valorant-api.com / Riot queue IDs, 2026-07).
 * Map asset paths use internal codenames (Jam, Plummet, HURM_*) — never display those raw.
 */

/** Playable agent UUID → display name (offline fallback when valorant-api.com is unreachable). */
const VALORANT_AGENT_NAMES = {
  'add6443a-41bd-e414-f6ad-e58d267f4e95': 'Jett',
  'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc': 'Reyna',
  '569fdd95-4d10-43ab-ca70-79becc718b46': 'Sage',
  '8e253930-4c05-31dd-1b6c-968525494517': 'Omen',
  '707eab51-4836-f488-046a-cda6bf494859': 'Viper',
  'eb93336a-449b-9c1b-0a54-a891f7921d69': 'Phoenix',
  '320b2a48-4d9b-a075-30f1-1f93a9b638fa': 'Sova',
  '117ed9e3-49f3-6512-3ccf-0cada7e3823b': 'Cypher',
  '22697a3d-45bf-8dd7-4fec-84a9e28c69d7': 'Chamber',
  '601dbbe7-43ce-be57-2a40-4abd24953621': 'KAY/O',
  '6f2a04ca-43e0-be17-7f36-b3908627744d': 'Skye',
  '1e58de9c-4950-5125-93e9-a0aee9f98746': 'Killjoy',
  '41fb69c1-4189-7b37-f117-bcaf1e96f1bf': 'Astra',
  '9f0d8ba9-4140-b941-57d3-a7ad57c6b417': 'Brimstone',
  'f94c3b30-42be-e959-889c-5aa313dba261': 'Raze',
  '5f8d3a7f-467b-97f3-062c-13acf203c006': 'Breach',
  'dade69b4-4f5a-8528-247b-219e5a1facd6': 'Fade',
  '95b78ed7-4637-86d9-7e41-71ba8c293152': 'Harbor',
  'e370fa57-4757-3604-3648-499e1f642d3f': 'Gekko',
  'cc8b64c8-4b25-4ff9-6e7f-37b4da43d235': 'Deadlock',
  'bb2a4828-46eb-8cd1-e765-15848195d751': 'Neon',
  '7f94d92c-4234-0a36-9646-3a87eb8b5c89': 'Yoru',
  '0e38b510-41a8-5780-5e8f-568b2a4f2d6c': 'Iso',
  '1dbf2edd-4729-0984-3115-daa5eed44993': 'Clove',
  'b444168c-4e35-8076-db47-ef9bf368f384': 'Tejo',
  'efba5359-4016-a1e5-7626-b1ae76895940': 'Vyse',
  'df1cb487-4902-002e-5c17-d28e83e78588': 'Waylay',
  '7c8a4701-4de6-9355-b254-e09bc2a34b72': 'Miks',
  '92eeef5d-43b5-1d4a-8d03-b3927a09034b': 'Veto',
};

function agentDisplayName(agentId) {
  const id = String(agentId || '').trim().toLowerCase();
  if (!id) return null;
  return VALORANT_AGENT_NAMES[id] || null;
}

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
  summit: { name: 'Summit', uuid: '756da597-416b-c0f2-f47b-afbdf28670bc' },
  plummet: { name: 'Summit', uuid: '756da597-416b-c0f2-f47b-afbdf28670bc' },
  range: { name: 'The Range', uuid: 'ee613ee9-28b7-4beb-9666-08db13bb2244' },
  rangev2: { name: 'The Range', uuid: '5914d1e0-40c4-cfdd-6b88-eba06347686c' },
  poveglia: { name: 'The Range', uuid: 'ee613ee9-28b7-4beb-9666-08db13bb2244' },
  povegliav2: { name: 'The Range', uuid: '5914d1e0-40c4-cfdd-6b88-eba06347686c' },
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

function isTeamDeathmatchQueue(id) {
  const raw = String(id || '').trim();
  if (!raw) return false;
  const k = normalizeQueueKey(raw).toLowerCase().replace(/[\s_-]+/g, '');
  // "TeamDeathmatch" / ModeID paths must NEVER classify as FFA deathmatch
  if (k === 'hurm' || k === 'onefa' || k === 'teamdeathmatch') return true;
  return /hurm|team.?death/i.test(raw);
}

function isDeathmatchQueue(id) {
  if (isTeamDeathmatchQueue(id)) return false;
  const k = normalizeQueueKey(id);
  return FFA_QUEUES.has(k);
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
  VALORANT_AGENT_NAMES,
  VALORANT_MODE_UUID,
  VALORANT_MAPS,
  VALORANT_MAP_UUID,
  VALORANT_MAP_BY_UUID,
  FFA_QUEUES,
  TEAM_SCORE_QUEUES,
  normalizeQueueKey,
  queueDisplayName,
  agentDisplayName,
  isDeathmatchQueue,
  isTeamDeathmatchQueue,
  resolveMap,
  mapDisplayName,
  mapUuid,
};
