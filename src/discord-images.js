/**
 * Discord Rich Presence + UI image resolution.
 * API-sourced SFW anime only (nekos.best, waifu.pics, Tenor fallbacks).
 * No copyrighted character assets are bundled — media comes from public APIs.
 */

const FETCH_TIMEOUT_MS = 6000;
const DISCORD_IMAGE_MAX_LEN = 512;

/** Per-category API config — nekos GIF endpoint + waifu still fallback */
export const CATEGORY_SOURCES = {
  food: { nekos: 'nom', waifu: 'neko' },
  gaming: { nekos: 'yeet', waifu: 'shinobu' },
  chill: { nekos: 'sleep', waifu: 'megumin' },
  work: { nekos: 'bored', waifu: 'awoo' },
  social: { nekos: 'wave', waifu: 'cry' },
};

/** Legacy alias */
export const NEKOS_ENDPOINTS = Object.fromEntries(
  Object.entries(CATEGORY_SOURCES).map(([k, v]) => [k, v.nekos])
);

/** Per-activity nekos.best overrides (when not set on activity object) */
export const ACTIVITY_NEKOS_ENDPOINTS = {
  'eating-pizza': 'feed',
  'eating-sushi': 'nom',
  'eating-ramen': 'feed',
  'eating-burger': 'bite',
  'eating-tacos': 'nom',
  'eating-snacks': 'nom',
  'cooking': 'feed',
  'eating-dessert': 'bite',
  gaming: 'yeet',
  ranked: 'kick',
  coop: 'hug',
  retro: 'dance',
  speedrun: 'run',
  'vr-gaming': 'dance',
  sleeping: 'sleep',
  napping: 'sleep',
  reading: 'smile',
  listening: 'dance',
  meditating: 'cuddle',
  bath: 'happy',
  coding: 'bored',
  studying: 'bored',
  meeting: 'wave',
  focus: 'pat',
  designing: 'smile',
  writing: 'wink',
  streaming: 'wave',
  watching: 'happy',
  traveling: 'run',
  gym: 'kick',
  partying: 'dance',
  shopping: 'happy',
};

/**
 * Verified direct HTTPS GIF URLs — used when live APIs fail.
 * Prefer nekos.best permalinks; Tenor links are UI-only tertiary fallbacks.
 */
