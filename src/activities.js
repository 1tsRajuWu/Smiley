// Anime GIF sources via waifu.pics (free, no API key needed)
// These endpoints return direct image URLs for cute anime content
export const WAIFU_ENDPOINTS = {
  food: 'https://api.waifu.pics/sfw/neko',       // Cute neko for food
  gaming: 'https://api.waifu.pics/sfw/shinobu',  // Gaming vibes
  chill: 'https://api.waifu.pics/sfw/megumin',   // Chill vibes
  work: 'https://api.waifu.pics/sfw/awoo',       // Working hard
  social: 'https://api.waifu.pics/sfw/cry',      // Social/emotional
};

// Fallback GIF URLs (reliable hosted GIFs for each category)
export const ANIMATION_FALLBACKS = {
  food: 'https://media.tenor.com/RVvnVPK-GU8AAAAC/anime-eating.gif',
  gaming: 'https://media.tenor.com/Xy1U8f2w3xAAAAAC/anime-gaming.gif',
  chill: 'https://media.tenor.com/5QKQHH4m2xkAAAAC/anime-sleep.gif',
  work: 'https://media.tenor.com/7r-BGEoIoh4AAAAC/anime-typing.gif',
  social: 'https://media.tenor.com/1iSARpjQW0AAAAAC/anime-wave.gif',
};

