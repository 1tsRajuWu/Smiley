// Steam Store search — cover art + tags (cached 6h)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

async function lookupSteamMetadata(term) {
  const key = String(term || '').trim().toLowerCase();
  if (!key) return null;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  try {
    const q = encodeURIComponent(key);
    const res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${q}&l=english&cc=US`);
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.find((e) => e?.type === 'app' && e?.name);
    if (!item) return null;
    const meta = {
      name: item.name,
      steamAppId: Number(item.id) || null,
      metascore: item.metascore ? String(item.metascore) : null,
      tags: (item.tags || []).map((t) => t?.name || t).filter(Boolean).slice(0, 3),
      artworkUrl: Number(item.id)
        ? `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/header.jpg`
        : null,
    };
    cache.set(key, { at: Date.now(), data: meta });
    return meta;
  } catch {
    return null;
  }
}

module.exports = { lookupSteamMetadata };
