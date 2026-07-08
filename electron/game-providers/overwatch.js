function enrichOverwatch(game) {
  const n = String(game?.processName || '').toLowerCase();
  const t = String(game?.windowTitle || game?.title || '');
  if (!n.includes('overwatch') && !/overwatch/i.test(t)) return null;
  let mode = null;
  if (/competitive/i.test(t)) mode = 'Competitive';
  else if (/quick play/i.test(t)) mode = 'Quick Play';
  return {
    provider: 'overwatch', title: 'Overwatch 2',
    liveLine: mode || 'Playing', mode, inGame: true, inMatch: !!mode,
    launcher: 'Battle.net', updatedAt: Date.now(),
  };
}

module.exports = { enrichOverwatch };
