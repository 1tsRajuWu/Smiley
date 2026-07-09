const { GAME_LOGOS } = require('../game-assets');

function enrichMinecraft(game) {
  const title = String(game?.windowTitle || game?.title || '');
  if (!/minecraft/i.test(title) && !/minecraft/i.test(game?.processName || '')) return null;

  const mp = title.match(/multiplayer\s*\(([^)]+)\)/i);
  const server = mp?.[1]?.trim() || null;
  const playMode = title.toLowerCase().includes('singleplayer') ? 'Singleplayer'
    : (server ? 'Multiplayer' : 'Playing');
  const versionMatch = title.match(/Minecraft\s+([\d.]+(?:\s*\([^)]+\))?)/i);
  const version = versionMatch?.[1]?.trim() || null;
  const inMatch = !!server || /singleplayer/i.test(title);

  return {
    provider: 'minecraft',
    title: 'Minecraft',
    server,
    playMode,
    version,
    phase: inMatch ? 'match' : 'lobby',
    inGame: true,
    inMatch,
    inLobby: !inMatch,
    artworkUrl: GAME_LOGOS.minecraft,
    updatedAt: Date.now(),
  };
}

module.exports = { enrichMinecraft };
