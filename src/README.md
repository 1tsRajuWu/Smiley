# `src/` — Renderer (what you see)

This folder is the **Smiley window UI**: HTML, CSS, and browser JavaScript. It does **not** talk to Discord directly. It calls `window.smiley.*` (defined in `../preload.js`), which forwards requests to `../main.js`.

## Files

| File | Role |
|------|------|
| `index.html` | Page structure: header, activity list, settings modal, preview card |
| `renderer.js` | Event handlers, state, search/favorites, settings UI — **largest UI file** |
| `activities.js` | Categories and activity definitions (id, label, default image keys) |
| `discord-images.js` | GIF/image URL resolution, caches, Tenor/Giphy/nekos helpers |
| `styles-v2.css` | **Active** stylesheet (`index.html` loads this when `data-ui-version="v2"`) |
| `styles.css` | Primary legacy theme |
| `styles-v1.css` | Older theme variant |
| `assets/` | Static images: logos, in-app icons, donation QR |

## Edit order for UI features

1. **Markup** — `index.html` (new button, panel, or modal section)
2. **Behavior** — `renderer.js` (wire clicks, call `window.smiley`)
3. **Look** — `styles-v2.css`

If the feature needs disk access, Discord, or system dialogs, also update `../preload.js` and `../main.js`.

## Module imports

`renderer.js` uses ES modules:

```js
import { ACTIVITY_CATEGORIES, ... } from './activities.js';
import { resolveDiscordImageUrl, ... } from './discord-images.js';
```

`index.html` loads `renderer.js` as `type="module"`.

## Mobile sync

`mobile/scripts/build-www.js` copies relevant files from here into `mobile/www/` for the Capacitor app. Change **this** folder, then run from repo root:

```bash
npm run build:mobile:www
```

## Full project map

See [../PROJECT-STRUCTURE.md](../PROJECT-STRUCTURE.md).
