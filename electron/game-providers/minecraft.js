function enrichMinecraft(game) {
  const title = String(game?.windowTitle || game?.title || '');
  if (!/minecraft/i.test(title) && !/minecraft/i.test(game?.processName || '')) return null;
  const mp = title.match(/multiplayer\s*\(([^)]+)\)/i);
  const liveLine = mp ? mp[1].trim() : (title.toLowerCase().includes('singleplayer') ? 'Singleplayer' : 'Playing');
  return {
    provider: 'minecraft', title: 'Minecraft', server: mp?.[1]?.trim() || null,
    liveLine, inGame: true, inMatch: !!mp, updatedAt: Date.now(),
  };
}

module.exports = { enrichMinecraft };
