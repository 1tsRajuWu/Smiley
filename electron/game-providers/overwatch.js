const OW2_ART = 'https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440cf/blt77c4f0b6234b1b29/1683835839683/OW2_Launch_Key_Art.jpg';

function parseMap(t) {
  const m = String(t || '').match(/^([^|–-]+)\s*[|–-]\s*overwatch/i)
    || String(t || '').match(/overwatch\s*2?\s*[|–-]\s*([^|–-]+)/i);
  const candidate = m?.[1]?.trim();
  if (candidate && !/competitive|quick play|arcade/i.test(candidate)) return candidate;
  return null;
}

function parseScore(t) {
  const m = String(t || '').match(/(\d+)\s*[-:]\s*(\d+)/);
  return m ? `${m[1]}-${m[2]}` : null;
}

function enrichOverwatch(game) {
  const n = String(game?.processName || '').toLowerCase();
  const t = String(game?.windowTitle || game?.title || '');
  if (!n.includes('overwatch') && !/overwatch/i.test(t)) return null;

  let mode = null;
  if (/competitive/i.test(t)) mode = 'Competitive';
  else if (/quick play/i.test(t)) mode = 'Quick Play';
  else if (/arcade/i.test(t)) mode = 'Arcade';
  else if (/mystery heroes/i.test(t)) mode = 'Mystery Heroes';

  const map = parseMap(t);
  const scoreHint = parseScore(t);

  return {
    provider: 'overwatch',
    title: 'Overwatch 2',
    map,
    mode,
    scoreHint,
    inGame: true,
    inMatch: !!(mode || scoreHint),
    launcher: 'Battle.net',
    artworkUrl: OW2_ART,
    updatedAt: Date.now(),
  };
}

module.exports = { enrichOverwatch };
