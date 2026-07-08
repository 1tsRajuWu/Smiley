const MAX_TITLE = 160;
const MAX_STATE = 160;
const MAX_KEY = 64;
const MAX_LABEL = 96;
const MAX_GROUP = 48;
const MAX_META_KEYS = 16;

const SECTION_DEFS = {
  app: { label: 'App Overview' },
  activity: { label: 'Activity Presets' },
  music_sync: { label: 'Music Sync' },
  game_sync: { label: 'Game Sync' },
  coding_sync: { label: 'Coding Sync' },
};

function nowIso() {
  return new Date().toISOString();
}

function limitText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

function normalizeCount(value) {
  const num = Math.floor(Number(value) || 0);
  return num > 0 ? num : 0;
}

function slugify(value, fallback = 'unknown') {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (text || fallback).slice(0, MAX_KEY);
}

function normalizeMetadata(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const out = {};
  for (const [key, value] of Object.entries(meta).slice(0, MAX_META_KEYS)) {
    const cleanKey = limitText(key, 32);
    if (!cleanKey) continue;
    if (typeof value === 'boolean') out[cleanKey] = value;
    else if (Number.isFinite(Number(value))) out[cleanKey] = Number(value);
    else {
      const cleanValue = limitText(String(value || ''), 160);
      if (cleanValue) out[cleanKey] = cleanValue;
    }
  }
  return out;
}

function createEmptyTelemetry() {
  return {
    schemaVersion: 2,
    sections: {},
    sources: {},
  };
}

function normalizeTelemetry(raw) {
  const base = createEmptyTelemetry();
  if (!raw || typeof raw !== 'object') return base;
  const out = {
    schemaVersion: 2,
    sections: {},
    sources: {},
  };
  for (const [sectionKey, section] of Object.entries(raw.sections || {})) {
    const key = slugify(sectionKey, '');
    if (!key) continue;
    out.sections[key] = {
      section_key: key,
      section_label: limitText(section.section_label, MAX_LABEL) || SECTION_DEFS[key]?.label || key,
      enabled: section.enabled === true,
      launch_count: normalizeCount(section.launch_count),
      seen_count: normalizeCount(section.seen_count),
      last_source_key: limitText(section.last_source_key, MAX_KEY),
      last_source_label: limitText(section.last_source_label, MAX_LABEL),
      last_source_group: limitText(section.last_source_group, MAX_GROUP),
      last_title: limitText(section.last_title, MAX_TITLE),
      last_state: limitText(section.last_state, MAX_STATE),
      first_seen_at: limitText(section.first_seen_at, 40),
      last_seen_at: limitText(section.last_seen_at, 40),
      last_metadata: normalizeMetadata(section.last_metadata),
    };
  }
  for (const [compoundKey, source] of Object.entries(raw.sources || {})) {
    const sectionKey = slugify(source.section_key || compoundKey.split(':')[0], '');
    const sourceKey = slugify(source.source_key || compoundKey.split(':').slice(1).join('-'), '');
    if (!sectionKey || !sourceKey) continue;
    out.sources[`${sectionKey}:${sourceKey}`] = {
      section_key: sectionKey,
      source_key: sourceKey,
      source_label: limitText(source.source_label, MAX_LABEL) || sourceKey,
      source_group: limitText(source.source_group, MAX_GROUP),
      launch_count: normalizeCount(source.launch_count),
      seen_count: normalizeCount(source.seen_count),
      last_title: limitText(source.last_title, MAX_TITLE),
      last_state: limitText(source.last_state, MAX_STATE),
      first_seen_at: limitText(source.first_seen_at, 40),
      last_seen_at: limitText(source.last_seen_at, 40),
      last_metadata: normalizeMetadata(source.last_metadata),
    };
  }
  return out;
}

function touchSection(state, sectionKey, patch = {}) {
  const current = state.sections[sectionKey] || {
    section_key: sectionKey,
    section_label: SECTION_DEFS[sectionKey]?.label || sectionKey,
    enabled: false,
    launch_count: 0,
    seen_count: 0,
    last_source_key: null,
    last_source_label: null,
    last_source_group: null,
    last_title: null,
    last_state: null,
    first_seen_at: null,
    last_seen_at: null,
    last_metadata: {},
  };
  const seenAt = patch.seenAt || nowIso();
  const next = {
    ...current,
    section_label: patch.sectionLabel || current.section_label,
    enabled: patch.enabled === undefined ? current.enabled : patch.enabled === true,
    launch_count: current.launch_count + normalizeCount(patch.launchIncrement),
    seen_count: current.seen_count + normalizeCount(patch.seenIncrement),
    last_source_key: patch.sourceKey || current.last_source_key,
    last_source_label: patch.sourceLabel || current.last_source_label,
    last_source_group: patch.sourceGroup || current.last_source_group,
    last_title: patch.title || current.last_title,
    last_state: patch.stateText || current.last_state,
    first_seen_at: current.first_seen_at || (patch.seenIncrement ? seenAt : current.first_seen_at),
    last_seen_at: patch.seenIncrement || patch.launchIncrement || patch.enabled !== undefined ? seenAt : current.last_seen_at,
    last_metadata: Object.keys(patch.metadata || {}).length ? normalizeMetadata(patch.metadata) : current.last_metadata,
  };
  state.sections[sectionKey] = next;
  return next;
}

