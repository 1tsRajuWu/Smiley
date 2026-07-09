# `src/` — Renderer (what you see)

This folder is the **Smiley window UI**: HTML, CSS, and browser JavaScript. It does **not** talk to Discord directly. It calls `window.smiley.*` (defined in `../preload.js`), which forwards requests to `../main.js`.

## Folder layout

```
src/
├── index.html          ← Page structure (header, grids, modals)
├── renderer.js         ← UI logic — clicks, search, settings (largest file)
├── styles-v2.css       ← Active theme (colors, layout)
├── styles.css          ← Legacy theme
├── styles-v1.css       ← Older theme variant
├── activities.js       ← Re-export → data/activities.js
├── discord-images.js   ← Re-export → data/discord-images.js
├── data/               ← Activity presets & GIF URLs (edit these)
│   ├── activities.js
│   ├── discord-images.js
│   └── README.md
└── assets/             ← Icons, logos, donation QR
```

## Edit order for UI features

1. **Markup** — `index.html` (new button, panel, or modal section)
2. **Behavior** — `renderer.js` (wire clicks, call `window.smiley`)
3. **Look** — `styles-v2.css`

If the feature needs disk access, Discord, or system dialogs, also update `../preload.js` and `../main.js`.

## `renderer.js` sections

Search for `// ─── Section name ───` in `renderer.js`:

| Section | What it covers |
|---------|----------------|
| DOM refs | Every `$('#...')` element handle |
| State | Selected activity, theme, update banner state |
| Activity Grid | Category tabs, activity cards, search |
| Settings | Settings modal and save |
| Initialization | `init()` — runs on page load |

Full tour: [../docs/CODE-TOUR.md](../docs/CODE-TOUR.md)

## Module imports

```js
import { ACTIVITY_CATEGORIES, ... } from './activities.js';
import { resolveDiscordImageUrl, ... } from './discord-images.js';
```

Those paths re-export from `./data/`. `index.html` loads `renderer.js` as `type="module"`.

## Mobile sync

`mobile/scripts/build-www.js` copies `data/activities.js` and `data/discord-images.js` into `mobile/www/`. Change **`src/data/`**, then:

```bash
npm run build:mobile:www
```

## Full project map

[../PROJECT-STRUCTURE.md](../PROJECT-STRUCTURE.md) · [data/README.md](data/README.md)
