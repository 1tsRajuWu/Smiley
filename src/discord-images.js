/**
 * Discord Rich Presence + UI image resolution.
 * API-sourced SFW anime only (nekos.best, waifu.pics, Tenor fallbacks).
 * No copyrighted character assets are bundled — media comes from public APIs.
 */

const FETCH_TIMEOUT_MS = 6000;
const DISCORD_IMAGE_MAX_LEN = 512;
const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Smiley/4.0.1 (Discord Rich Presence)',
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

/** Curated SFW Tenor GIFs per activity (media.tenor.com — verified HTTP 200) */
export const ACTIVITY_TENOR_FALLBACKS = {
  'eating-pizza': 'https://media.tenor.com/i-xS-A_DTCEAAAAM/pizza-food.gif',
  'eating-sushi': 'https://media.tenor.com/KE361QFenNcAAAAM/anime-refei%C3%A7%C3%A3o-jap%C3%A3o-comida.gif',
  'eating-ramen': 'https://media.tenor.com/3hCp28Y4JcUAAAAM/hungry-ramen.gif',
  'eating-burger': 'https://media.tenor.com/uk9xO0xpWoIAAAAM/burger-eating.gif',
  'eating-tacos': 'https://media.tenor.com/tz1kb3yen6wAAAAM/uwu-taco.gif',
  'eating-snacks': 'https://media.tenor.com/gBrP7QayoRkAAAAM/himouto-umaru-chan.gif',
  cooking: 'https://media.tenor.com/flX5arjPeDcAAAAM/sora-cooking.gif',
  'eating-dessert': 'https://media.tenor.com/DTRz6D1e5ZEAAAAM/eating-dessert-happily.gif',
  gaming: 'https://media.tenor.com/9tbKJeCFPaUAAAAd/konata-gaming.gif',
  ranked: 'https://media.tenor.com/o52AZQZ_PloAAAAM/kick-anime.gif',
  coop: 'https://media.tenor.com/ZIlcnod9hnkAAAAM/anime-anime-hug.gif',
  retro: 'https://media.tenor.com/TxflfpxQNgcAAAAM/happy-dance.gif',
  speedrun: 'https://media.tenor.com/mUIXigPWPuYAAAAM/anime-anime-girl-running.gif',
  'vr-gaming': 'https://media.tenor.com/qIvEeou-1FIAAAAM/play-network-anime-girl.gif',
  sleeping: 'https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif',
  napping: 'https://media.tenor.com/aeDeYPV8t1IAAAAM/sleepy-sleep.gif',
  reading: 'https://media.tenor.com/rJxGy9CYwHoAAAAM/anime-read.gif',
  listening: 'https://media.tenor.com/dN976uhxB0kAAAAM/aimoto-rinku-listening-to-music.gif',
  meditating: 'https://media.tenor.com/H2TduYuD5S0AAAAM/anime-miss-kobayashis-dragon-maid.gif',
  bath: 'https://media.tenor.com/M3nkdB81tkQAAAAM/virgin-road-anime-relaxed.gif',
  studying: 'https://media.tenor.com/etfl8OlhPIYAAAAM/studying-anime-girl.gif',
  meeting: 'https://media.tenor.com/_9W9bVa4AHgAAAAM/wavi-anime.gif',
  focus: 'https://media.tenor.com/qhe3ahMJ_i0AAAAM/anime-anime-pat.gif',
  designing: 'https://media.tenor.com/zoWI1vGHkecAAAAM/good-morning-marin-kitagawa.gif',
  writing: 'https://media.tenor.com/cwOI3DtZRzgAAAAM/anya-forger-taking-notes.gif',
  streaming: 'https://media.tenor.com/HZLV0wdcQ4IAAAAd/love-live-female-singer.gif',
  watching: 'https://media.tenor.com/P8jCycbR6k8AAAAM/yosuke-tickets.gif',
  traveling: 'https://media.tenor.com/gPjII19ICdIAAAAM/road-road-trip-move-dragon-ball-anime-tyan-vibe-car.gif',
  gym: 'https://media.tenor.com/0weeqPoyCWIAAAAM/how-heavy-are-the-dumbbells-that-you-lift-dumbbell-nan-kilo-moteru.gif',
  partying: 'https://media.tenor.com/ymPYRZ4YGbEAAAAM/partyhard-party.gif',
  shopping: 'https://media.tenor.com/9M34adQOtNwAAAAM/shopping-hi.gif',
};