function touchSource(state, patch = {}) {
  const sectionKey = slugify(patch.sectionKey, '');
  const sourceKey = slugify(patch.sourceKey, '');
  if (!sectionKey || !sourceKey) return null;
  const mapKey = `${sectionKey}:${sourceKey}`;
  const current = state.sources[mapKey] || {
    section_key: sectionKey,
    source_key: sourceKey,
    source_label: sourceKey,
    source_group: null,
    launch_count: 0,
    seen_count: 0,
    last_title: null,
    last_state: null,
    first_seen_at: null,
    last_seen_at: null,
    last_metadata: {},
  };
  const seenAt = patch.seenAt || nowIso();
  const next = {
    ...current,
    source_label: patch.sourceLabel || current.source_label,
    source_group: patch.sourceGroup || current.source_group,
    launch_count: current.launch_count + normalizeCount(patch.launchIncrement),
    seen_count: current.seen_count + normalizeCount(patch.seenIncrement),
    last_title: patch.title || current.last_title,
    last_state: patch.stateText || current.last_state,
    first_seen_at: current.first_seen_at || (patch.seenIncrement ? seenAt : current.first_seen_at),
    last_seen_at: patch.seenIncrement || patch.launchIncrement ? seenAt : current.last_seen_at,
    last_metadata: Object.keys(patch.metadata || {}).length ? normalizeMetadata(patch.metadata) : current.last_metadata,
  };
  state.sources[mapKey] = next;
  return next;
}

function observe(state, sectionKey, data = {}) {
  const next = normalizeTelemetry(state);
  const safeSectionKey = slugify(sectionKey, sectionKey);
  const sourceKey = data.sourceKey ? slugify(data.sourceKey) : null;
  const payload = {
    sectionLabel: data.sectionLabel || SECTION_DEFS[safeSectionKey]?.label || safeSectionKey,
    enabled: data.enabled,
    launchIncrement: data.launchIncrement,
    seenIncrement: data.seenIncrement ?? 1,
    sourceKey,
    sourceLabel: limitText(data.sourceLabel, MAX_LABEL),
    sourceGroup: limitText(data.sourceGroup, MAX_GROUP),
    title: limitText(data.title, MAX_TITLE),
    stateText: limitText(data.stateText, MAX_STATE),
    metadata: normalizeMetadata(data.metadata),
    seenAt: data.seenAt || nowIso(),
  };
  touchSection(next, safeSectionKey, payload);
  if (sourceKey) {
    touchSource(next, {
      sectionKey: safeSectionKey,
      sourceKey,
      sourceLabel: payload.sourceLabel || sourceKey,
      sourceGroup: payload.sourceGroup,
      launchIncrement: data.sourceLaunchIncrement,
      seenIncrement: data.sourceSeenIncrement ?? payload.seenIncrement,
      title: payload.title,
      stateText: payload.stateText,
      metadata: payload.metadata,
      seenAt: payload.seenAt,
    });
  }
  return next;
}

function recordLaunch(state, launchInfo = {}) {
  let next = normalizeTelemetry(state);
  next = observe(next, 'app', {
    enabled: true,
    launchIncrement: 1,
    seenIncrement: 0,
    sourceKey: launchInfo.channel || 'release',
    sourceLabel: launchInfo.channel || 'release',
    sourceGroup: 'channel',
    title: launchInfo.appVersion || null,
    stateText: launchInfo.platform || null,
    metadata: {
      appVersion: launchInfo.appVersion,
      platform: launchInfo.platform,
      arch: launchInfo.arch,
      channel: launchInfo.channel,
    },
    sourceLaunchIncrement: 1,
    sourceSeenIncrement: 0,
  });
  for (const feature of [
    ['music_sync', launchInfo.musicEnabled],
    ['game_sync', launchInfo.gameEnabled],
    ['coding_sync', launchInfo.codingEnabled],
  ]) {
    const [sectionKey, enabled] = feature;
    next = observe(next, sectionKey, {
      enabled,
      launchIncrement: enabled ? 1 : 0,
      seenIncrement: 0,
      metadata: { enabled: enabled === true, channel: launchInfo.channel, appVersion: launchInfo.appVersion },
    });
  }
  return next;
}

