const FORTNITE_ART = 'https://cdn2.unrealengine.com/fortnite-chapter-5-lobby-background-1920x1080-1920x1080-f550d56711fa.jpg';

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

  return {
    provider: 'fortnite',
    title: 'Fortnite',
    mode,
    party,
    placement,
    inGame: true,
    inMatch: !!(mode || placement),
    launcher: 'Epic Games',
    artworkUrl: FORTNITE_ART,
    updatedAt: Date.now(),
  };
}

module.exports = { enrichFortnite };
