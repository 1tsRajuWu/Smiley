const { GAME_LOGOS } = require('../game-assets');

function parseParty(t) {
  if (/\bsolo\b/i.test(t)) return 'Solo';
  if (/\bduo\b/i.test(t)) return 'Duo';
  if (/\btrio\b/i.test(t)) return 'Trio';
  if (/\bsquad\b/i.test(t)) return 'Squad';
  return null;
}

function parsePlacement(t) {
  const m = String(t || '').match(/#?\s*(\d{1,2})(?:st|nd|rd|th)?\s*(?:place|remaining|left)?/i)
    || String(t || '').match(/placed\s*#?\s*(\d{1,2})/i);
  return m ? Number(m[1]) : null;
}

function enrichFortnite(game) {
  const n = String(game?.processName || '').toLowerCase();
  const t = String(game?.windowTitle || game?.title || '');
  if (!n.includes('fortnite') && !/fortnite/i.test(t)) return null;

  let mode = null;
  if (/battle royale/i.test(t)) mode = 'Battle Royale';
  else if (/zero build/i.test(t)) mode = 'Zero Build';
  else if (/creative/i.test(t)) mode = 'Creative';
  else if (/save the world/i.test(t)) mode = 'Save the World';

  const party = parseParty(t);
  const placement = parsePlacement(t);
  const inMatch = !!(mode || placement);

  return {
    provider: 'fortnite',
    title: 'Fortnite',
    mode,
    party,
    placement,
    phase: inMatch ? 'match' : 'lobby',
    inGame: true,
    inMatch,
    inLobby: !inMatch,
    launcher: 'Epic Games',
    artworkUrl: GAME_LOGOS.fortnite,
    updatedAt: Date.now(),
  };
}

module.exports = { enrichFortnite };
