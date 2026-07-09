import { api, errMsg } from "./api";

/** Shared GIF URL field + live preview for custom activities and idle GIF. */

export type GifPreviewState = {
  resolved: string | null;
  error: string | null;
  loading: boolean;
};

export function gifFieldMarkup(inputId: string, previewId: string, statusId: string): string {
  return `
    <label class="gif-field">
      <span>GIF URL</span>
      <div class="gif-field-row">
        <input id="${inputId}" placeholder="https://media.tenor.com/… or Tenor page link" spellcheck="false" />
        <button type="button" class="gif-test-btn" data-act="preview-gif" data-gif-input="${inputId}" data-gif-preview="${previewId}" data-gif-status="${statusId}">Test</button>
      </div>
    </label>
    <p class="field-hint" id="${statusId}" hidden></p>
    <div class="gif-preview" id="${previewId}" hidden>
      <img alt="GIF preview" />
      <code class="gif-resolved"></code>
    </div>
    <p class="field-hint">Paste a direct <code>media.tenor.com</code> link or any Tenor page URL — click <strong>Test</strong> to preview before saving.</p>
    <div class="gif-sources" role="group" aria-label="Find GIFs">
      <span class="gif-sources-label">Browse:</span>
      <button type="button" class="gif-source" data-act="open-gif-source" data-url="https://tenor.com/" title="Open Tenor to find GIFs">Tenor</button>
    </div>`;
}

export function resetGifPreview(root: ParentNode, previewId: string, statusId: string) {
  const preview = root.querySelector<HTMLElement>(`#${previewId}`);
  const status = root.querySelector<HTMLElement>(`#${statusId}`);
  const img = preview?.querySelector<HTMLImageElement>("img");
  const code = preview?.querySelector<HTMLElement>(".gif-resolved");
  if (preview) preview.hidden = true;
  if (img) img.removeAttribute("src");
  if (code) code.textContent = "";
  if (status) {
    status.hidden = true;
    status.textContent = "";
    status.classList.remove("err", "ok");
  }
}

export function setGifPreview(
  root: ParentNode,
  previewId: string,
  statusId: string,
  resolved: string,
) {
  const preview = root.querySelector<HTMLElement>(`#${previewId}`);
  const status = root.querySelector<HTMLElement>(`#${statusId}`);
  const img = preview?.querySelector<HTMLImageElement>("img");
  const code = preview?.querySelector<HTMLElement>(".gif-resolved");
  if (preview) preview.hidden = false;
  if (img) img.src = resolved;
  if (code) code.textContent = resolved;
  if (status) {
    status.hidden = false;
    status.textContent = "GIF resolved — looks good.";
    status.classList.remove("err");
    status.classList.add("ok");
  }
}

export function setGifPreviewError(
  root: ParentNode,
  previewId: string,
  statusId: string,
  message: string,
) {
  resetGifPreview(root, previewId, statusId);
  const status = root.querySelector<HTMLElement>(`#${statusId}`);
  if (status) {
    status.hidden = false;
    status.textContent = message;
    status.classList.remove("ok");
    status.classList.add("err");
  }
}

export async function previewGifInput(
  root: ParentNode,
  inputId: string,
  previewId: string,
  statusId: string,
): Promise<string | null> {
  const input = root.querySelector<HTMLInputElement>(`#${inputId}`);
  const raw = input?.value.trim() ?? "";
  if (!raw) {
    setGifPreviewError(root, previewId, statusId, "Enter a Tenor URL first.");
    return null;
  }
  const status = root.querySelector<HTMLElement>(`#${statusId}`);
  if (status) {
    status.hidden = false;
    status.textContent = "Resolving…";
    status.classList.remove("err", "ok");
  }
  try {
    const resolved = await api.resolveGifUrl(raw);
    setGifPreview(root, previewId, statusId, resolved);
    if (input) input.value = resolved;
    return resolved;
  } catch (e) {
    setGifPreviewError(root, previewId, statusId, errMsg(e));
    return null;
  }
}

export function resetCustomForm(root: ParentNode) {
  const set = (id: string, value: string) => {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    if (el) el.value = value;
  };
  set("caDetails", "");
  set("caState", "");
  set("caEmoji", "✨");
  set("caGif", "");
  resetGifPreview(root, "caGifPreview", "caGifStatus");
}
