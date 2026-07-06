/**
 * Discord Rich Presence + UI image resolution.
 * API-sourced SFW anime only (nekos.best, waifu.pics, Tenor fallbacks).
 * No copyrighted character assets are bundled — media comes from public APIs.
 */

const FETCH_TIMEOUT_MS = 6000;
/** Shorter timeout for optional neko alt refresh — fall back to curated Tenor */
const NEKOS_ALT_TIMEOUT_MS = 3000;
const DISCORD_IMAGE_MAX_LEN = 512;
const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Smiley',
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

/** Curated SFW Tenor/Giphy GIFs per activity — primary = first girl option (verified HTTP 200) */
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
  retro: 'https://media.tenor.com/pqzUICCf7XYAAAAM/potz-power.gif',
  speedrun: 'https://media.tenor.com/mUIXigPWPuYAAAAM/anime-anime-girl-running.gif',
  'vr-gaming': 'https://media.tenor.com/qIvEeou-1FIAAAAM/play-network-anime-girl.gif',
  sleeping: 'https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif',
  napping: 'https://media.tenor.com/y-nFVMnj_g4AAAAM/d4dj-d4dj-petit-mix.gif',
  reading: 'https://media.tenor.com/rJxGy9CYwHoAAAAM/anime-read.gif',
  listening: 'https://media.tenor.com/dN976uhxB0kAAAAM/aimoto-rinku-listening-to-music.gif',
  meditating: 'https://media.tenor.com/H2TduYuD5S0AAAAM/anime-miss-kobayashis-dragon-maid.gif',
  bath: 'https://media.tenor.com/M3nkdB81tkQAAAAM/virgin-road-anime-relaxed.gif',
  studying: 'https://media.tenor.com/etfl8OlhPIYAAAAM/studying-anime-girl.gif',
  meeting: 'https://media.tenor.com/_9W9bVa4AHgAAAAM/wavi-anime.gif',
  focus: 'https://media.tenor.com/YQ7zME1GJn8AAAAM/black-girl-typing-anime-working-drawing-cartoon.gif',
  designing: 'https://media.tenor.com/GB_tiifwEJ0AAAAM/drawing-kaoruko-moeta.gif',
  writing: 'https://media.tenor.com/cwOI3DtZRzgAAAAM/anya-forger-taking-notes.gif',
  streaming: 'https://media.tenor.com/qIvEeou-1FIAAAAM/play-network-anime-girl.gif',
  watching: 'https://media.tenor.com/P8jCycbR6k8AAAAM/yosuke-tickets.gif',
  traveling: 'https://media.tenor.com/gPjII19ICdIAAAAM/road-road-trip-move-dragon-ball-anime-tyan-vibe-car.gif',
  gym: 'https://media.tenor.com/0weeqPoyCWIAAAAM/how-heavy-are-the-dumbbells-that-you-lift-dumbbell-nan-kilo-moteru.gif',
  partying: 'https://media.tenor.com/ymPYRZ4YGbEAAAAM/partyhard-party.gif',
  shopping: 'https://media.tenor.com/9M34adQOtNwAAAAM/shopping-hi.gif',
};