function recordActivity(state, activity) {
  const sectionKey = 'activity';
  const sourceKey = slugify(activity?.id || activity?.details || 'activity');
  return observe(state, sectionKey, {
    enabled: true,
    sourceKey,
    sourceLabel: activity?.details || activity?.id || 'Activity',
    sourceGroup: activity?.category || 'activity',
    title: activity?.details || null,
    stateText: activity?.state || null,
    metadata: {
      category: activity?.category || 'activity',
      emoji: activity?.emoji || null,
    },
  });
}

function recordMusic(state, track) {
  if (!track?.title) return normalizeTelemetry(state);
  const sourceLabel = track.device || 'Unknown player';
  return observe(state, 'music_sync', {
    enabled: true,
    sourceKey: sourceLabel,
    sourceLabel,
    sourceGroup: 'player',
    title: track.title,
    stateText: track.artist || track.album || (track.isPlaying ? 'Playing' : 'Paused'),
    metadata: {
      album: track.album,
      isPlaying: track.isPlaying !== false,
      hasArtwork: !!track.artworkUrl,
    },
  });
}

function recordGame(state, session) {
  if (!session?.title) return normalizeTelemetry(state);
  const sourceLabel = session.provider || session.processName || session.launcher || 'Unknown game';
  return observe(state, 'game_sync', {
    enabled: true,
    sourceKey: sourceLabel,
    sourceLabel,
    sourceGroup: session.provider ? 'provider' : 'process',
    title: session.title,
    stateText: session.liveLine || session.mode || session.map || null,
    metadata: {
      mode: session.mode,
      map: session.map,
      inMatch: session.inMatch === true,
      launcher: session.launcher,
    },
  });
}

function recordCoding(state, session) {
  if (!session?.appName) return normalizeTelemetry(state);
  const sourceLabel = session.appName;
  return observe(state, 'coding_sync', {
    enabled: true,
    sourceKey: session.appId || session.processName || sourceLabel,
    sourceLabel,
    sourceGroup: 'editor',
    title: session.fileName || session.projectName || session.appName,
    stateText: session.liveLine || session.status || null,
    metadata: {
      status: session.status,
      projectName: session.projectName,
    },
  });
}

function summarizeForInstall(telemetry) {
  const next = normalizeTelemetry(telemetry);
  const sections = Object.values(next.sections).filter((section) => section.seen_count > 0);
  sections.sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')));
  const latest = sections[0] || null;
  return {
    last_activity_section: latest?.section_key || null,
    last_activity_source: latest?.last_source_label || latest?.last_source_key || null,
    last_activity_seen_at: latest?.last_seen_at || null,
    active_sections: sections.length,
    section_overview: sections.reduce((acc, section) => {
      acc[section.section_key] = {
        seen_count: section.seen_count,
        launch_count: section.launch_count,
        latest_source: section.last_source_label || section.last_source_key || null,
      };
      return acc;
    }, {}),
  };
}

function buildSectionRows(telemetry, installId) {
  return Object.values(normalizeTelemetry(telemetry).sections).map((section) => ({
    install_id: installId,
    section_key: section.section_key,
    section_label: section.section_label,
    enabled: section.enabled === true,
    launch_count: section.launch_count,
    seen_count: section.seen_count,
    last_source_key: section.last_source_key,
    last_source_label: section.last_source_label,
    last_source_group: section.last_source_group,
    last_title: section.last_title,
    last_state: section.last_state,
    last_metadata: section.last_metadata || {},
    first_seen_at: section.first_seen_at,
    last_seen_at: section.last_seen_at,
  }));
}

function buildSourceRows(telemetry, installId) {
  return Object.values(normalizeTelemetry(telemetry).sources).map((source) => ({
    install_id: installId,
    section_key: source.section_key,
    source_key: source.source_key,
    source_label: source.source_label,
    source_group: source.source_group,
    launch_count: source.launch_count,
    seen_count: source.seen_count,
    last_title: source.last_title,
    last_state: source.last_state,
    last_metadata: source.last_metadata || {},
    first_seen_at: source.first_seen_at,
    last_seen_at: source.last_seen_at,
  }));
}

module.exports = {
  createEmptyTelemetry,
  normalizeTelemetry,
  recordLaunch,
  recordActivity,
  recordMusic,
  recordGame,
  recordCoding,
  summarizeForInstall,
  buildSectionRows,
  buildSourceRows,
};