/** @type {import('./activities.js').ActivityCategory[]} */
export const ACTIVITY_CATEGORIES = [
  {
    id: 'food',
    label: 'Food',
    emoji: '🍽️',
    color: '#f7768e',
    animationType: 'food',
    waifuTag: 'neko',
    fallbackGif: 'https://media.tenor.com/RVvnVPK-GU8AAAAC/anime-eating.gif',
    activities: [
      { id: 'eating-pizza', details: 'Eating', state: 'Pizza night 🍕', emoji: '🍕', largeImageKey: 'pizza', largeImageText: 'Pizza time' },
      { id: 'eating-sushi', details: 'Eating', state: 'Sushi run 🍣', emoji: '🍣', largeImageKey: 'sushi', largeImageText: 'Sushi' },
      { id: 'eating-ramen', details: 'Eating', state: 'Ramen bowl 🍜', emoji: '🍜', largeImageKey: 'ramen', largeImageText: 'Ramen' },
      { id: 'eating-burger', details: 'Eating', state: 'Burger time 🍔', emoji: '🍔', largeImageKey: 'burger', largeImageText: 'Burger' },
      { id: 'eating-tacos', details: 'Eating', state: 'Taco Tuesday 🌮', emoji: '🌮', largeImageKey: 'tacos', largeImageText: 'Tacos' },
      { id: 'eating-snacks', details: 'Snacking', state: 'Midnight munchies 🍿', emoji: '🍿', largeImageKey: 'snacks', largeImageText: 'Snacks' },
      { id: 'cooking', details: 'Cooking', state: 'Chef mode 👨‍🍳', emoji: '👨‍🍳', largeImageKey: 'cooking', largeImageText: 'Cooking' },
      { id: 'eating-dessert', details: 'Eating', state: 'Sweet tooth 🍰', emoji: '🍰', largeImageKey: 'dessert', largeImageText: 'Dessert' },
    ],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    emoji: '🎮',
    color: '#7aa2f7',
    animationType: 'gaming',
    waifuTag: 'shinobu',
    fallbackGif: 'https://media.tenor.com/Xy1U8f2w3xAAAAAC/anime-gaming.gif',
    activities: [
      { id: 'gaming', details: 'Gaming', state: 'In the zone', emoji: '🎮', largeImageKey: 'gaming', largeImageText: 'Gaming' },
      { id: 'ranked', details: 'Gaming', state: 'Ranked grind 🔥', emoji: '🔥', largeImageKey: 'ranked', largeImageText: 'Ranked' },
      { id: 'coop', details: 'Gaming', state: 'Co-op with friends', emoji: '👥', largeImageKey: 'coop', largeImageText: 'Co-op' },
      { id: 'retro', details: 'Gaming', state: 'Retro classics 🕹️', emoji: '🕹️', largeImageKey: 'retro', largeImageText: 'Retro' },
      { id: 'speedrun', details: 'Gaming', state: 'Speedrunning ⏱️', emoji: '⏱️', largeImageKey: 'speedrun', largeImageText: 'Speedrun' },
      { id: 'vr-gaming', details: 'Gaming', state: 'In VR 🥽', emoji: '🥽', largeImageKey: 'vr', largeImageText: 'VR Gaming' },
    ],
  },
  {
    id: 'chill',
    label: 'Chill',
    emoji: '😌',
    color: '#9ece6a',
    animationType: 'chill',
    waifuTag: 'megumin',
    fallbackGif: 'https://media.tenor.com/5QKQHH4m2xkAAAAC/anime-sleep.gif',
    activities: [
      { id: 'sleeping', details: 'Sleeping', state: 'Do not disturb 💤', emoji: '💤', largeImageKey: 'sleep', largeImageText: 'Sleeping' },
      { id: 'napping', details: 'Napping', state: 'Power nap mode', emoji: '😴', largeImageKey: 'nap', largeImageText: 'Napping' },
      { id: 'reading', details: 'Reading', state: 'Lost in a book 📚', emoji: '📚', largeImageKey: 'reading', largeImageText: 'Reading' },
      { id: 'listening', details: 'Listening to music', state: 'Vibing 🎧', emoji: '🎧', largeImageKey: 'music', largeImageText: 'Music' },
      { id: 'meditating', details: 'Meditating', state: 'Finding peace 🧘', emoji: '🧘', largeImageKey: 'meditate', largeImageText: 'Meditating' },
      { id: 'bath', details: 'Relaxing', state: 'Bubble bath 🛁', emoji: '🛁', largeImageKey: 'bath', largeImageText: 'Relaxing' },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    emoji: '💻',
    color: '#bb9af7',
    animationType: 'work',
    waifuTag: 'awoo',
    fallbackGif: 'https://media.tenor.com/7r-BGEoIoh4AAAAC/anime-typing.gif',
    activities: [
      { id: 'coding', details: 'Coding', state: 'Building something cool', emoji: '💻', largeImageKey: 'coding', largeImageText: 'Coding' },
      { id: 'studying', details: 'Studying', state: 'Brain gains 📖', emoji: '📖', largeImageKey: 'studying', largeImageText: 'Studying' },
      { id: 'meeting', details: 'In a meeting', state: 'Busy until further notice', emoji: '📅', largeImageKey: 'meeting', largeImageText: 'Meeting' },
      { id: 'focus', details: 'Deep focus', state: 'Heads down 🔒', emoji: '🔒', largeImageKey: 'focus', largeImageText: 'Focus mode' },
      { id: 'designing', details: 'Designing', state: 'Creating art 🎨', emoji: '🎨', largeImageKey: 'design', largeImageText: 'Designing' },
      { id: 'writing', details: 'Writing', state: 'Words flowing ✍️', emoji: '✍️', largeImageKey: 'writing', largeImageText: 'Writing' },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    emoji: '✨',
    color: '#ff9e64',
    animationType: 'social',
    waifuTag: 'cry',
    fallbackGif: 'https://media.tenor.com/1iSARpjQW0AAAAAC/anime-wave.gif',
    activities: [
      { id: 'streaming', details: 'Streaming', state: 'Live now 📺', emoji: '📺', largeImageKey: 'streaming', largeImageText: 'Streaming' },
      { id: 'watching', details: 'Watching', state: 'Movie night 🎬', emoji: '🎬', largeImageKey: 'watching', largeImageText: 'Watching' },
      { id: 'traveling', details: 'Traveling', state: 'On an adventure ✈️', emoji: '✈️', largeImageKey: 'travel', largeImageText: 'Traveling' },
      { id: 'gym', details: 'At the gym', state: 'Gains incoming 💪', emoji: '💪', largeImageKey: 'gym', largeImageText: 'Gym' },
      { id: 'partying', details: 'Partying', state: 'Living my best life 🎉', emoji: '🎉', largeImageKey: 'party', largeImageText: 'Partying' },
      { id: 'shopping', details: 'Shopping', state: 'Retail therapy 🛍️', emoji: '🛍️', largeImageKey: 'shopping', largeImageText: 'Shopping' },
    ],
  },
];

export const ALL_ACTIVITIES = ACTIVITY_CATEGORIES.flatMap((c) =>
  c.activities.map((a) => ({ ...a, category: c.id, categoryColor: c.color, animationType: c.animationType, waifuTag: c.waifuTag, fallbackGif: c.fallbackGif }))
);

// Fetch a random anime image from waifu.pics (returns { url: string })
export async function fetchWaifuImage(tag) {
  try {
    const response = await fetch(`https://api.waifu.pics/sfw/${tag}`);
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.url || null;
  } catch (e) {
    return null;
  }
}
