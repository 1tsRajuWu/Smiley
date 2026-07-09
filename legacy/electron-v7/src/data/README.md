# `src/data/` — Activity presets & GIF URLs

**What lives here:** the lists of activities users can pick, and the code that turns each activity into a GIF URL for Discord.

| File | What it is |
|------|------------|
| `activities.js` | Categories (Gaming, Food, …) and each activity’s title, emoji, and image keys |
| `discord-images.js` | Fetches/resolves GIFs from nekos.best, Tenor, waifu.pics, etc. |

## Newbie tips

- **Add a new built-in activity** → edit `activities.js` (find a category’s `activities: [...]` array).
- **Change default GIFs** → edit `discord-images.js` (`ACTIVITY_TENOR_FALLBACKS`, `VERIFIED_FALLBACKS`, etc.).
- **Test:** from repo root run `npm start`, pick your activity in the app.

## Imports

The UI imports through thin re-exports at the parent folder:

```js
import { ACTIVITY_CATEGORIES } from './activities.js';      // → src/data/activities.js
import { resolveDiscordImageUrl } from './discord-images.js'; // → src/data/discord-images.js
```

Mobile build (`npm run build:mobile:www`) copies the **top-level** `src/activities.js` and `src/discord-images.js` stubs into `mobile/www/`.

## Full map

[../../PROJECT-STRUCTURE.md](../../PROJECT-STRUCTURE.md) · [../README.md](../README.md)
