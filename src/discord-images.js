/**
 * Discord Rich Presence + UI image resolution.
 * API-sourced SFW anime only (nekos.best, waifu.pics, Tenor fallbacks).
 * No copyrighted character assets are bundled — media comes from public APIs.
 */

const FETCH_TIMEOUT_MS = 6000;
const DISCORD_IMAGE_MAX_LEN = 512;
const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Smiley/3.2.0 (Discord Rich Presence)',
};

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

/** Per-activity nekos.best endpoint — must match activity meaning */
export const ACTIVITY_NEKOS_ENDPOINTS = {
  'eating-pizza': 'feed',
  'eating-sushi': 'nom',
  'eating-ramen': 'feed',
  'eating-burger': 'bite',
  'eating-tacos': 'nom',
  'eating-snacks': 'nom',
  cooking: 'feed',
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
  studying: 'pat',
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

/** Extra nekos endpoints to try when the primary is rate-limited */
export const ACTIVITY_NEKOS_ALTERNATES = {
  'eating-pizza': ['feed', 'nom'],
  'eating-sushi': ['nom', 'bite'],
  'eating-ramen': ['feed', 'nom'],
  'eating-burger': ['bite', 'nom'],
  'eating-tacos': ['nom', 'bite'],
  'eating-snacks': ['nom', 'feed'],
  cooking: ['feed', 'nom'],
  'eating-dessert': ['bite', 'nom'],
  gaming: ['yeet', 'dance'],
  ranked: ['kick', 'yeet'],
  coop: ['hug', 'wave'],
  retro: ['dance', 'yeet'],
  speedrun: ['run', 'kick'],
  'vr-gaming': ['dance', 'yeet'],
  sleeping: ['sleep'],
  napping: ['sleep'],
  reading: ['smile', 'wave'],
  listening: ['dance', 'happy'],
  meditating: ['cuddle', 'happy'],
  bath: ['happy', 'cuddle'],
  studying: ['pat', 'smile'],
  meeting: ['wave', 'smile'],
  focus: ['pat', 'smile'],
  designing: ['smile', 'wink'],
  writing: ['wink', 'smile'],
  streaming: ['wave', 'dance'],
  watching: ['happy', 'smile'],
  traveling: ['run', 'wave'],
  gym: ['kick', 'run'],
  partying: ['dance', 'happy'],
  shopping: ['happy', 'wave'],
};

/**
 * Verified direct HTTPS GIF URLs — used when live APIs fail.
 * Prefer nekos.best permalinks; Tenor links are curated tertiary fallbacks.
 */
export const VERIFIED_FALLBACKS = {
  food: 'https://nekos.best/api/v2/nom/0d6e98ff-6a91-4d5d-b3cd-ede275f78f71.gif',
  gaming: 'https://nekos.best/api/v2/yeet/bd0af6f9-aabe-4d69-a467-4727ee6ebee0.gif',
  chill: 'https://nekos.best/api/v2/sleep/1d1824d2-eb00-4fa2-a56b-3aaf7edcc319.gif',
  work: 'https://nekos.best/api/v2/pat/269cbfec-e1da-44f5-9817-a80b4a89a0ac.gif',
  social: 'https://nekos.best/api/v2/wave/810920bc-280c-42f3-ade8-33a780484af0.gif',
  'eating-pizza': 'https://nekos.best/api/v2/feed/b9abbae0-3b59-437e-b866-3402c2c7f22e.gif',
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
  studying: 'https://nekos.best/api/v2/pat/269cbfec-e1da-44f5-9817-a80b4a89a0ac.gif',
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

/** Curated SFW Tenor/Giphy GIFs per activity (user-provided + verified HTTP 200) */
export const ACTIVITY_TENOR_FALLBACKS = {
  'eating-pizza': 'https://media1.tenor.com/m/i-xS-A_DTCEAAAAC/pizza-food.gif',
  'eating-sushi': 'https://media.tenor.com/KE361QFenNcAAAAM/anime-refei%C3%A7%C3%A3o-jap%C3%A3o-comida.gif',
  'eating-ramen': 'https://media1.tenor.com/m/nwM1UzOjtAoAAAAC/anime-naruto.gif',
  'eating-burger':
    'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYXd4Y3ZlODF5NjI4aG9qanB0YjV5YzQ3Z2ZwNDgweW9rZjFzbGY3diZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/aW9HiiooRmdwdG0bPc/giphy.gif',
  'eating-tacos': 'https://media1.tenor.com/m/tz1kb3yen6wAAAAC/uwu-taco.gif',
  'eating-snacks': 'https://media1.tenor.com/m/DtK1un8uLS0AAAAC/himouto-umaru-chan.gif',
  cooking:
    'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExN3VlZXQyeWQ0MnRhOXlyYnpscjYzYXJ1OTg5djEzcXphZjM0cnY2cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/p0dFF6nzn1DZKKyNdo/giphy.gif',
  'eating-dessert': 'https://media1.tenor.com/m/DQDtfEaDA5AAAAAC/cake-eat.gif',
  gaming: 'https://media1.tenor.com/m/9tbKJeCFPaUAAAAC/konata-gaming.gif',
  ranked: 'https://media1.tenor.com/m/IwyNIipPItQAAAAC/anime-naruto.gif',
  coop: 'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTNsbWV1ZzV6Yzk1eHFsYWtlbmZqMTB6NjkxNnVhZWxybjc3cTFxMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/qCr3LLomOJUfGUYOZx/giphy.gif',
  retro: 'https://media1.tenor.com/m/pqzUICCf7XYAAAAC/potz-power.gif',
  speedrun: 'https://media1.tenor.com/m/NazVGclCYHEAAAAC/agnes-tachyon-tachyon.gif',
  'vr-gaming': 'https://media1.tenor.com/m/hvmj5kz64Q4AAAAC/boxing-oculus.gif',
  sleeping: 'https://media1.tenor.com/m/lptw_sFe1DYAAAAC/sleep-anime.gif',
  napping: 'https://media1.tenor.com/m/y-nFVMnj_g4AAAAC/d4dj-d4dj-petit-mix.gif',
  reading: 'https://media.tenor.com/rJxGy9CYwHoAAAAM/anime-read.gif',
  listening: 'https://media1.tenor.com/m/FhCrIhUtPmoAAAAC/headphones-listening-to-music.gif',
  meditating: 'https://media1.tenor.com/m/hnlwW6KsH1sAAAAC/kanna-kamui.gif',
  bath: 'https://media1.tenor.com/m/hnlz1koTh6gAAAAC/ba12.gif',
  studying:
    'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExeTI1dmpjNDZ6bGJpd2s0OWg2ZThtaGk3ZGNka2x4a3Rrb3kxMWZsaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/6XX4V0O8a0xdS/giphy.gif',
  meeting:
    'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExOG9oaWNyZnRnY3pwa3ZudXE3cXlsam42c203dm0wdXJ4YnVqa2E2OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WyZ1D8gXF7QQsRkXw5/giphy.gif',
  focus: 'https://media1.tenor.com/m/t8rp6pY-Wl8AAAAC/typing-anime-coding.gif',
  designing: 'https://media.tenor.com/zoWI1vGHkecAAAAM/good-morning-marin-kitagawa.gif',
  writing: 'https://media1.tenor.com/m/EL7zfInn_vsAAAAC/taking-notes-noting.gif',
  streaming:
    'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcXpueTE0dHJuMHU2ZWcycG1ocXNmYXkxMWp4cnBuMzJubHJxZjJxNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2Y7tZMmIpwV6Lnc5QC/giphy.gif',
  watching:
    'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWNlcHU0bnF3ODFvZXN4d3V3MjYzbXh3cmt5djg2dThsbmt3dTM2aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/p55iGp1XppSv4WiV2y/giphy.gif',
  traveling:
    'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeW53NGliMGVmMDB0N3l2eXd4MngybHFzbmI1eG94Z3dqZ3QwbGJiYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o6YfXCRvjzATblkJy/giphy.gif',
  gym: 'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWZhanI0aDI0eHlnYW54eWo5amVpM3V5aTdhenp6eWVnNmtyemxveCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ZJ25E2hJ5IpfvgkxYE/giphy.gif',
  partying: 'https://media1.tenor.com/m/uRlxzRNgp2MAAAAC/anime-girl.gif',
  shopping:
    'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjN3aXA4N3BzcnUxMXI3bHk3ZmgwMWdkb2h0N3R4d2lmdHBwbzdidiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WgRsfKIC2WbJDpyLB7/giphy.gif',
};

/** Session cache — keyed by activity.id */
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
    headers: FETCH_HEADERS,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function getNekosEndpoints(activity) {
  const primary = activity.nekosEndpoint || ACTIVITY_NEKOS_ENDPOINTS[activity.id];
  const alternates = ACTIVITY_NEKOS_ALTERNATES[activity.id] || [];
  const category = getCategorySources(activity.category).nekos;
  const seen = new Set();
  return [primary, ...alternates, category].filter((ep) => {
    if (!ep || seen.has(ep)) return false;
    seen.add(ep);
    return true;
  });
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

/** Try multiple nekos endpoints until one succeeds */
export async function fetchNekosWithRetry(endpoints) {
  for (const endpoint of endpoints) {
    const url = await fetchNekosBest(endpoint);
    if (url) return { url, endpoint };
  }
  return null;
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

function getWaifuTag(activity) {
  if (activity.waifuTag) return activity.waifuTag;
  return getCategorySources(activity.category).waifu || null;
}

export function getTenorFallback(activity) {
  if (!activity) return null;
  return activity.tenorFallback || ACTIVITY_TENOR_FALLBACKS[activity.id] || null;
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

/** Ordered HTTPS fallbacks for <img> onerror chains */
export function getActivityFallbackUrls(activity) {
  if (!activity) return [];
  const verified = getVerifiedFallback(activity);
  const tenor = getTenorFallback(activity);
  return uniqueUrls([
    verified,
    tenor,
    VERIFIED_FALLBACKS[activity.category],
    VERIFIED_FALLBACKS.food,
  ]);
}

function isPreviewImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (isValidDiscordImageUrl(url)) return true;
  return /^file:\/\//i.test(url) || url.startsWith('data:');
}

function isValidCacheEntry(entry, activityId) {
  return (
    entry &&
    entry.activityId === activityId &&
    isPreviewImageUrl(entry.url) &&
    (entry.discordUrl == null || isValidDiscordImageUrl(entry.discordUrl))
  );
}

function readCache(activityId) {
  const cached = sessionImageCache.get(activityId);
  if (!cached) return null;
  if (!isValidCacheEntry(cached, activityId)) {
    sessionImageCache.delete(activityId);
    return null;
  }
  return cached;
}

function cacheResult(activityId, result) {
  const entry = { ...result, activityId };
  if (!isValidCacheEntry(entry, activityId)) return result;
  sessionImageCache.set(activityId, entry);
  return entry;
}

function buildResult(activityId, { url, discordUrl, source, fallbacks }) {
  return { url, discordUrl, source, fallbacks, activityId };
}

/**
 * Resolve image for UI preview and Discord RPC.
 * @returns {Promise<{ url: string, discordUrl: string, source: string, fallbacks: string[], activityId: string }>}
 */
export async function resolveDiscordImageUrl(
  activity,
  { animationsEnabled = true, customDataUrl = null, bustCache = false } = {}
) {
  const verified = getVerifiedFallback(activity);
  const tenor = getTenorFallback(activity);
  const fallbacks = getActivityFallbackUrls(activity);

  if (!activity?.id) {
    return buildResult(null, {
      url: verified,
      discordUrl: verified,
      source: 'nekos.best · fallback',
      fallbacks,
    });
  }

  if (bustCache) clearActivityImageCacheEntry(activity.id);

  if (activity.isCustom || activity.category === 'custom') {
    const cached = readCache(activity.id);
    if (cached) return { ...cached, fallbacks: cached.fallbacks || [] };

    const discord = isValidDiscordImageUrl(activity.gifUrl) ? activity.gifUrl : null;
    const local = activity.localGifPath || activity.previewUrl || null;
    const preview = discord || local;
    const result = buildResult(activity.id, {
      url: preview,
      discordUrl: discord,
      source: discord
        ? 'Custom GIF'
        : preview
          ? 'Custom · preview only (add URL for Discord)'
          : 'Custom',
      fallbacks: uniqueUrls([local, discord].filter((u) => u && u !== preview)),
    });
    if (preview || discord) return cacheResult(activity.id, result);
    return result;
  }

  if (customDataUrl) {
    return buildResult(activity.id, {
      url: customDataUrl,
      discordUrl: verified,
      source: 'Custom (Discord uses activity GIF)',
      fallbacks,
    });
  }

  if (animationsEnabled === false) {
    const still = tenor || verified;
    return buildResult(activity.id, {
      url: still,
      discordUrl: still,
      source: 'Static fallback',
      fallbacks,
    });
  }

  const cached = readCache(activity.id);
  if (cached) return { ...cached, fallbacks };

  // Curated GIF — same URL in app preview and Discord (skip random API rotation)
  if (isValidDiscordImageUrl(tenor)) {
    return cacheResult(
      activity.id,
      buildResult(activity.id, {
        url: tenor,
        discordUrl: tenor,
        source: 'Curated GIF',
        fallbacks,
      })
    );
  }

  const waifuTag = getWaifuTag(activity);
  const nekosEndpoints = getNekosEndpoints(activity);

  const nekosResult = await fetchNekosWithRetry(nekosEndpoints);
  if (nekosResult) {
    return cacheResult(
      activity.id,
      buildResult(activity.id, {
        url: nekosResult.url,
        discordUrl: nekosResult.url,
        source: `nekos.best · ${nekosResult.endpoint}`,
        fallbacks,
      })
    );
  }

  if (waifuTag) {
    const waifuUrl = await fetchWaifuImage(waifuTag);
    if (waifuUrl) {
      return cacheResult(
        activity.id,
        buildResult(activity.id, {
          url: waifuUrl,
          discordUrl: waifuUrl,
          source: `waifu.pics · ${waifuTag}`,
          fallbacks,
        })
      );
    }
  }

  return cacheResult(
    activity.id,
    buildResult(activity.id, {
      url: verified,
      discordUrl: verified,
      source: 'nekos.best · fallback',
      fallbacks,
    })
  );
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
