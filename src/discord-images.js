/**
 * Discord Rich Presence image resolution.
 * Sources: nekos.best (SFW anime GIFs), waifu.pics (SFW stills) — community APIs;
 * user is responsible for how they use fetched media.
 */

const FETCH_TIMEOUT_MS = 6000;

/** nekos.best endpoint per category — returns animated GIFs */
export const NEKOS_ENDPOINTS = {
  food: 'nom',
  gaming: 'yeet',
  chill: 'sleep',
  work: 'bored',
  social: 'wave',
};

/** Per-activity nekos.best overrides (cute eating, coding, etc.) */
export const ACTIVITY_NEKOS_ENDPOINTS = {
  'eating-pizza': 'feed',
  'eating-sushi': 'nom',
  'eating-ramen': 'feed',
  'eating-burger': 'nom',
  'eating-tacos': 'feed',
  'eating-snacks': 'nom',
  'cooking': 'feed',
  'eating-dessert': 'nom',
  'gaming': 'yeet',
  'ranked': 'yeet',
  'coop': 'hug',
  'coding': 'bored',
  'studying': 'bored',
  'meeting': 'wave',
  'sleeping': 'sleep',
  'napping': 'sleep',
  'listening': 'dance',
  'streaming': 'wave',
  'gym': 'yeet',
};

/**
 * Verified direct HTTPS URLs (nekos.best GIFs) — used when APIs fail.
 * Tenor links in the old codebase returned 404 and caused Discord's ? placeholder.
 */
export const VERIFIED_FALLBACKS = {
  food: 'https://nekos.best/api/v2/nom/eaa199e9-2b86-4b15-87d1-53688e36d8ec.gif',
  gaming: 'https://nekos.best/api/v2/yeet/ae4dda45-2175-4576-b957-58dcc1362284.gif',
  chill: 'https://nekos.best/api/v2/sleep/611a318f-1645-48f4-9cc0-099eb8d817d9.gif',
  work: 'https://nekos.best/api/v2/bored/82f8fec0-d651-4905-a739-5917d728f89f.gif',
  social: 'https://nekos.best/api/v2/wave/e6f276a8-11f1-4ad0-b1e0-3fa91678e2f4.gif',
  'eating-pizza': 'https://nekos.best/api/v2/feed/b9abbae0-3b59-437e-b866-3402c2c7f22e.gif',
  coding: 'https://nekos.best/api/v2/bored/82f8fec0-d651-4905-a739-5917d728f89f.gif',
};

export function isValidDiscordImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!/^https:\/\//i.test(url)) return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  return url.length <= 300;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** nekos.best — free SFW anime GIF API */
export async function fetchNekosBest(endpoint) {
  if (!endpoint) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const data = await fetchJson(`https://nekos.best/api/v2/${endpoint}`, controller.signal);
    clearTimeout(timeout);
    const url = data?.results?.[0]?.url;
    return isValidDiscordImageUrl(url) ? url : null;
  } catch {
    return null;
  }
}

/** waifu.pics — free SFW anime image API */
export async function fetchWaifuImage(tag) {
  if (!tag) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const data = await fetchJson(`https://api.waifu.pics/sfw/${tag}`, controller.signal);
    clearTimeout(timeout);
    const url = data?.url;
    return isValidDiscordImageUrl(url) ? url : null;
  } catch {
    return null;
  }
}

function getNekosEndpoint(activity) {
  return ACTIVITY_NEKOS_ENDPOINTS[activity.id] || NEKOS_ENDPOINTS[activity.category] || 'neko';
}

function getVerifiedFallback(activity) {
  return (
    VERIFIED_FALLBACKS[activity.id] ||
    VERIFIED_FALLBACKS[activity.category] ||
    VERIFIED_FALLBACKS.food
  );
}

/**
 * Resolve image for UI preview and Discord RPC.
 * @returns {{ url: string|null, discordUrl: string, source: string }}
 */
export async function resolveActivityImage(activity, { animationsEnabled = true, customDataUrl = null } = {}) {
  const verified = getVerifiedFallback(activity);

  if (customDataUrl) {
    return {
      url: customDataUrl,
      discordUrl: verified,
      source: 'Custom (Discord uses category GIF)',
    };
  }

  if (animationsEnabled === false) {
    return { url: verified, discordUrl: verified, source: 'nekos.best · cached' };
  }

  const nekosEndpoint = getNekosEndpoint(activity);

  const nekosUrl = await fetchNekosBest(nekosEndpoint);
  if (nekosUrl) {
    return { url: nekosUrl, discordUrl: nekosUrl, source: `nekos.best · ${nekosEndpoint}` };
  }

  if (activity.waifuTag) {
    const waifuUrl = await fetchWaifuImage(activity.waifuTag);
    if (waifuUrl) {
      return { url: waifuUrl, discordUrl: waifuUrl, source: `waifu.pics · ${activity.waifuTag}` };
    }
  }

  return { url: verified, discordUrl: verified, source: 'nekos.best · fallback' };
}

/** Build fields for Discord RPC payload */
export function discordImageFields(activity, discordUrl) {
  const url = isValidDiscordImageUrl(discordUrl) ? discordUrl : getVerifiedFallback(activity);
  return {
    largeImageUrl: url,
    discordImageUrl: url,
    fallbackGif: url,
    largeImageText: activity.largeImageText || activity.details,
  };
}