export const VERIFIED_FALLBACKS = {
  food: 'https://nekos.best/api/v2/nom/0d6e98ff-6a91-4d5d-b3cd-ede275f78f71.gif',
  gaming: 'https://nekos.best/api/v2/yeet/bd0af6f9-aabe-4d69-a467-4727ee6ebee0.gif',
  chill: 'https://nekos.best/api/v2/sleep/1d1824d2-eb00-4fa2-a56b-3aaf7edcc319.gif',
  work: 'https://nekos.best/api/v2/bored/50930205-bb33-405e-84fd-c8d58c27e8a9.gif',
  social: 'https://nekos.best/api/v2/wave/810920bc-280c-42f3-ade8-33a780484af0.gif',
  'eating-pizza': 'https://nekos.best/api/v2/feed/e480b6f8-aa99-4f36-b112-7bda61bf4ab8.gif',
  'eating-sushi': 'https://nekos.best/api/v2/nom/0d6e98ff-6a91-4d5d-b3cd-ede275f78f71.gif',
  'eating-ramen': 'https://nekos.best/api/v2/feed/e480b6f8-aa99-4f36-b112-7bda61bf4ab8.gif',
  'eating-burger': 'https://nekos.best/api/v2/bite/cdff6f6e-5bdf-47ce-9d54-01c9bcdebb3c.gif',
  'eating-tacos': 'https://nekos.best/api/v2/nom/0d6e98ff-6a91-4d5d-b3cd-ede275f78f71.gif',
  'eating-snacks': 'https://nekos.best/api/v2/nom/0d6e98ff-6a91-4d5d-b3cd-ede275f78f71.gif',
  cooking: 'https://nekos.best/api/v2/feed/e480b6f8-aa99-4f36-b112-7bda61bf4ab8.gif',
  'eating-dessert': 'https://nekos.best/api/v2/bite/cdff6f6e-5bdf-47ce-9d54-01c9bcdebb3c.gif',
  ranked: 'https://nekos.best/api/v2/kick/273cf4c2-4546-47b7-847c-0cc3cd887af4.gif',
  coop: 'https://nekos.best/api/v2/hug/a393a6e2-eb56-4ca2-b3bc-8c5d7978c0ce.gif',
  retro: 'https://nekos.best/api/v2/dance/2fa17d31-404a-4d50-b092-4448d403a59e.gif',
  speedrun: 'https://nekos.best/api/v2/run/e13cc2bc-5826-41e2-8093-732a59bd39d1.gif',
  'vr-gaming': 'https://nekos.best/api/v2/dance/2fa17d31-404a-4d50-b092-4448d403a59e.gif',
  sleeping: 'https://nekos.best/api/v2/sleep/1d1824d2-eb00-4fa2-a56b-3aaf7edcc319.gif',
  napping: 'https://nekos.best/api/v2/sleep/1d1824d2-eb00-4fa2-a56b-3aaf7edcc319.gif',
  reading: 'https://nekos.best/api/v2/smile/f2dc0289-303a-44fa-9ad9-de84f20802c1.gif',
  listening: 'https://nekos.best/api/v2/dance/2fa17d31-404a-4d50-b092-4448d403a59e.gif',
  meditating: 'https://nekos.best/api/v2/cuddle/e7e003a0-f6a2-4bed-84c8-66eb730a2abd.gif',
  bath: 'https://nekos.best/api/v2/happy/690a874e-0a3f-4d8e-ab3e-e0b6e82c993a.gif',
  coding: 'https://nekos.best/api/v2/bored/50930205-bb33-405e-84fd-c8d58c27e8a9.gif',
  studying: 'https://nekos.best/api/v2/bored/50930205-bb33-405e-84fd-c8d58c27e8a9.gif',
  meeting: 'https://nekos.best/api/v2/wave/810920bc-280c-42f3-ade8-33a780484af0.gif',
  focus: 'https://nekos.best/api/v2/pat/269cbfec-e1da-44f5-9817-a80b4a89a0ac.gif',
  designing: 'https://nekos.best/api/v2/smile/f2dc0289-303a-44fa-9ad9-de84f20802c1.gif',
  writing: 'https://nekos.best/api/v2/wink/645e5e46-bc92-4edf-a880-8708f1c079d7.gif',
  streaming: 'https://nekos.best/api/v2/wave/810920bc-280c-42f3-ade8-33a780484af0.gif',
  watching: 'https://nekos.best/api/v2/happy/690a874e-0a3f-4d8e-ab3e-e0b6e82c993a.gif',
  traveling: 'https://nekos.best/api/v2/run/e13cc2bc-5826-41e2-8093-732a59bd39d1.gif',
  gym: 'https://nekos.best/api/v2/kick/273cf4c2-4546-47b7-847c-0cc3cd887af4.gif',
  partying: 'https://nekos.best/api/v2/dance/2fa17d31-404a-4d50-b092-4448d403a59e.gif',
  shopping: 'https://nekos.best/api/v2/happy/690a874e-0a3f-4d8e-ab3e-e0b6e82c993a.gif',
};

/** Session cache — same activity keeps the same resolved image until app restart */
const sessionImageCache = new Map();

export function clearActivityImageCache() {
  sessionImageCache.clear();
}

export function clearActivityImageCacheEntry(activityId) {
  if (activityId) sessionImageCache.delete(activityId);
}

export function isValidDiscordImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!/^https:\/\//i.test(url)) return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  return url.length <= DISCORD_IMAGE_MAX_LEN;
}

