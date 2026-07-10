import { esc } from "./api";
import type { Activity } from "./types";

/**
 * Custom activity tiles — v7-faithful card model.
 *
 * One outer card owns apply (`data-act=pick`). Favorite / delete are sibling
 * buttons (never nested inside the apply control, never covered by a full-bleed
 * pointer-events overlay). Grid click routing checks delete → fav → pick.
 */

export function customTileActions(a: Activity, favOn: boolean, isFav: boolean): string {
  const safeId = esc(a.id);
  const favLabel = isFav ? "Remove favorite" : "Add favorite";
  const del =
    a.category === "custom"
      ? `<button type="button" class="tile-del" data-act="del-custom" data-id="${safeId}" aria-label="Delete custom activity" title="Delete">×</button>`
      : "";
  return `
    <button type="button" class="tile-fav${favOn ? " on" : ""}" data-act="fav" data-id="${safeId}" aria-label="${favLabel}" title="${favLabel}">${isFav ? "★" : "☆"}</button>
    ${del}`;
}

/** Studio / Arcade / Zen visual tile — outer card is the apply target. */
export function renderVisualTile(
  a: Activity,
  opts: { active: boolean; favOn: boolean; isFav: boolean; staticTiles: boolean },
): string {
  const on = opts.active ? " on" : "";
  const color = /^#[0-9a-fA-F]{3,8}$/.test(a.color) ? a.color : "#888";
  const gif = esc(a.gif);
  const safeId = esc(a.id);
  const label = `${a.emoji} ${a.details}`.trim();
  const img = opts.staticTiles
    ? `<img data-src="${gif}" alt="" loading="lazy" decoding="async" class="tile-gif tile-still" />`
    : `<img src="${gif}" alt="" loading="lazy" decoding="async" class="tile-gif" />`;
  return `<div class="tile-wrap${on}${a.category === "custom" ? " is-custom" : ""}" style="--c:${color}" data-act="pick" data-id="${safeId}" role="button" tabindex="0" aria-label="${esc(label)}">
    <div class="tile${on}">
      ${img}
      <div class="tile-fade">
        <b>${esc(label)}</b>
        <i>${esc(a.state)}</i>
      </div>
    </div>
    ${customTileActions(a, opts.favOn, opts.isFav)}
  </div>`;
}

/** Terminal row — apply on the row; delete is a sibling, never nested. */
export function renderTerminalRow(
  a: Activity,
  opts: { active: boolean; isFav: boolean },
): string {
  const on = opts.active ? " on" : "";
  const star = opts.isFav ? "*" : " ";
  const safeId = esc(a.id);
  const del =
    a.category === "custom"
      ? `<button type="button" class="tile-del" data-act="del-custom" data-id="${safeId}" aria-label="Delete custom activity" title="Delete">×</button>`
      : "";
  return `<div class="row-wrap${on}${a.category === "custom" ? " is-custom" : ""}">
    <button type="button" class="row${on}" data-act="pick" data-id="${safeId}">
      <code>${star}${safeId}</code><span>${esc(a.emoji)} ${esc(a.details)}</span><em>${esc(a.state)}</em>
    </button>
    ${del}
  </div>`;
}

export function createEmptyCustomTile(): string {
  return `<button type="button" class="tile-create" data-act="create">＋ Create your first custom activity</button>`;
}
