function enrichRoblox(game) {
  const n = String(game?.processName || '').toLowerCase();
  if (!n.includes('roblox')) return null;
  let exp = String(game?.windowTitle || '').trim();
  if (/^roblox$/i.test(exp)) exp = '';
  else exp = exp.replace(/^roblox\s*[-–|]\s*/i, '').replace(/\s*[-–|]\s*roblox$/i, '').trim();
  return {
    provider: 'roblox',
    title: exp ? `Roblox · ${exp}` : 'Roblox',
    server: exp || null,
    liveLine: exp || 'Playing',
    inGame: true, inMatch: !!exp, launcher: 'Roblox', updatedAt: Date.now(),
  };
}

module.exports = { enrichRoblox };