function uniqueUrls(urls) {
  const seen = new Set();
  return urls.filter((url) => {
    if (!isValidDiscordImageUrl(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
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

function getCategorySources(category) {
  return CATEGORY_SOURCES[category] || CATEGORY_SOURCES.food;
}

function getNekosEndpoint(activity) {
  if (activity.nekosEndpoint) return activity.nekosEndpoint;
  return ACTIVITY_NEKOS_ENDPOINTS[activity.id] || getCategorySources(activity.category).nekos || 'neko';
}

function getWaifuTag(activity) {
  if (activity.waifuTag) return activity.waifuTag;
  return getCategorySources(activity.category).waifu || null;
}

export function getVerifiedFallback(activity) {
  if (!activity) return VERIFIED_FALLBACKS.food;
  return (
    activity.fallbackGif ||
    VERIFIED_FALLBACKS[activity.id] ||
    VERIFIED_FALLBACKS[activity.category] ||
    VERIFIED_FALLBACKS.food
  );
}

/** Ordered HTTPS fallbacks for <img> onerror chains (nekos → Tenor). */
export function getActivityFallbackUrls(activity) {
  if (!activity) return [];
  return uniqueUrls([
    getVerifiedFallback(activity),
    activity.tenorFallback,
    VERIFIED_FALLBACKS[activity.category],
    VERIFIED_FALLBACKS.food,
  ]);
}

function isValidCacheEntry(entry) {
  return entry && isValidDiscordImageUrl(entry.url) && isValidDiscordImageUrl(entry.discordUrl);
}

function readCache(activityId) {
  const cached = sessionImageCache.get(activityId);
  if (!cached) return null;
  if (!isValidCacheEntry(cached)) {
    sessionImageCache.delete(activityId);
    return null;
  }
  return cached;
}

function cacheResult(activityId, result) {
  if (!isValidCacheEntry(result)) return result;
  sessionImageCache.set(activityId, result);
  return result;
}

/**
 * Resolve image for UI preview and Discord RPC.
 * @returns {Promise<{ url: string, discordUrl: string, source: string, fallbacks: string[] }>}
 */
export async function resolveDiscordImageUrl(
  activity,
  { animationsEnabled = true, customDataUrl = null } = {}
) {
  const verified = getVerifiedFallback(activity);
  const fallbacks = getActivityFallbackUrls(activity);

  if (customDataUrl) {
    return {
      url: customDataUrl,
      discordUrl: verified,
      source: 'Custom (Discord uses activity GIF)',
      fallbacks,
    };
  }

  if (animationsEnabled === false) {
    return { url: verified, discordUrl: verified, source: 'nekos.best · cached', fallbacks };
  }

  const cached = readCache(activity.id);
  if (cached) return { ...cached, fallbacks };

  const nekosEndpoint = getNekosEndpoint(activity);
  const waifuTag = getWaifuTag(activity);
  const preferWaifu = activity.preferWaifu === true;

  if (preferWaifu && waifuTag) {
    const waifuUrl = await fetchWaifuImage(waifuTag);
    if (waifuUrl) {
      return cacheResult(activity.id, {
        url: waifuUrl,
        discordUrl: waifuUrl,
        source: `waifu.pics · ${waifuTag}`,
        fallbacks,
      });
    }
  }

  const nekosUrl = await fetchNekosBest(nekosEndpoint);
  if (nekosUrl) {
    return cacheResult(activity.id, {
      url: nekosUrl,
      discordUrl: nekosUrl,
      source: `nekos.best · ${nekosEndpoint}`,
      fallbacks,
    });
  }

  const categoryNekos = getCategorySources(activity.category).nekos;
  if (categoryNekos && categoryNekos !== nekosEndpoint) {
    const categoryUrl = await fetchNekosBest(categoryNekos);
    if (categoryUrl) {
      return cacheResult(activity.id, {
        url: categoryUrl,
        discordUrl: categoryUrl,
        source: `nekos.best · ${categoryNekos}`,
        fallbacks,
      });
    }
  }

  if (waifuTag) {
    const waifuUrl = await fetchWaifuImage(waifuTag);
    if (waifuUrl) {
      return cacheResult(activity.id, {
        url: waifuUrl,
        discordUrl: waifuUrl,
        source: `waifu.pics · ${waifuTag}`,
        fallbacks,
      });
    }
  }

  const tenorUrl = activity.tenorFallback;
  if (isValidDiscordImageUrl(tenorUrl)) {
    return cacheResult(activity.id, {
      url: tenorUrl,
      discordUrl: verified,
      source: 'Tenor · fallback',
      fallbacks,
    });
  }

  return cacheResult(activity.id, {
    url: verified,
    discordUrl: verified,
    source: 'nekos.best · fallback',
    fallbacks,
  });
}

/** Alias kept for existing imports */
export const resolveActivityImage = resolveDiscordImageUrl;

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
