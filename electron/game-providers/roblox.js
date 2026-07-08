const { GAME_LOGOS } = require('../game-assets');

function enrichRoblox(game) {
  const n = String(game?.processName || '').toLowerCase();
  if (!n.includes('roblox')) return null;

  let exp = String(game?.windowTitle || '').trim();
  if (/^roblox$/i.test(exp)) exp = '';
  else {
    exp = exp.replace(/^roblox\s*[-–|]\s*/i, '').replace(/\s*[-–|]\s*roblox$/i, '').trim();
  }

  const inMatch = !!exp;

  return {
    provider: 'roblox',
    title: 'Roblox',
    experience: exp || null,
    server: exp || null,
    phase: inMatch ? 'match' : 'lobby',
    inGame: true,
    inMatch,
    inLobby: !inMatch,
    launcher: 'Roblox',
    artworkUrl: GAME_LOGOS.roblox,
    updatedAt: Date.now(),
  };
}

module.exports = { enrichRoblox };
