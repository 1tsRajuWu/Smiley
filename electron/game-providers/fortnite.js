function enrichFortnite(game) {
  const n = String(game?.processName || '').toLowerCase();
  const t = String(game?.windowTitle || game?.title || '');
  if (!n.includes('fortnite') && !/fortnite/i.test(t)) return null;
  let mode = null;
  if (/battle royale/i.test(t)) mode = 'Battle Royale';
  else if (/zero build/i.test(t)) mode = 'Zero Build';
  else if (/creative/i.test(t)) mode = 'Creative';
  return {
    provider: 'fortnite', title: 'Fortnite',
    liveLine: mode || 'Playing', mode, inGame: true, inMatch: !!mode,
    launcher: 'Epic Games', updatedAt: Date.now(),
  };
}

module.exports = { enrichFortnite };
