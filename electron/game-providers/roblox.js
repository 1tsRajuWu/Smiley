const ROBLOX_ART = 'https://images.rbxcdn.com/5348266ea6c5e5c58c58b8667b5d8d01.jpg';

function enrichRoblox(game) {
  const n = String(game?.processName || '').toLowerCase();
  if (!n.includes('roblox')) return null;

  let exp = String(game?.windowTitle || '').trim();
  if (/^roblox$/i.test(exp)) exp = '';
  else {
    exp = exp.replace(/^roblox\s*[-–|]\s*/i, '').replace(/\s*[-–|]\s*roblox$/i, '').trim();
  }

  return {
    provider: 'roblox',
    title: 'Roblox',
    experience: exp || null,
    server: exp || null,
    inGame: true,
    inMatch: !!exp,
    launcher: 'Roblox',
    artworkUrl: ROBLOX_ART,
    updatedAt: Date.now(),
  };
}

module.exports = { enrichRoblox };
