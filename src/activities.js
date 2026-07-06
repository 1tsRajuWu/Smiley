// Anime image APIs — see discord-images.js for resolution pipeline
export const WAIFU_TAGS = {
  food: 'neko',
  gaming: 'shinobu',
  chill: 'megumin',
  work: 'awoo',
  social: 'cry',
};

// Re-export verified GIF fallbacks (nekos.best — Tenor URLs were 404)
export { VERIFIED_FALLBACKS as FALLBACK_GIFS, fetchWaifuImage, fetchNekosBest } from './discord-images.js';

export const ACTIVITY_CATEGORIES = [
  {
    id: 'food',
    label: 'Food',
    emoji: '🍽️',
    color: '#f7768e',
    waifuTag: 'neko',
    fallbackGif: 'https://nekos.best/api/v2/nom/eaa199e9-2b86-4b15-87d1-53688e36d8ec.gif',
    activities: [
      { id: 'eating-pizza', details: 'Eating', state: 'Pizza night 🍕', emoji: '🍕', nekosEndpoint: 'feed', largeImageKey: 'pizza', largeImageText: 'Pizza time' },
      { id: 'eating-sushi', details: 'Eating', state: 'Sushi run 🍣', emoji: '🍣', nekosEndpoint: 'nom', largeImageKey: 'sushi', largeImageText: 'Sushi' },
      { id: 'eating-ramen', details: 'Eating', state: 'Ramen bowl 🍜', emoji: '🍜', nekosEndpoint: 'feed', largeImageKey: 'ramen', largeImageText: 'Ramen' },
      { id: 'eating-burger', details: 'Eating', state: 'Burger time 🍔', emoji: '🍔', nekosEndpoint: 'bite', largeImageKey: 'burger', largeImageText: 'Burger' },
      { id: 'eating-tacos', details: 'Eating', state: 'Taco Tuesday 🌮', emoji: '🌮', nekosEndpoint: 'nom', largeImageKey: 'tacos', largeImageText: 'Tacos' },
      { id: 'eating-snacks', details: 'Snacking', state: 'Midnight munchies 🍿', emoji: '🍿', nekosEndpoint: 'nom', largeImageKey: 'snacks', largeImageText: 'Snacks' },
      { id: 'cooking', details: 'Cooking', state: 'Chef mode 👨‍🍳', emoji: '👨‍🍳', nekosEndpoint: 'feed', largeImageKey: 'cooking', largeImageText: 'Cooking' },
      { id: 'eating-dessert', details: 'Eating', state: 'Sweet tooth 🍰', emoji: '🍰', nekosEndpoint: 'bite', largeImageKey: 'dessert', largeImageText: 'Dessert' },
    ],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    emoji: '🎮',
    color: '#7aa2f7',
    waifuTag: 'shinobu',
    fallbackGif: 'https://nekos.best/api/v2/yeet/ae4dda45-2175-4576-b957-58dcc1362284.gif',
    activities: [
      { id: 'gaming', details: 'Gaming', state: 'In the zone', emoji: '🎮', nekosEndpoint: 'yeet', largeImageKey: 'gaming', largeImageText: 'Gaming' },
      { id: 'ranked', details: 'Gaming', state: 'Ranked grind 🔥', emoji: '🔥', nekosEndpoint: 'yeet', largeImageKey: 'ranked', largeImageText: 'Ranked' },
      { id: 'coop', details: 'Gaming', state: 'Co-op with friends', emoji: '👥', nekosEndpoint: 'hug', largeImageKey: 'coop', largeImageText: 'Co-op' },
      { id: 'retro', details: 'Gaming', state: 'Retro classics 🕹️', emoji: '🕹️', nekosEndpoint: 'dance', largeImageKey: 'retro', largeImageText: 'Retro' },
      { id: 'speedrun', details: 'Gaming', state: 'Speedrunning ⏱️', emoji: '⏱️', nekosEndpoint: 'yeet', largeImageKey: 'speedrun', largeImageText: 'Speedrun' },
      { id: 'vr-gaming', details: 'Gaming', state: 'In VR 🥽', emoji: '🥽', nekosEndpoint: 'dance', largeImageKey: 'vr', largeImageText: 'VR Gaming' },
    ],
  },
  {
    id: 'chill',
    label: 'Chill',
    emoji: '😌',
    color: '#9ece6a',
    waifuTag: 'megumin',
    fallbackGif: 'https://nekos.best/api/v2/sleep/611a318f-1645-48f4-9cc0-099eb8d817d9.gif',
    activities: [
      { id: 'sleeping', details: 'Sleeping', state: 'Do not disturb 💤', emoji: '💤', nekosEndpoint: 'sleep', largeImageKey: 'sleep', largeImageText: 'Sleeping' },
      { id: 'napping', details: 'Napping', state: 'Power nap mode', emoji: '😴', nekosEndpoint: 'sleep', largeImageKey: 'nap', largeImageText: 'Napping' },
      { id: 'reading', details: 'Reading', state: 'Lost in a book 📚', emoji: '📚', nekosEndpoint: 'smile', largeImageKey: 'reading', largeImageText: 'Reading' },
      { id: 'listening', details: 'Listening to music', state: 'Vibing 🎧', emoji: '🎧', nekosEndpoint: 'dance', largeImageKey: 'music', largeImageText: 'Music' },
      { id: 'meditating', details: 'Meditating', state: 'Finding peace 🧘', emoji: '🧘', nekosEndpoint: 'smile', largeImageKey: 'meditate', largeImageText: 'Meditating' },
      { id: 'bath', details: 'Relaxing', state: 'Bubble bath 🛁', emoji: '🛁', nekosEndpoint: 'happy', largeImageKey: 'bath', largeImageText: 'Relaxing' },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    emoji: '💻',
    color: '#bb9af7',
    waifuTag: 'awoo',
    fallbackGif: 'https://nekos.best/api/v2/bored/82f8fec0-d651-4905-a739-5917d728f89f.gif',
    activities: [
      { id: 'coding', details: 'Coding', state: 'Building something cool', emoji: '💻', preferWaifu: true, waifuTag: 'awoo', largeImageKey: 'coding', largeImageText: 'Coding' },
      { id: 'studying', details: 'Studying', state: 'Brain gains 📖', emoji: '📖', nekosEndpoint: 'bored', largeImageKey: 'studying', largeImageText: 'Studying' },
      { id: 'meeting', details: 'In a meeting', state: 'Busy until further notice', emoji: '📅', nekosEndpoint: 'wave', largeImageKey: 'meeting', largeImageText: 'Meeting' },
      { id: 'focus', details: 'Deep focus', state: 'Heads down 🔒', emoji: '🔒', nekosEndpoint: 'bored', largeImageKey: 'focus', largeImageText: 'Focus mode' },
      { id: 'designing', details: 'Designing', state: 'Creating art 🎨', emoji: '🎨', nekosEndpoint: 'smile', largeImageKey: 'design', largeImageText: 'Designing' },
      { id: 'writing', details: 'Writing', state: 'Words flowing ✍️', emoji: '✍️', nekosEndpoint: 'bored', largeImageKey: 'writing', largeImageText: 'Writing' },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    emoji: '✨',
    color: '#ff9e64',
    waifuTag: 'cry',
    fallbackGif: 'https://nekos.best/api/v2/wave/e6f276a8-11f1-4ad0-b1e0-3fa91678e2f4.gif',
    activities: [
      { id: 'streaming', details: 'Streaming', state: 'Live now 📺', emoji: '📺', nekosEndpoint: 'wave', largeImageKey: 'streaming', largeImageText: 'Streaming' },
      { id: 'watching', details: 'Watching', state: 'Movie night 🎬', emoji: '🎬', nekosEndpoint: 'happy', largeImageKey: 'watching', largeImageText: 'Watching' },
      { id: 'traveling', details: 'Traveling', state: 'On an adventure ✈️', emoji: '✈️', nekosEndpoint: 'wave', largeImageKey: 'travel', largeImageText: 'Traveling' },
      { id: 'gym', details: 'At the gym', state: 'Gains incoming 💪', emoji: '💪', nekosEndpoint: 'yeet', largeImageKey: 'gym', largeImageText: 'Gym' },
      { id: 'partying', details: 'Partying', state: 'Living my best life 🎉', emoji: '🎉', nekosEndpoint: 'dance', largeImageKey: 'party', largeImageText: 'Partying' },
      { id: 'shopping', details: 'Shopping', state: 'Retail therapy 🛍️', emoji: '🛍️', nekosEndpoint: 'happy', largeImageKey: 'shopping', largeImageText: 'Shopping' },
    ],
  },
];

export const ALL_ACTIVITIES = ACTIVITY_CATEGORIES.flatMap((c) =>
  c.activities.map((a) => ({
    ...a,
    category: c.id,
    categoryColor: c.color,
    waifuTag: a.waifuTag || c.waifuTag,
    fallbackGif: a.fallbackGif || c.fallbackGif,
  }))
);