/** Per-activity GIF picker options — first entry matches ACTIVITY_TENOR_FALLBACKS default */
export const ACTIVITY_GIF_OPTIONS = {
  sleeping: [
    { id: 'sleep-1', label: 'Sleepy Sleep', url: 'https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif' },
    { id: 'sleep-2', label: 'D4DJ Sleepy', url: 'https://media.tenor.com/6OCEdkhjHKUAAAAM/d4dj-first-mix-d4dj.gif' },
    { id: 'sleep-3', label: 'Nekos Sleep', url: 'https://nekos.best/api/v2/sleep/1d1824d2-eb00-4fa2-a56b-3aaf7edcc319.gif' },
    { id: 'sleep-4', label: 'Mocha Bear', url: 'https://media.tenor.com/OZdXkNd2o-IAAAAM/mocha-and-milk-mocha-bear.gif' },
  ],
  napping: [
    { id: 'nap-1', label: 'Power Nap', url: 'https://media.tenor.com/aeDeYPV8t1IAAAAM/sleepy-sleep.gif' },
    { id: 'nap-2', label: 'Benjammins', url: 'https://media.tenor.com/P4iukwlv4LIAAAAM/benjammins-ben-jammins.gif' },
    { id: 'nap-3', label: 'Ba12 Chill', url: 'https://media.tenor.com/xr-ystYEDtsAAAAM/ba12.gif' },
    { id: 'nap-4', label: 'Nekos Sleep', url: 'https://nekos.best/api/v2/sleep/1d1824d2-eb00-4fa2-a56b-3aaf7edcc319.gif' },
  ],
  'eating-ramen': [
    { id: 'ramen-1', label: 'Hungry Ramen', url: 'https://media.tenor.com/3hCp28Y4JcUAAAAM/hungry-ramen.gif' },
    { id: 'ramen-2', label: 'Nekos Feed', url: 'https://nekos.best/api/v2/feed/e480b6f8-aa99-4f36-b112-7bda61bf4ab8.gif' },
    { id: 'ramen-3', label: 'Anime Slurp', url: 'https://i.giphy.com/aW9HiiooRmdwdG0bPc.gif' },
    { id: 'ramen-4', label: 'Naruto Stare', url: 'https://media.tenor.com/rtMO2T0cQrEAAAAM/42.gif' },
  ],
  'eating-pizza': [
    { id: 'pizza-1', label: 'Pizza Food', url: 'https://media.tenor.com/i-xS-A_DTCEAAAAM/pizza-food.gif' },
    { id: 'pizza-2', label: 'Nekos Feed', url: 'https://nekos.best/api/v2/feed/b9abbae0-3b59-437e-b866-3402c2c7f22e.gif' },
    { id: 'pizza-3', label: 'Birthday Cake', url: 'https://media.tenor.com/-pBlhybnp54AAAAM/happy-birthday-cake.gif' },
    { id: 'pizza-4', label: 'Snack Time', url: 'https://i.giphy.com/p0dFF6nzn1DZKKyNdo.gif' },
  ],
  gaming: [
    { id: 'game-1', label: 'Konata Gaming', url: 'https://media.tenor.com/9tbKJeCFPaUAAAAd/konata-gaming.gif' },
    { id: 'game-2', label: 'Nekos Yeet', url: 'https://nekos.best/api/v2/yeet/bd0af6f9-aabe-4d69-a467-4727ee6ebee0.gif' },
    { id: 'game-3', label: 'VR Boxing', url: 'https://media.tenor.com/hvmj5kz64Q4AAAAM/boxing-oculus.gif' },
    { id: 'game-4', label: 'Potz Power', url: 'https://media.tenor.com/pqzUICCf7XYAAAAj/potz-power.gif' },
  ],
  listening: [
    { id: 'listen-1', label: 'Headphones', url: 'https://media.tenor.com/dN976uhxB0kAAAAM/aimoto-rinku-listening-to-music.gif' },
    { id: 'listen-2', label: 'Nekos Dance', url: 'https://nekos.best/api/v2/dance/2fa17d31-404a-4d50-b092-4448d403a59e.gif' },
    { id: 'listen-3', label: 'Hakari Dance', url: 'https://media.tenor.com/uRlxzRNgp2MAAAAj/anime-girl.gif' },
    { id: 'listen-4', label: 'Vibe Check', url: 'https://i.giphy.com/3o6YfXCRvjzATblkJy.gif' },
  ],
  studying: [
    { id: 'study-1', label: 'Studying Girl', url: 'https://media.tenor.com/etfl8OlhPIYAAAAM/studying-anime-girl.gif' },
    { id: 'study-2', label: 'Taking Notes', url: 'https://media.tenor.com/COjSGra2WL4AAAAM/taking-notes-notes.gif' },
    { id: 'study-3', label: 'Nekos Pat', url: 'https://nekos.best/api/v2/pat/269cbfec-e1da-44f5-9817-a80b4a89a0ac.gif' },
    { id: 'study-4', label: 'Typing Focus', url: 'https://media.tenor.com/Ie8lbeBejHEAAAAM/the-masterful-cat-is-depressed-again-today-dekiru-neko-wa-kyou-mo-yuuutsu.gif' },
  ],
  watching: [
    { id: 'watch-1', label: 'Movie Night', url: 'https://media.tenor.com/P8jCycbR6k8AAAAM/yosuke-tickets.gif' },
    { id: 'watch-2', label: 'Nekos Happy', url: 'https://nekos.best/api/v2/happy/690a874e-0a3f-4d8e-ab3e-e0b6e82c993a.gif' },
    { id: 'watch-3', label: 'Death Note', url: 'https://media.tenor.com/ranNc0BHOI4AAAAM/popopo.gif' },
    { id: 'watch-4', label: 'Anime Vibes', url: 'https://i.giphy.com/2Y7tZMmIpwV6Lnc5QC.gif' },
  ],
  partying: [
    { id: 'party-1', label: 'Party Hard', url: 'https://media.tenor.com/ymPYRZ4YGbEAAAAM/partyhard-party.gif' },
    { id: 'party-2', label: 'Nekos Dance', url: 'https://nekos.best/api/v2/dance/2fa17d31-404a-4d50-b092-4448d403a59e.gif' },
    { id: 'party-3', label: 'Dance Moves', url: 'https://i.giphy.com/WyZ1D8gXF7QQsRkXw5.gif' },
    { id: 'party-4', label: 'Celebration', url: 'https://i.giphy.com/ZJ25E2hJ5IpfvgkxYE.gif' },
  ],
  focus: [
    { id: 'focus-1', label: 'Anime Pat', url: 'https://media.tenor.com/qhe3ahMJ_i0AAAAM/anime-anime-pat.gif' },
    { id: 'focus-2', label: 'Nekos Pat', url: 'https://nekos.best/api/v2/pat/269cbfec-e1da-44f5-9817-a80b4a89a0ac.gif' },
    { id: 'focus-3', label: 'Note Taking', url: 'https://i.giphy.com/p55iGp1XppSv4WiV2y.gif' },
    { id: 'focus-4', label: 'Deep Work', url: 'https://i.giphy.com/WgRsfKIC2WbJDpyLB7.gif' },
  ],
  traveling: [
    { id: 'travel-1', label: 'Road Trip', url: 'https://media.tenor.com/gPjII19ICdIAAAAM/road-road-trip-move-dragon-ball-anime-tyan-vibe-car.gif' },
    { id: 'travel-2', label: 'Nekos Run', url: 'https://nekos.best/api/v2/run/e13cc2bc-5826-41e2-8093-732a59bd39d1.gif' },
    { id: 'travel-3', label: 'Uma Musume', url: 'https://media.tenor.com/7Wr359XtEtEAAAAM/uma-musume-meep.gif' },
    { id: 'travel-4', label: 'Goku Sun', url: 'https://media.tenor.com/Wakk9-QWiLIAAAAM/dokkan-battle-top.gif' },
  ],
};

function nekosEndpointFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/nekos\.best\/api\/v2\/([^/?#]+)/i);
  return match?.[1] || null;
}

/** Normalize nekos.best permalink / API JSON URL to a direct HTTPS GIF URL */
export function normalizeNekosUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  const match = trimmed.match(/^https:\/\/nekos\.best\/api\/v2\/([^/?#]+)\/([^/?#]+)\.gif/i);
  if (match) return `https://nekos.best/api/v2/${match[1]}/${match[2]}.gif`;
  return trimmed;
}

export function isNekosBestUrl(url) {
  return typeof url === 'string' && /nekos\.best\/api\/v2\//i.test(url);
}

export function getNekosEndpointForActivity(activityId, url = null) {
  return nekosEndpointFromUrl(url) || ACTIVITY_NEKOS_ENDPOINTS[activityId] || null;
}

/** Live nekos.best GIF for an activity — used when static permalinks fail in the picker */
export async function fetchNekosGifForActivity(activityId, hintUrl = null) {
  const endpoints = [];
  const fromUrl = nekosEndpointFromUrl(hintUrl);
  const primary = ACTIVITY_NEKOS_ENDPOINTS[activityId];
  const alternates = ACTIVITY_NEKOS_ALTERNATES[activityId] || [];
  for (const ep of [fromUrl, primary, ...alternates]) {
    if (ep && !endpoints.includes(ep)) endpoints.push(ep);
  }
  const result = await fetchNekosWithRetry(endpoints);
  return result?.url || (isValidDiscordImageUrl(hintUrl) ? normalizeNekosUrl(hintUrl) : null);
}

function withNekosFallback(option, activityId) {
  if (!option?.url || option.fallbackUrl) return option;
  if (!isNekosBestUrl(option.url)) return option;
  const tenor = ACTIVITY_TENOR_FALLBACKS[activityId];
  const category = Object.keys(VERIFIED_FALLBACKS).find((k) => VERIFIED_FALLBACKS[k] === option.url);
  const fallbackUrl = tenor || (category ? ACTIVITY_TENOR_FALLBACKS[category] : null) || null;
  return fallbackUrl ? { ...option, fallbackUrl } : option;
}

export function getActivityGifOptions(activityId) {
  if (ACTIVITY_GIF_OPTIONS[activityId]) {
    return ACTIVITY_GIF_OPTIONS[activityId].map((o) => withNekosFallback({ ...o, url: normalizeNekosUrl(o.url) }, activityId));
  }
  const options = [];
  const tenor = ACTIVITY_TENOR_FALLBACKS[activityId];
  const verified = normalizeNekosUrl(VERIFIED_FALLBACKS[activityId]);
  if (tenor) options.push({ id: `${activityId}-curated`, label: 'Curated', url: tenor });
  if (verified && verified !== tenor) {
    options.push({
      id: `${activityId}-nekos`,
      label: 'Neko Alt',
      url: verified,
      fallbackUrl: tenor || null,
      nekosEndpoint: getNekosEndpointForActivity(activityId, verified),
    });
  }
  return options;
}

export function resolveGifChoiceUrl(activityId, choiceId) {
  if (!choiceId || !activityId) return null;
  if (choiceId.startsWith('custom:')) {
    const url = normalizeDiscordImageUrl(choiceId.slice(7));
    return isValidDiscordImageUrl(url) ? url : null;
  }
  const options = getActivityGifOptions(activityId);
  const match = options.find((o) => o.id === choiceId);
  const url = normalizeDiscordImageUrl(match?.url || options[0]?.url || ACTIVITY_TENOR_FALLBACKS[activityId] || null);
  return isValidDiscordImageUrl(url) ? url : null;
}

export function getDefaultGifChoiceId(activityId) {
  const options = getActivityGifOptions(activityId);
  return options[0]?.id || null;
}

/** Session cache — keyed by activity.id */
const sessionImageCache = new Map();

export function clearActivityImageCache() {
  sessionImageCache.clear();
}

export function clearActivityImageCacheEntry(activityId) {
  if (activityId) sessionImageCache.delete(activityId);
}

export function normalizeDiscordImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  let normalized = normalizeNekosUrl(url.trim());
  if (/^https?:\/\/media1\.tenor\.com\//i.test(normalized)) {
    const match = normalized.match(/^https?:\/\/media1\.tenor\.com\/m\/([^/]+)\/(.+)$/i);
    if (match) {
      let id = match[1];
      if (id.endsWith('AAAAC')) id = `${id.slice(0, -5)}AAAAM`;
      normalized = `https://media.tenor.com/${id}/${match[2]}`;
    } else {
      normalized = normalized.replace(/^https?:\/\/media1\.tenor\.com/i, 'https://media.tenor.com');
    }
  }
  // Prefer short Giphy CDN paths (Discord rejects URLs over 512 chars)
  const giphy = normalized.match(/^https:\/\/media\d\.giphy\.com\/media\/([^/]+)\/giphy\.gif/i);
  if (giphy) normalized = `https://i.giphy.com/${giphy[1]}.gif`;
  return normalized;
}

export function isValidDiscordImageUrl(url) {
  const normalized = normalizeDiscordImageUrl(url);
  if (!normalized || typeof normalized !== 'string') return false;
  if (!/^https:\/\//i.test(normalized)) return false;
  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) return false;
  return normalized.length <= DISCORD_IMAGE_MAX_LEN;
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
  { animationsEnabled = true, customDataUrl = null, bustCache = false, preferredGifUrl = null } = {}
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
    if (preferredGifUrl) {
      const previewUrl = isPreviewImageUrl(preferredGifUrl) ? preferredGifUrl : null;
      const discordUrl = isValidDiscordImageUrl(preferredGifUrl)
        ? preferredGifUrl
        : isValidDiscordImageUrl(activity.gifUrl)
          ? activity.gifUrl
          : null;
      if (previewUrl || discordUrl) {
        return cacheResult(
          activity.id,
          buildResult(activity.id, {
            url: previewUrl || discordUrl,
            discordUrl,
            source: discordUrl ? 'Chosen GIF' : 'Chosen · preview only',
            fallbacks: uniqueUrls([activity.localGifPath, activity.gifUrl].filter(Boolean)),
          })
        );
      }
    }

    const cached = readCache(activity.id);
    if (cached && !preferredGifUrl) return { ...cached, fallbacks: cached.fallbacks || [] };

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
  if (cached && !preferredGifUrl) return { ...cached, fallbacks };

  if (preferredGifUrl) {
    const previewUrl = isPreviewImageUrl(preferredGifUrl) ? preferredGifUrl : null;
    const discordUrl = isValidDiscordImageUrl(preferredGifUrl)
      ? preferredGifUrl
      : isValidDiscordImageUrl(tenor)
        ? tenor
        : verified;
    if (previewUrl || discordUrl) {
      return cacheResult(
        activity.id,
        buildResult(activity.id, {
          url: previewUrl || discordUrl,
          discordUrl,
          source: isValidDiscordImageUrl(preferredGifUrl) ? 'Chosen GIF' : 'Chosen · preview only',
          fallbacks,
        })
      );
    }
  }

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
  const normalized = normalizeDiscordImageUrl(discordUrl);
  const url = isValidDiscordImageUrl(normalized) ? normalized : getVerifiedFallback(activity);
  return {
    largeImageUrl: url,
    discordImageUrl: url,
    fallbackGif: url,
    largeImageText: activity.largeImageText || activity.details,
  };
}