/** Per-activity GIF picker — 2 girl + 2 boy options; first girl = ACTIVITY_TENOR_FALLBACKS */
export const ACTIVITY_GIF_OPTIONS = {
  'eating-pizza': [
    { id: 'pizza-g1', label: 'Girl · Pizza Night', gender: 'girl', url: 'https://media.tenor.com/i-xS-A_DTCEAAAAM/pizza-food.gif' },
    { id: 'pizza-g2', label: 'Girl · Snacking', gender: 'girl', url: 'https://media.tenor.com/DtK1un8uLS0AAAAM/himouto-umaru-chan.gif' },
    { id: 'pizza-b1', label: 'Boy · Chow Time', gender: 'boy', url: 'https://media.tenor.com/kJFtVfGATJ0AAAAM/love-food.gif' },
    { id: 'pizza-b2', label: 'Boy · Cake Slice', gender: 'boy', url: 'https://media.tenor.com/DQDtfEaDA5AAAAAC/cake-eat.gif' },
  ],
  'eating-sushi': [
    { id: 'sushi-g1', label: 'Girl · Sushi Bite', gender: 'girl', url: 'https://media.tenor.com/KE361QFenNcAAAAM/anime-refei%C3%A7%C3%A3o-jap%C3%A3o-comida.gif' },
    { id: 'sushi-g2', label: 'Girl · Kanna Snack', gender: 'girl', url: 'https://media.tenor.com/hnlwW6KsH1sAAAAM/kanna-kamui.gif' },
    { id: 'sushi-b1', label: 'Boy · Ramen Run', gender: 'boy', url: 'https://media.tenor.com/nwM1UzOjtAoAAAAM/anime-naruto.gif' },
    { id: 'sushi-b2', label: 'Boy · Team Stare', gender: 'boy', url: 'https://media.tenor.com/IwyNIipPItQAAAAM/anime-naruto.gif' },
  ],
  'eating-ramen': [
    { id: 'ramen-g1', label: 'Girl · Hungry Ramen', gender: 'girl', url: 'https://media.tenor.com/3hCp28Y4JcUAAAAM/hungry-ramen.gif' },
    { id: 'ramen-g2', label: 'Girl · Umaru Slurp', gender: 'girl', url: 'https://media.tenor.com/gBrP7QayoRkAAAAM/himouto-umaru-chan.gif' },
    { id: 'ramen-b1', label: 'Boy · Naruto Bowl', gender: 'boy', url: 'https://media.tenor.com/sMGZ93n6Nc4AAAAM/death-note-anime.gif' },
    { id: 'ramen-b2', label: 'Boy · Burger Bite', gender: 'boy', url: 'https://i.giphy.com/aW9HiiooRmdwdG0bPc.gif' },
  ],
  'eating-burger': [
    { id: 'burger-g1', label: 'Girl · Burger Time', gender: 'girl', url: 'https://media.tenor.com/uk9xO0xpWoIAAAAM/burger-eating.gif' },
    { id: 'burger-g2', label: 'Girl · Sweet Bite', gender: 'girl', url: 'https://media.tenor.com/DTRz6D1e5ZEAAAAM/eating-dessert-happily.gif' },
    { id: 'burger-b1', label: 'Boy · Feast Mode', gender: 'boy', url: 'https://media.tenor.com/P4iukwlv4LIAAAAM/benjammins-ben-jammins.gif' },
    { id: 'burger-b2', label: 'Boy · Chef Prep', gender: 'boy', url: 'https://i.giphy.com/p0dFF6nzn1DZKKyNdo.gif' },
  ],
  'eating-tacos': [
    { id: 'taco-g1', label: 'Girl · Uwu Taco', gender: 'girl', url: 'https://media.tenor.com/tz1kb3yen6wAAAAM/uwu-taco.gif' },
    { id: 'taco-g2', label: 'Girl · Birthday Treat', gender: 'girl', url: 'https://media.tenor.com/-pBlhybnp54AAAAM/happy-birthday-cake.gif' },
    { id: 'taco-b1', label: 'Boy · Popopo Munch', gender: 'boy', url: 'https://media.tenor.com/ranNc0BHOI4AAAAM/popopo.gif' },
    { id: 'taco-b2', label: 'Boy · Quick Bite', gender: 'boy', url: 'https://media.tenor.com/rtMO2T0cQrEAAAAM/42.gif' },
  ],
  'eating-snacks': [
    { id: 'snack-g1', label: 'Girl · Umaru Snacks', gender: 'girl', url: 'https://media.tenor.com/gBrP7QayoRkAAAAM/himouto-umaru-chan.gif' },
    { id: 'snack-g2', label: 'Girl · Munchies', gender: 'girl', url: 'https://media.tenor.com/DtK1un8uLS0AAAAM/himouto-umaru-chan.gif' },
    { id: 'snack-b1', label: 'Boy · Mocha Snack', gender: 'boy', url: 'https://media.tenor.com/OZdXkNd2o-IAAAAM/mocha-and-milk-mocha-bear.gif' },
    { id: 'snack-b2', label: 'Boy · Kanna Crunch', gender: 'boy', url: 'https://media.tenor.com/lRy4uJzoGk8AAAAM/kanna-cry.gif' },
  ],
  cooking: [
    { id: 'cook-g1', label: 'Girl · Sora Cooking', gender: 'girl', url: 'https://media.tenor.com/flX5arjPeDcAAAAM/sora-cooking.gif' },
    { id: 'cook-g2', label: 'Girl · Dragon Maid', gender: 'girl', url: 'https://media.tenor.com/H2TduYuD5S0AAAAM/anime-miss-kobayashis-dragon-maid.gif' },
    { id: 'cook-b1', label: 'Boy · Kitchen Prep', gender: 'boy', url: 'https://media.tenor.com/wITiUPzJyzYAAAAM/awesome-quotes.gif' },
    { id: 'cook-b2', label: 'Boy · Benjammins', gender: 'boy', url: 'https://media.tenor.com/P4iukwlv4LIAAAAM/benjammins-ben-jammins.gif' },
  ],
  'eating-dessert': [
    { id: 'dessert-g1', label: 'Girl · Sweet Tooth', gender: 'girl', url: 'https://media.tenor.com/DTRz6D1e5ZEAAAAM/eating-dessert-happily.gif' },
    { id: 'dessert-g2', label: 'Girl · Cake Eat', gender: 'girl', url: 'https://media.tenor.com/DQDtfEaDA5AAAAAC/cake-eat.gif' },
    { id: 'dessert-b1', label: 'Boy · Love Food', gender: 'boy', url: 'https://media.tenor.com/kJFtVfGATJ0AAAAM/love-food.gif' },
    { id: 'dessert-b2', label: 'Boy · Party Cake', gender: 'boy', url: 'https://media.tenor.com/-pBlhybnp54AAAAM/happy-birthday-cake.gif' },
  ],
  gaming: [
    { id: 'game-g1', label: 'Girl · Konata Gaming', gender: 'girl', url: 'https://media.tenor.com/9tbKJeCFPaUAAAAd/konata-gaming.gif' },
    { id: 'game-g2', label: 'Girl · Online Play', gender: 'girl', url: 'https://media.tenor.com/uRlxzRNgp2MAAAAM/anime-girl.gif' },
    { id: 'game-b1', label: 'Boy · Konata Happy', gender: 'boy', url: 'https://media.tenor.com/Aq8PrtQFqrsAAAAM/konata-konata-happy.gif' },
    { id: 'game-b2', label: 'Boy · VR Boxing', gender: 'boy', url: 'https://media.tenor.com/hvmj5kz64Q4AAAAM/boxing-oculus.gif' },
  ],
  ranked: [
    { id: 'ranked-g1', label: 'Girl · Ranked Kick', gender: 'girl', url: 'https://media.tenor.com/o52AZQZ_PloAAAAM/kick-anime.gif' },
    { id: 'ranked-g2', label: 'Girl · Agnes Sprint', gender: 'girl', url: 'https://media.tenor.com/NazVGclCYHEAAAAM/agnes-tachyon-tachyon.gif' },
    { id: 'ranked-b1', label: 'Boy · Sasuke Stare', gender: 'boy', url: 'https://media.tenor.com/IwyNIipPItQAAAAM/anime-naruto.gif' },
    { id: 'ranked-b2', label: 'Boy · Dokkan Grind', gender: 'boy', url: 'https://media.tenor.com/Wakk9-QWiLIAAAAM/dokkan-battle-top.gif' },
  ],
  coop: [
    { id: 'coop-g1', label: 'Girl · Co-op Hug', gender: 'girl', url: 'https://media.tenor.com/ZIlcnod9hnkAAAAM/anime-anime-hug.gif' },
    { id: 'coop-g2', label: 'Girl · Happy Dance', gender: 'girl', url: 'https://media.tenor.com/TxflfpxQNgcAAAAM/happy-dance.gif' },
    { id: 'coop-b1', label: 'Boy · Pixel Co-op', gender: 'boy', url: 'https://i.giphy.com/qCr3LLomOJUfGUYOZx.gif' },
    { id: 'coop-b2', label: 'Boy · Team Wave', gender: 'boy', url: 'https://media.tenor.com/Aq8PrtQFqrsAAAAM/konata-konata-happy.gif' },
  ],
  retro: [
    { id: 'retro-g1', label: 'Girl · Potz Power', gender: 'girl', url: 'https://media.tenor.com/pqzUICCf7XYAAAAM/potz-power.gif' },
    { id: 'retro-g2', label: 'Girl · Pixel Dance', gender: 'girl', url: 'https://media.tenor.com/TxflfpxQNgcAAAAM/happy-dance.gif' },
    { id: 'retro-b1', label: 'Boy · Popopo Retro', gender: 'boy', url: 'https://media.tenor.com/ranNc0BHOI4AAAAM/popopo.gif' },
    { id: 'retro-b2', label: 'Boy · Orchid Pots', gender: 'boy', url: 'https://media.tenor.com/tTtR9Ksxh2AAAAAM/orchid-pots-orchid-pot.gif' },
  ],
  speedrun: [
    { id: 'speed-g1', label: 'Girl · Speed Run', gender: 'girl', url: 'https://media.tenor.com/mUIXigPWPuYAAAAM/anime-anime-girl-running.gif' },
    { id: 'speed-g2', label: 'Girl · Agnes Dash', gender: 'girl', url: 'https://media.tenor.com/NazVGclCYHEAAAAM/agnes-tachyon-tachyon.gif' },
    { id: 'speed-b1', label: 'Boy · Goku Sprint', gender: 'boy', url: 'https://media.tenor.com/_1dTlQaSol4AAAAM/goku-sun.gif' },
    { id: 'speed-b2', label: 'Boy · Uma Musume', gender: 'boy', url: 'https://media.tenor.com/7Wr359XtEtEAAAAM/uma-musume-meep.gif' },
  ],
  'vr-gaming': [
    { id: 'vr-g1', label: 'Girl · VR Stream', gender: 'girl', url: 'https://media.tenor.com/qIvEeou-1FIAAAAM/play-network-anime-girl.gif' },
    { id: 'vr-g2', label: 'Girl · VR Boxing', gender: 'girl', url: 'https://media.tenor.com/hvmj5kz64Q4AAAAM/boxing-oculus.gif' },
    { id: 'vr-b1', label: 'Boy · Game Stream', gender: 'boy', url: 'https://i.giphy.com/2Y7tZMmIpwV6Lnc5QC.gif' },
    { id: 'vr-b2', label: 'Boy · Typing Grind', gender: 'boy', url: 'https://media.tenor.com/t8rp6pY-Wl8AAAAM/typing-anime-coding.gif' },
  ],
  sleeping: [
    { id: 'sleep-g1', label: 'Girl · Sleepy Sleep', gender: 'girl', url: 'https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif' },
    { id: 'sleep-g2', label: 'Girl · Sleep Anime', gender: 'girl', url: 'https://media.tenor.com/lptw_sFe1DYAAAAM/sleep-anime.gif' },
    { id: 'sleep-b1', label: 'Boy · Mocha Bear', gender: 'boy', url: 'https://media.tenor.com/OZdXkNd2o-IAAAAM/mocha-and-milk-mocha-bear.gif' },
    { id: 'sleep-b2', label: 'Boy · Go to Sleep', gender: 'boy', url: 'https://media.tenor.com/GOEO_QhhtlYAAAAM/go-to-sleep-anime.gif' },
  ],
  napping: [
    { id: 'nap-g1', label: 'Girl · D4DJ Nap', gender: 'girl', url: 'https://media.tenor.com/y-nFVMnj_g4AAAAM/d4dj-d4dj-petit-mix.gif' },
    { id: 'nap-g2', label: 'Girl · Power Nap', gender: 'girl', url: 'https://media.tenor.com/aeDeYPV8t1IAAAAM/sleepy-sleep.gif' },
    { id: 'nap-b1', label: 'Boy · D4DJ Mix', gender: 'boy', url: 'https://media.tenor.com/6OCEdkhjHKUAAAAM/d4dj-first-mix-d4dj.gif' },
    { id: 'nap-b2', label: 'Boy · Ba12 Chill', gender: 'boy', url: 'https://media.tenor.com/xr-ystYEDtsAAAAM/ba12.gif' },
  ],
  reading: [
    { id: 'read-g1', label: 'Girl · Lost in Book', gender: 'girl', url: 'https://media.tenor.com/rJxGy9CYwHoAAAAM/anime-read.gif' },
    { id: 'read-g2', label: 'Girl · Anya Notes', gender: 'girl', url: 'https://media.tenor.com/cwOI3DtZRzgAAAAM/anya-forger-taking-notes.gif' },
    { id: 'read-b1', label: 'Boy · Death Note', gender: 'boy', url: 'https://media.tenor.com/sMGZ93n6Nc4AAAAM/death-note-anime.gif' },
    { id: 'read-b2', label: 'Boy · Taking Notes', gender: 'boy', url: 'https://media.tenor.com/EL7zfInn_vsAAAAM/taking-notes-noting.gif' },
  ],
  listening: [
    { id: 'listen-g1', label: 'Girl · Headphones', gender: 'girl', url: 'https://media.tenor.com/dN976uhxB0kAAAAM/aimoto-rinku-listening-to-music.gif' },
    { id: 'listen-g2', label: 'Girl · Music Vibe', gender: 'girl', url: 'https://media.tenor.com/FhCrIhUtPmoAAAAM/headphones-listening-to-music.gif' },
    { id: 'listen-b1', label: 'Boy · Monkey Beats', gender: 'boy', url: 'https://media.tenor.com/aFWrWPvQQ6kAAAAM/inefablejuly-monkey-listening-to-music-lilychouchoucore.gif' },
    { id: 'listen-b2', label: 'Boy · Travel Vibes', gender: 'boy', url: 'https://i.giphy.com/3o6YfXCRvjzATblkJy.gif' },
  ],
  meditating: [
    { id: 'med-g1', label: 'Girl · Dragon Maid', gender: 'girl', url: 'https://media.tenor.com/H2TduYuD5S0AAAAM/anime-miss-kobayashis-dragon-maid.gif' },
    { id: 'med-g2', label: 'Girl · Kanna Peace', gender: 'girl', url: 'https://media.tenor.com/hnlwW6KsH1sAAAAM/kanna-kamui.gif' },
    { id: 'med-b1', label: 'Boy · D4DJ Calm', gender: 'boy', url: 'https://media.tenor.com/6OCEdkhjHKUAAAAM/d4dj-first-mix-d4dj.gif' },
    { id: 'med-b2', label: 'Boy · Relaxed Bath', gender: 'boy', url: 'https://media.tenor.com/M3nkdB81tkQAAAAM/virgin-road-anime-relaxed.gif' },
  ],
  bath: [
    { id: 'bath-g1', label: 'Girl · Bubble Bath', gender: 'girl', url: 'https://media.tenor.com/M3nkdB81tkQAAAAM/virgin-road-anime-relaxed.gif' },
    { id: 'bath-g2', label: 'Girl · Ba12 Relax', gender: 'girl', url: 'https://media.tenor.com/xr-ystYEDtsAAAAM/ba12.gif' },
    { id: 'bath-b1', label: 'Boy · Kanna Soak', gender: 'boy', url: 'https://media.tenor.com/lRy4uJzoGk8AAAAM/kanna-cry.gif' },
    { id: 'bath-b2', label: 'Boy · Chill Quotes', gender: 'boy', url: 'https://media.tenor.com/wITiUPzJyzYAAAAM/awesome-quotes.gif' },
  ],
  studying: [
    { id: 'study-g1', label: 'Girl · Studying', gender: 'girl', url: 'https://media.tenor.com/etfl8OlhPIYAAAAM/studying-anime-girl.gif' },
    { id: 'study-g2', label: 'Girl · Note Taking', gender: 'girl', url: 'https://media.tenor.com/COjSGra2WL4AAAAM/taking-notes-notes.gif' },
    { id: 'study-b1', label: 'Boy · Ghibli Study', gender: 'boy', url: 'https://i.giphy.com/6XX4V0O8a0xdS.gif' },
    { id: 'study-b2', label: 'Boy · Focus 42', gender: 'boy', url: 'https://media.tenor.com/rtMO2T0cQrEAAAAM/42.gif' },
  ],
  meeting: [
    { id: 'meet-g1', label: 'Girl · Wave Hello', gender: 'girl', url: 'https://media.tenor.com/_9W9bVa4AHgAAAAM/wavi-anime.gif' },
    { id: 'meet-g2', label: 'Girl · Team Hug', gender: 'girl', url: 'https://media.tenor.com/ZIlcnod9hnkAAAAM/anime-anime-hug.gif' },
    { id: 'meet-b1', label: 'Boy · Boss Cat', gender: 'boy', url: 'https://i.giphy.com/WyZ1D8gXF7QQsRkXw5.gif' },
    { id: 'meet-b2', label: 'Boy · Konata Wave', gender: 'boy', url: 'https://media.tenor.com/Aq8PrtQFqrsAAAAM/konata-konata-happy.gif' },
  ],
  focus: [
    { id: 'focus-g1', label: 'Girl · Deep Work', gender: 'girl', url: 'https://media.tenor.com/YQ7zME1GJn8AAAAM/black-girl-typing-anime-working-drawing-cartoon.gif' },
    { id: 'focus-g2', label: 'Girl · Taking Notes', gender: 'girl', url: 'https://media.tenor.com/COjSGra2WL4AAAAM/taking-notes-notes.gif' },
    { id: 'focus-b1', label: 'Boy · Typing Code', gender: 'boy', url: 'https://media.tenor.com/t8rp6pY-Wl8AAAAM/typing-anime-coding.gif' },
    { id: 'focus-b2', label: 'Boy · Neko Typing', gender: 'boy', url: 'https://media.tenor.com/Ie8lbeBejHEAAAAM/the-masterful-cat-is-depressed-again-today-dekiru-neko-wa-kyou-mo-yuuutsu.gif' },
  ],
  designing: [
    { id: 'design-g1', label: 'Girl · Sketching', gender: 'girl', url: 'https://media.tenor.com/GB_tiifwEJ0AAAAM/drawing-kaoruko-moeta.gif' },
    { id: 'design-g2', label: 'Girl · Painting', gender: 'girl', url: 'https://media.tenor.com/LYcyjnpOLb8AAAAM/excited-draw.gif' },
    { id: 'design-b1', label: 'Boy · Drawing', gender: 'boy', url: 'https://media.tenor.com/tHnnUJSL72QAAAAM/drawing-anime.gif' },
    { id: 'design-b2', label: 'Boy · Creating', gender: 'boy', url: 'https://media.tenor.com/ZOmuXmfIViwAAAAM/astheticanime-anime.gif' },
  ],
  writing: [
    { id: 'write-g1', label: 'Girl · Anya Notes', gender: 'girl', url: 'https://media.tenor.com/cwOI3DtZRzgAAAAM/anya-forger-taking-notes.gif' },
    { id: 'write-g2', label: 'Girl · Artist Desk', gender: 'girl', url: 'https://media.tenor.com/oq3lNDA5J2QAAAAM/draw-artist.gif' },
    { id: 'write-b1', label: 'Boy · Taking Notes', gender: 'boy', url: 'https://media.tenor.com/EL7zfInn_vsAAAAM/taking-notes-noting.gif' },
    { id: 'write-b2', label: 'Boy · Precure Draw', gender: 'boy', url: 'https://media.tenor.com/_GF7wBzy0-oAAAAM/smile-precure-kise-yayoi.gif' },
  ],
  streaming: [
    { id: 'stream-g1', label: 'Girl · Live Setup', gender: 'girl', url: 'https://media.tenor.com/qIvEeou-1FIAAAAM/play-network-anime-girl.gif' },
    { id: 'stream-g2', label: 'Girl · Konata Live', gender: 'girl', url: 'https://media.tenor.com/9tbKJeCFPaUAAAAd/konata-gaming.gif' },
    { id: 'stream-b1', label: 'Boy · Game Stream', gender: 'boy', url: 'https://i.giphy.com/2Y7tZMmIpwV6Lnc5QC.gif' },
    { id: 'stream-b2', label: 'Boy · TV Watch', gender: 'boy', url: 'https://media.tenor.com/tTtR9Ksxh2AAAAAM/orchid-pots-orchid-pot.gif' },
  ],
  watching: [
    { id: 'watch-g1', label: 'Girl · Movie Night', gender: 'girl', url: 'https://media.tenor.com/P8jCycbR6k8AAAAM/yosuke-tickets.gif' },
    { id: 'watch-g2', label: 'Girl · TV Time', gender: 'girl', url: 'https://media.tenor.com/tTtR9Ksxh2AAAAAM/orchid-pots-orchid-pot.gif' },
    { id: 'watch-b1', label: 'Boy · Late Night', gender: 'boy', url: 'https://i.giphy.com/p55iGp1XppSv4WiV2y.gif' },
    { id: 'watch-b2', label: 'Boy · Death Note', gender: 'boy', url: 'https://media.tenor.com/sMGZ93n6Nc4AAAAM/death-note-anime.gif' },
  ],
  traveling: [
    { id: 'travel-g1', label: 'Girl · Road Trip', gender: 'girl', url: 'https://media.tenor.com/gPjII19ICdIAAAAM/road-road-trip-move-dragon-ball-anime-tyan-vibe-car.gif' },
    { id: 'travel-g2', label: 'Girl · Running Off', gender: 'girl', url: 'https://media.tenor.com/mUIXigPWPuYAAAAM/anime-anime-girl-running.gif' },
    { id: 'travel-b1', label: 'Boy · Goku Sun', gender: 'boy', url: 'https://media.tenor.com/_1dTlQaSol4AAAAM/goku-sun.gif' },
    { id: 'travel-b2', label: 'Boy · Animation Trip', gender: 'boy', url: 'https://i.giphy.com/3o6YfXCRvjzATblkJy.gif' },
  ],
  gym: [
    { id: 'gym-g1', label: 'Girl · Dumbbell Nan', gender: 'girl', url: 'https://media.tenor.com/0weeqPoyCWIAAAAM/how-heavy-are-the-dumbbells-that-you-lift-dumbbell-nan-kilo-moteru.gif' },
    { id: 'gym-g2', label: 'Girl · Ranked Kick', gender: 'girl', url: 'https://media.tenor.com/o52AZQZ_PloAAAAM/kick-anime.gif' },
    { id: 'gym-b1', label: 'Boy · Working Out', gender: 'boy', url: 'https://i.giphy.com/ZJ25E2hJ5IpfvgkxYE.gif' },
    { id: 'gym-b2', label: 'Boy · Dokkan Train', gender: 'boy', url: 'https://media.tenor.com/Wakk9-QWiLIAAAAM/dokkan-battle-top.gif' },
  ],
  partying: [
    { id: 'party-g1', label: 'Girl · Party Hard', gender: 'girl', url: 'https://media.tenor.com/ymPYRZ4YGbEAAAAM/partyhard-party.gif' },
    { id: 'party-g2', label: 'Girl · Hakari Dance', gender: 'girl', url: 'https://media.tenor.com/uRlxzRNgp2MAAAAM/anime-girl.gif' },
    { id: 'party-b1', label: 'Boy · Happy Dance', gender: 'boy', url: 'https://media.tenor.com/TxflfpxQNgcAAAAM/happy-dance.gif' },
    { id: 'party-b2', label: 'Boy · Uma Meep', gender: 'boy', url: 'https://media.tenor.com/7Wr359XtEtEAAAAM/uma-musume-meep.gif' },
  ],
  shopping: [
    { id: 'shop-g1', label: 'Girl · Shopping Hi', gender: 'girl', url: 'https://media.tenor.com/9M34adQOtNwAAAAM/shopping-hi.gif' },
    { id: 'shop-g2', label: 'Girl · Color Art', gender: 'girl', url: 'https://media.tenor.com/wEQP6dEzhPsAAAAM/color-art.gif' },
    { id: 'shop-b1', label: 'Boy · Ba12 Browse', gender: 'boy', url: 'https://media.tenor.com/xr-ystYEDtsAAAAM/ba12.gif' },
    { id: 'shop-b2', label: 'Boy · Anime Art', gender: 'boy', url: 'https://media.tenor.com/DEt2bZ2WpRUAAAAM/anime-anime-art.gif' },
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
  const result = await fetchNekosWithRetry(endpoints, NEKOS_ALT_TIMEOUT_MS);
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

/** Hosts Discord reliably proxies for Rich Presence external images */
const DISCORD_TRUSTED_IMAGE_HOSTS = [
  /^media\d*\.tenor\.com$/i,
  /^i\.giphy\.com$/i,
  /^media\d*\.giphy\.com$/i,
];

export function isDiscordTrustedImageUrl(url) {
  const normalized = normalizeDiscordImageUrl(url);
  if (!isValidDiscordImageUrl(normalized)) return false;
  try {
    const host = new URL(normalized).hostname;
    return DISCORD_TRUSTED_IMAGE_HOSTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

/**
 * URL Discord can fetch for Rich Presence — Tenor/Giphy only.
 * nekos.best / waifu.pics work in-browser but Discord's proxy often rejects them → app icon fallback.
 */
export function resolveDiscordRpcImageUrl(activity, candidateUrl = null) {
  const normalized = normalizeDiscordImageUrl(candidateUrl);
  if (isDiscordTrustedImageUrl(normalized)) return normalized;
  const tenor = getTenorFallback(activity);
  if (isDiscordTrustedImageUrl(tenor)) return tenor;
  return isValidDiscordImageUrl(tenor) ? tenor : null;
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
export async function fetchNekosBest(endpoint, timeoutMs = FETCH_TIMEOUT_MS) {
  if (!endpoint) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const data = await fetchJson(`https://nekos.best/api/v2/${endpoint}`, controller.signal);
    clearTimeout(timeout);
    const url = data?.results?.[0]?.url;
    return isValidDiscordImageUrl(url) ? url : null;
  } catch {
    return null;
  }
}

/** Try multiple nekos endpoints until one succeeds */
export async function fetchNekosWithRetry(endpoints, timeoutMs = FETCH_TIMEOUT_MS) {
  for (const endpoint of endpoints) {
    const url = await fetchNekosBest(endpoint, timeoutMs);
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

function buildResult(activityId, { url, discordUrl, source, fallbacks, needsAsyncResolve = false }) {
  return { url, discordUrl, source, fallbacks, activityId, needsAsyncResolve };
}

const preloadedUrls = new Set();

/** Warm browser cache for curated GIF URLs (non-blocking). */
export function preloadImageUrls(urls) {
  for (const raw of urls) {
    const url = normalizeDiscordImageUrl(raw);
    if (!url || preloadedUrls.has(url)) continue;
    preloadedUrls.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }
}

export function preloadActivitiesGifs(activities) {
  if (!activities?.length) return;
  const urls = activities.map((a) => getTenorFallback(a) || getVerifiedFallback(a)).filter(Boolean);
  preloadImageUrls(urls);
}

/**
 * Synchronous resolve — session cache, curated Tenor, or verified fallback.
 * Never blocks on network; optional live nekos uses resolveDiscordImageUrl in the background.
 */
export function getInstantActivityImages(
  activity,
  { animationsEnabled = true, customDataUrl = null, preferredGifUrl = null, bustCache = false } = {}
) {
  const verified = getVerifiedFallback(activity);
  const tenor = getTenorFallback(activity);
  const fallbacks = getActivityFallbackUrls(activity);

  if (!activity?.id) {
    return buildResult(null, {
      url: verified,
      discordUrl: resolveDiscordRpcImageUrl(activity, tenor || verified),
      source: 'nekos.best · fallback',
      fallbacks,
    });
  }

  if (bustCache) clearActivityImageCacheEntry(activity.id);

  if (activity.isCustom || activity.category === 'custom') {
    if (preferredGifUrl) {
      const previewUrl = isPreviewImageUrl(preferredGifUrl) ? preferredGifUrl : null;
      const discordUrl =
        resolveDiscordRpcImageUrl(activity, preferredGifUrl) ||
        resolveDiscordRpcImageUrl(activity, activity.gifUrl);
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
    const rpcUrl = resolveDiscordRpcImageUrl(activity, discord);
    const result = buildResult(activity.id, {
      url: preview,
      discordUrl: rpcUrl,
      source: rpcUrl
        ? 'Custom GIF'
        : preview
          ? 'Custom · preview only (add Tenor/Giphy URL for Discord)'
          : 'Custom',
      fallbacks: uniqueUrls([local, discord].filter((u) => u && u !== preview)),
    });
    if (preview || discord) return cacheResult(activity.id, result);
    return result;
  }

  if (customDataUrl) {
    const discordUrl = resolveDiscordRpcImageUrl(activity);
    return buildResult(activity.id, {
      url: customDataUrl,
      discordUrl,
      source: discordUrl ? 'Custom preview · Discord uses curated GIF' : 'Custom preview only',
      fallbacks,
    });
  }

  if (animationsEnabled === false) {
    const still = tenor || verified;
    const discordUrl = resolveDiscordRpcImageUrl(activity, still);
    return buildResult(activity.id, {
      url: still,
      discordUrl,
      source: 'Static fallback',
      fallbacks,
    });
  }

  const cached = readCache(activity.id);
  if (cached && !preferredGifUrl) return { ...cached, fallbacks };

  if (preferredGifUrl) {
    const previewUrl = isPreviewImageUrl(preferredGifUrl) ? preferredGifUrl : null;
    const discordUrl = resolveDiscordRpcImageUrl(activity, preferredGifUrl);
    if (previewUrl || discordUrl) {
      const nekosChoice = isNekosBestUrl(preferredGifUrl);
      return cacheResult(
        activity.id,
        buildResult(activity.id, {
          url: previewUrl || discordUrl || verified,
          discordUrl,
          source: nekosChoice && discordUrl
            ? 'Neko preview · Discord uses Tenor GIF'
            : discordUrl
              ? 'Chosen GIF'
              : 'Chosen · preview only',
          fallbacks,
        })
      );
    }
  }

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

  return buildResult(activity.id, {
    url: verified,
    discordUrl: resolveDiscordRpcImageUrl(activity, verified),
    source: 'GIF',
    fallbacks,
    needsAsyncResolve: true,
  });
}

/**
 * Resolve image for UI preview and Discord RPC.
 * @returns {Promise<{ url: string, discordUrl: string, source: string, fallbacks: string[], activityId: string }>}
 */
export async function resolveDiscordImageUrl(
  activity,
  { animationsEnabled = true, customDataUrl = null, bustCache = false, preferredGifUrl = null } = {}
) {
  const opts = { animationsEnabled, customDataUrl, bustCache, preferredGifUrl };
  const instant = getInstantActivityImages(activity, opts);
  if (!instant.needsAsyncResolve) return instant;

  const fallbacks = getActivityFallbackUrls(activity);
  const verified = getVerifiedFallback(activity);
  const waifuTag = getWaifuTag(activity);
  const nekosEndpoints = getNekosEndpoints(activity);

  const nekosResult = await fetchNekosWithRetry(nekosEndpoints);
  if (nekosResult) {
    const discordUrl = resolveDiscordRpcImageUrl(activity, nekosResult.url);
    return cacheResult(
      activity.id,
      buildResult(activity.id, {
        url: nekosResult.url,
        discordUrl,
        source: `nekos.best · ${nekosResult.endpoint}`,
        fallbacks,
      })
    );
  }

  if (waifuTag) {
    const waifuUrl = await fetchWaifuImage(waifuTag);
    if (waifuUrl) {
      const discordUrl = resolveDiscordRpcImageUrl(activity, waifuUrl);
      return cacheResult(
        activity.id,
        buildResult(activity.id, {
          url: waifuUrl,
          discordUrl,
          source: `waifu.pics · ${waifuTag}`,
          fallbacks,
        })
      );
    }
  }

  const discordUrl = resolveDiscordRpcImageUrl(activity, verified);
  return cacheResult(
    activity.id,
    buildResult(activity.id, {
      url: verified,
      discordUrl,
      source: 'nekos.best · fallback',
      fallbacks,
    })
  );
}

/** Alias kept for existing imports */
export const resolveActivityImage = resolveDiscordImageUrl;

/** Build fields for Discord RPC payload */
export function discordImageFields(activity, discordUrl) {
  const url = resolveDiscordRpcImageUrl(activity, discordUrl);
  return {
    largeImageUrl: url,
    discordImageUrl: url,
    fallbackGif: url,
    largeImageText: activity.largeImageText || activity.details,
  };
}
