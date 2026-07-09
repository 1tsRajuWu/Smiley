const { GAME_LOGOS } = require('../game-assets');

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
  const inMatch = !!(mode || scoreHint);

  return {
    provider: 'overwatch',
    title: 'Overwatch 2',
    map,
    mode,
    scoreHint,
    phase: inMatch ? 'match' : 'lobby',
    inGame: true,
    inMatch,
    inLobby: !inMatch,
    launcher: 'Battle.net',
    artworkUrl: GAME_LOGOS.overwatch,
    updatedAt: Date.now(),
  };
}

module.exports = { enrichOverwatch };
