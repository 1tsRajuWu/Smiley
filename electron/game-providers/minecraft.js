const MINECRAFT_ART = 'https://www.minecraft.net/content/dam/games/minecraft/key-art/Games_Subnav_Minecraft-300x465.jpg';

function enrichMinecraft(game) {
  const title = String(game?.windowTitle || game?.title || '');
  if (!/minecraft/i.test(title) && !/minecraft/i.test(game?.processName || '')) return null;

  const mp = title.match(/multiplayer\s*\(([^)]+)\)/i);
  const server = mp?.[1]?.trim() || null;
  const playMode = title.toLowerCase().includes('singleplayer') ? 'Singleplayer'
    : (server ? 'Multiplayer' : 'Playing');
  const versionMatch = title.match(/Minecraft\s+([\d.]+(?:\s*\([^)]+\))?)/i);
  const version = versionMatch?.[1]?.trim() || null;

  return {
    provider: 'minecraft',
    title: 'Minecraft',
    server,
    playMode,
    version,
    inGame: true,
    inMatch: !!server,
    artworkUrl: MINECRAFT_ART,
    updatedAt: Date.now(),
  };
}

module.exports = { enrichMinecraft };
