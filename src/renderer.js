import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORIES_WITH_CUSTOM, CUSTOM_CATEGORY, ALL_ACTIVITIES } from './activities.js';
import {
  resolveDiscordImageUrl,
  discordImageFields,
  getActivityFallbackUrls,
  getTenorFallback,
  getActivityGifOptions,
  resolveGifChoiceUrl,
  getDefaultGifChoiceId,
  clearActivityImageCacheEntry,
  isValidDiscordImageUrl,
  isNekosBestUrl,
  fetchNekosGifForActivity,
} from './discord-images.js';

const DONATION_URL = 'https://paypal.me/1tsRaj';
const GITHUB_RELEASES_URL = 'https://github.com/1tsRajuWu/Smiley/releases/latest';
const UPI_ID = 'therajind.07@oksbi';
const UPI_NAME = 'Himanshu Raj (R A J)';

const $ = (sel) => document.querySelector(sel);

// ─── DOM refs ────────────────────────────────────────────────────────
const connectionPill = $('#connectionPill');
const connectionText = $('#connectionText');
const previewCard = $('#previewCard');
const previewEmoji = $('#previewEmoji');
const previewGif = $('#previewGif');
const previewDetails = $('#previewDetails');
const previewState = $('#previewState');
const timerText = $('#timerText');
const clearBtn = $('#clearBtn');
const copyBtn = $('#copyBtn');
const categoryTabs = $('#categoryTabs');
const activityGrid = $('#activityGrid');
const gifPickerSection = $('#gifPickerSection');
const gifPickerStrip = $('#gifPickerStrip');
const gifPickerMyGifs = $('#gifPickerMyGifs');
const gifPickerMyStrip = $('#gifPickerMyStrip');
const searchInput = $('#searchInput');
const settingsBtn = $('#settingsBtn');
const minimizeBtn = $('#minimizeBtn');
const maximizeBtn = $('#maximizeBtn');
const closeWindowBtn = $('#closeWindowBtn');
const windowControls = $('#windowControls');
const settingsModal = $('#settingsModal');
const saveSettingsBtn = $('#saveSettingsBtn');
const closeSettings = $('#closeSettings');
const donateBanner = $('#donateBanner');
const donatePaypalBtn = $('#donatePaypalBtn');
const donateUpiBtn = $('#donateUpiBtn');
const donateUpiQrBtn = $('#donateUpiQrBtn');
const upiQrModal = $('#upiQrModal');
const closeUpiQr = $('#closeUpiQr');
const supportUpiCopyBtn = $('#supportUpiCopyBtn');
const aboutUpiCopyBtn = $('#aboutUpiCopyBtn');
const aboutUpiQrBtn = $('#aboutUpiQrBtn');
const toastContainer = $('#toastContainer');
const characterGif = $('#characterGif');
const characterLoading = $('#characterLoading');
const characterLabel = $('#characterLabel');
const characterSource = $('#characterSource');
const characterRetry = $('#characterRetry');
const appEl = $('#app');
const footerVersion = $('#footerVersion');
const aboutVersion = $('#aboutVersion');
const legalModal = $('#legalModal');
const legalTitle = $('#legalTitle');
const legalBody = $('#legalBody');
const closeLegal = $('#closeLegal');
const tosLink = $('#tosLink');
const privacyLink = $('#privacyLink');
const licenseLink = $('#licenseLink');
const legalInfoLink = $('#legalInfoLink');
const footerLicense = $('#footerLicense');
const footerTos = $('#footerTos');
const footerPrivacy = $('#footerPrivacy');
const bugReportLink = $('#bugReportLink');
const bugReportEmailLink = $('#bugReportEmailLink');
const reviewLink = $('#reviewLink');
const footerBugReport = $('#footerBugReport');
const footerReview = $('#footerReview');
const footerShortcuts = $('#footerShortcuts');

// Wallpaper settings refs
const uploadWallpaperBtn = $('#uploadWallpaperBtn');
const resetWallpaperBtn = $('#resetWallpaperBtn');
const wallpaperBlurSlider = $('#wallpaperBlurSlider');
const wallpaperDimSlider = $('#wallpaperDimSlider');
const wallpaperBlurValue = $('#wallpaperBlurValue');
const wallpaperDimValue = $('#wallpaperDimValue');
const wallpaperPreview = $('#wallpaperPreview');
const wallpaperPreviewThumb = $('#wallpaperPreviewThumb');
const wallpaperPreviewName = $('#wallpaperPreviewName');

// Settings refs
const settingsTabs = document.querySelectorAll('.settings-tab');
const settingsPanels = document.querySelectorAll('.settings-panel');
const autoConnectToggle = $('#autoConnectToggle');
const minimizeTrayToggle = $('#minimizeTrayToggle');
const autoCheckUpdatesToggle = $('#autoCheckUpdatesToggle');
const autoInstallUpdatesToggle = $('#autoInstallUpdatesToggle');
const showTimerToggle = $('#showTimerToggle');
const animationsToggle = $('#animationsToggle');
const themeOptions = document.querySelectorAll('.theme-option');
const customAnimationDrop = $('#customAnimationDrop');
const customAnimationList = $('#customAnimationList');
const launchAtLoginToggle = $('#launchAtLoginToggle');
const hotkeyToggle = $('#hotkeyToggle');
const hotkeyHint = $('#hotkeyHint');
const exportSettingsBtn = $('#exportSettingsBtn');
const importSettingsBtn = $('#importSettingsBtn');
const resetWindowBtn = $('#resetWindowBtn');
const updateBanner = $('#updateBanner');
const updateBannerText = $('#updateBannerText');
const updateRestartBtn = $('#updateRestartBtn');
const updateDismissBtn = $('#updateDismissBtn');
const recentSection = $('#recentSection');
const recentChips = $('#recentChips');
const sessionBadge = $('#sessionBadge');

// Create activity modal refs
const createActivityModal = $('#createActivityModal');
const closeCreateActivity = $('#closeCreateActivity');
const cancelCreateActivity = $('#cancelCreateActivity');
const saveCreateActivity = $('#saveCreateActivity');
const createActivityTitle = $('#createActivityTitle');
const customActivityDetails = $('#customActivityDetails');
const customActivityState = $('#customActivityState');
const customActivityEmoji = $('#customActivityEmoji');
const customActivityGifUrl = $('#customActivityGifUrl');
const resolveGifBtn = $('#resolveGifBtn');
const pickActivityGifBtn = $('#pickActivityGifBtn');
const gifUrlPanel = $('#gifUrlPanel');
const gifUploadPanel = $('#gifUploadPanel');
const customActivityGifPreview = $('#customActivityGifPreview');
const customActivityGifPreviewImg = $('#customActivityGifPreviewImg');
const customActivitiesSettingsList = $('#customActivitiesSettingsList');
const gifSourceTabs = document.querySelectorAll('.gif-source-tab');

// ─── State ───────────────────────────────────────────────────────────
let activeCategory = ACTIVITY_CATEGORIES[0].id;
let selectedActivityId = null;
let sessionStart = null;
let timerInterval = null;
let searchQuery = '';
let currentSettings = {};
let customAnimations = [];
let activeCustomAnimation = null;
let currentGifUrl = null;
let currentDiscordImageUrl = null;
let updateState = { downloaded: false, dismissed: false, percent: 0, version: null };
let releasesUrl = GITHUB_RELEASES_URL;
let macAdHocUpdates = false;
let searchDebounceTimer = null;
let recentActivities = [];
let favoriteIds = [];
let gifLoadGeneration = 0;
let lastGifActivityId = null;
let wallpaperSettings = { filename: null, blur: 0, dim: 0 };
let isMacPlatform = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
let customActivitiesConfig = [];
let activityGifChoices = {};
let createActivityDraft = {
  editingId: null,
  gifSource: 'url',
  resolvedGifUrl: null,
  localFileName: null,
  previewUrl: null,
  keepGifUrl: false,
  keepLocalFile: false,
};

// ─── Custom activity helpers ─────────────────────────────────────────
function customConfigToActivity(ca) {
  const httpsUrl = isValidDiscordImageUrl(ca.gifUrl) ? ca.gifUrl : null;
  const localUrl = ca.localGifPath || null;
  const previewUrl = httpsUrl || localUrl;
  return {
    id: ca.id,
    details: ca.details,
    state: ca.state || '',
    emoji: ca.emoji || '✨',
    category: 'custom',
    categoryColor: CUSTOM_CATEGORY.color,
    isCustom: true,
    gifUrl: ca.gifUrl || null,
    previewUrl,
    localGifPath: localUrl,
    largeImageText: ca.details,
    fallbackGif: httpsUrl || previewUrl,
  };
}

function getAllActivitiesMerged() {
  return [...ALL_ACTIVITIES, ...customActivitiesConfig.map(customConfigToActivity)];
}

function findActivity(id) {
  return getAllActivitiesMerged().find((a) => a.id === id) || null;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Helpers ─────────────────────────────────────────────────────────
function formatShortcutHint(mac = isMacPlatform) {
  if (mac) return '⌘1–6 categories · ⌘K search · Esc clear';
  return 'Ctrl+1–6 categories · Ctrl+K search · Esc clear';
}

function updateFooterShortcuts(mac = isMacPlatform) {
  if (footerShortcuts) footerShortcuts.textContent = formatShortcutHint(mac);
}

function applyPlatformUI(cfg = {}) {
  let osPlatform = cfg.osPlatform;
  if (!osPlatform && typeof cfg.isMac === 'boolean') {
    osPlatform = cfg.isMac ? 'darwin' : 'win32';
  }
  if (!osPlatform && cfg.platform) {
    osPlatform = String(cfg.platform).split(' ')[0];
  }
  if (osPlatform) document.body.dataset.platform = osPlatform;
  if (typeof cfg.isMac === 'boolean') isMacPlatform = cfg.isMac;
  if (typeof cfg.macAdHocUpdates === 'boolean') macAdHocUpdates = cfg.macAdHocUpdates;
  if (cfg.releasesUrl) releasesUrl = cfg.releasesUrl;
  updateFooterShortcuts(isMacPlatform);
  if (minimizeBtn) minimizeBtn.hidden = isMacPlatform;
  if (windowControls) windowControls.hidden = isMacPlatform;
  document.body.classList.toggle('has-window-controls', !isMacPlatform);
}

async function copyUpiId() {
  try {
    const result = await window.smiley.copyText(UPI_ID);
    if (result?.success) showToast('UPI ID copied');
    else showToast('Could not copy UPI ID', 'error');
  } catch {
    showToast('Could not copy UPI ID', 'error');
  }
}

function openUpiQrModal() {
  if (!upiQrModal) return;
  if (!upiQrModal.open) upiQrModal.showModal();
}

function syncMaximizeButton(isMaximized) {
  if (!maximizeBtn) return;
  maximizeBtn.textContent = isMaximized ? '❐' : '□';
  maximizeBtn.title = isMaximized ? 'Restore' : 'Maximize';
  maximizeBtn.setAttribute('aria-label', isMaximized ? 'Restore window' : 'Maximize window');
}

function showToast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  const duration = type === 'subtle' ? 2200 : 3000;
  const fadeDelay = duration - 300;
  setTimeout(() => el.remove(), duration);
  if (type === 'subtle') {
    el.style.animation = `toastIn 0.3s ease, toastOut 0.3s ease ${fadeDelay}ms forwards`;
  }
}

function showUpdateActionToast(message, { label = 'Download from GitHub', url = releasesUrl } = {}) {
  const el = document.createElement('div');
  el.className = 'toast error toast-with-action';
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-ghost toast-action-btn';
  btn.textContent = label;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.smiley.openExternal(url);
    el.remove();
  });
  el.appendChild(btn);
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 12000);
}

function setConnectionStatus(connected, error) {
  connectionPill.classList.remove('connected', 'error');
  if (connected) {
    connectionPill.classList.add('connected');
    connectionText.textContent = 'Connected to Discord';
  } else if (error) {
    connectionPill.classList.add('error');
    connectionText.textContent = error;
  } else {
    connectionText.textContent = 'Disconnected';
  }
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function startTimer(start) {
  sessionStart = start;
  if (timerInterval) clearInterval(timerInterval);
  if (!start) {
    timerText.textContent = '0:00';
    if (sessionBadge) sessionBadge.hidden = true;
    return;
  }
  const tick = () => {
    const elapsed = Date.now() - sessionStart;
    timerText.textContent = formatElapsed(elapsed);
    if (sessionBadge) {
      const mins = Math.floor(elapsed / 60000);
      sessionBadge.hidden = mins < 1;
      if (mins >= 60) sessionBadge.textContent = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      else if (mins >= 1) sessionBadge.textContent = `${mins}m session`;
    }
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}

function resolveChoiceToUrl(activityId, choiceId) {
  if (!choiceId) return null;
  if (choiceId.startsWith('custom-anim:')) {
    const name = choiceId.slice(12);
    const anim = customAnimations.find((a) => a.name === name);
    return anim?.dataUrl || null;
  }
  if (choiceId.startsWith('custom:')) {
    const url = choiceId.slice(7);
    return url || null;
  }
  return resolveGifChoiceUrl(activityId, choiceId);
}

function getSavedGifChoiceId(activity) {
  if (!activity) return null;
  const saved = activityGifChoices[activity.id];
  if (saved) return saved;
  if (activity.isCustom && isValidDiscordImageUrl(activity.gifUrl)) {
    return `custom:${activity.gifUrl}`;
  }
  return getDefaultGifChoiceId(activity.id);
}

function getPreferredGifUrl(activity) {
  if (!activity) return null;
  const saved = activityGifChoices[activity.id];
  if (!saved) return null;
  return resolveChoiceToUrl(activity.id, saved);
}

function collectMyGifs() {
  const seen = new Set();
  const items = [];

  for (const ca of customActivitiesConfig) {
    if (isValidDiscordImageUrl(ca.gifUrl) && !seen.has(ca.gifUrl)) {
      seen.add(ca.gifUrl);
      items.push({
        id: `custom:${ca.gifUrl}`,
        label: `${ca.emoji || '✨'} ${ca.details}`,
        url: ca.gifUrl,
        previewOnly: false,
      });
    }
  }

  for (const anim of customAnimations) {
    if (!anim?.dataUrl || seen.has(anim.dataUrl)) continue;
    seen.add(anim.dataUrl);
    items.push({
      id: `custom-anim:${anim.name}`,
      label: anim.name,
      url: anim.dataUrl,
      previewOnly: !isValidDiscordImageUrl(anim.dataUrl),
    });
  }

  return items;
}

function renderGifOptionButton(option, selectedId) {
  const selected = option.id === selectedId;
  const previewOnly = option.previewOnly ? ' preview-only' : '';
  const fallbackAttr = option.fallbackUrl
    ? ` data-fallback-url="${escapeHtml(option.fallbackUrl)}"`
    : '';
  const nekosAttr = isNekosBestUrl(option.url) ? ' referrerpolicy="no-referrer"' : '';
  return `
    <button type="button" class="gif-option${selected ? ' selected' : ''}${previewOnly}"
      role="option" aria-selected="${selected}" data-choice="${escapeHtml(option.id)}"${fallbackAttr}
      title="${escapeHtml(option.label)}${option.previewOnly ? ' (app preview only)' : ''}">
      <span class="gif-option-thumb">
        <img src="${escapeHtml(option.url)}" alt="" loading="lazy" decoding="async"${nekosAttr} />
      </span>
      <span class="gif-option-label">${escapeHtml(option.label)}</span>
    </button>`;
}

function bindGifPickerThumbFallbacks(strip) {
  if (!strip) return;
  strip.querySelectorAll('.gif-option-thumb img').forEach((img) => {
    const btn = img.closest('.gif-option');
    const fallback = btn?.dataset?.fallbackUrl;
    if (!fallback) return;
    img.addEventListener('error', () => {
      if (img.dataset.fallbackTried === '1') return;
      img.dataset.fallbackTried = '1';
      img.src = fallback;
    }, { once: false });
  });
}

async function refreshNekosPickerThumbs(activity) {
  if (!activity?.id) return;
  const strips = [gifPickerStrip, gifPickerMyStrip].filter(Boolean);
  for (const strip of strips) {
    const nekoOptions = strip.querySelectorAll('.gif-option[data-choice$="-nekos"], .gif-option img[src*="nekos.best"]');
    for (const node of nekoOptions) {
      const btn = node.classList?.contains('gif-option') ? node : node.closest('.gif-option');
      if (!btn) continue;
      const img = btn.querySelector('img');
      if (!img || img.dataset.nekosRefreshed === '1') continue;
      const fresh = await fetchNekosGifForActivity(activity.id, img.getAttribute('src') || img.src);
      if (!fresh || selectedActivityId !== activity.id) continue;
      img.dataset.nekosRefreshed = '1';
      img.src = fresh;
    }
  }
}

function bindGifPickerStrip(strip, activity, onSelect) {
  if (!strip) return;
  strip.querySelectorAll('.gif-option').forEach((btn) => {
    const handler = () => onSelect(activity.id, btn.dataset.choice);
    btn.addEventListener('click', handler);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}

function renderGifPicker(activity) {
  if (!gifPickerSection || !gifPickerStrip) return;

  if (!activity) {
    gifPickerSection.hidden = true;
    gifPickerStrip.innerHTML = '';
    if (gifPickerMyStrip) gifPickerMyStrip.innerHTML = '';
    if (gifPickerMyGifs) gifPickerMyGifs.hidden = true;
    return;
  }

  const presetOptions = getActivityGifOptions(activity.id);
  if (activity.isCustom && isValidDiscordImageUrl(activity.gifUrl)) {
    const hasOwn = presetOptions.some((o) => o.url === activity.gifUrl);
    if (!hasOwn) {
      presetOptions.unshift({
        id: `custom:${activity.gifUrl}`,
        label: 'Activity GIF',
        url: activity.gifUrl,
      });
    }
  }

  const selectedId = getSavedGifChoiceId(activity);
  gifPickerSection.hidden = presetOptions.length === 0 && collectMyGifs().length === 0;
  gifPickerStrip.innerHTML = presetOptions.map((o) => renderGifOptionButton(o, selectedId)).join('');

  const myGifs = collectMyGifs().filter(
    (g) => !presetOptions.some((p) => p.url === g.url || p.id === g.id)
  );
  if (gifPickerMyGifs && gifPickerMyStrip) {
    if (myGifs.length) {
      gifPickerMyGifs.hidden = false;
      gifPickerMyStrip.innerHTML = myGifs.map((o) => renderGifOptionButton(o, selectedId)).join('');
      bindGifPickerStrip(gifPickerMyStrip, activity, onGifOptionSelect);
    } else {
      gifPickerMyGifs.hidden = true;
      gifPickerMyStrip.innerHTML = '';
    }
  }

  bindGifPickerStrip(gifPickerStrip, activity, onGifOptionSelect);
  bindGifPickerThumbFallbacks(gifPickerStrip);
  bindGifPickerThumbFallbacks(gifPickerMyStrip);
  refreshNekosPickerThumbs(activity);
}

async function onGifOptionSelect(activityId, choiceId) {
  if (!activityId || !choiceId) return;
  activityGifChoices = { ...activityGifChoices, [activityId]: choiceId };
  await window.smiley.saveConfig({ activityGifChoice: activityGifChoices });

  const activity = findActivity(activityId);
  if (!activity || selectedActivityId !== activityId) return;

  clearActivityImageCacheEntry(activityId);
  renderGifPicker(activity);

  const resolved = await applyActivityGif(activity, { bustCache: true });
  if (!resolved || selectedActivityId !== activityId) return;

  if (choiceId.startsWith('custom-anim:') && !isValidDiscordImageUrl(resolved.discordUrl)) {
    showToast('Custom upload shows in Smiley — add HTTPS URL for Discord', 'error');
  }

  const rpcPayload = buildRpcPayload(activity, resolved.discordUrl);
  const result = await window.smiley.setActivity(rpcPayload, false);
  if (result?.error) showToast(result.error, 'error');
  else if (result?.queued) showToast('GIF updated (rate limited)', 'success');
}

async function resolveGifUrl(activity, { bustCache = false } = {}) {
  let preferredGifUrl = getPreferredGifUrl(activity);
  const choiceId = activityGifChoices[activity?.id];
  const wantsNekos = choiceId?.endsWith('-nekos') || isNekosBestUrl(preferredGifUrl);
  if (wantsNekos && activity?.id) {
    const fresh = await fetchNekosGifForActivity(activity.id, preferredGifUrl);
    if (fresh) preferredGifUrl = fresh;
  }
  const { url, discordUrl, source, fallbacks } = await resolveDiscordImageUrl(activity, {
    animationsEnabled: currentSettings.animationsEnabled,
    customDataUrl: activeCustomAnimation,
    bustCache,
    preferredGifUrl,
  });
  return { url, discordUrl, source, fallbacks };
}

function clearGifDisplay() {
  characterGif.classList.remove('character-gif-loaded');
  characterGif.removeAttribute('src');
  previewGif.classList.remove('loaded');
  previewGif.removeAttribute('src');
  if (characterRetry) characterRetry.hidden = true;
}

/** Load an <img> through a URL chain — hidden display:none blocks browser fetch. */
function loadImageWithFallback(img, urls, { onSuccess, onFail, generation } = {}) {
  const queue = [...new Set(urls.filter(Boolean))];
  let index = 0;

  const tryNext = () => {
    if (generation !== undefined && generation !== gifLoadGeneration) return;
    if (index >= queue.length) {
      onFail?.();
      return;
    }
    const nextUrl = queue[index++];
    const onLoad = () => {
      if (generation !== undefined && generation !== gifLoadGeneration) return;
      onSuccess?.(nextUrl);
    };
    const onError = () => {
      if (generation !== undefined && generation !== gifLoadGeneration) return;
      tryNext();
    };
    img.onload = onLoad;
    img.onerror = onError;
    img.loading = 'eager';
    img.decoding = 'async';
    img.src = nextUrl;
    if (img.complete && img.naturalWidth > 0) onLoad();
  };

  tryNext();
}

function setCharacterDisplay(url, source, fallbackUrls = [], { generation, activity } = {}) {
  if (characterRetry) characterRetry.hidden = true;

  if (!url && !fallbackUrls.length) {
    characterLoading.style.display = 'none';
    characterGif.classList.remove('character-gif-loaded');
    characterGif.removeAttribute('src');
    characterSource.textContent = '';
    return;
  }

  characterGif.classList.remove('character-gif-loaded');
  characterLoading.style.display = 'flex';

  loadImageWithFallback(characterGif, [url, ...fallbackUrls], {
    generation,
    onSuccess: () => {
      characterLoading.style.display = 'none';
      characterGif.classList.add('character-gif-loaded');
      characterSource.textContent = source;
      if (characterRetry) characterRetry.hidden = true;
    },
    onFail: () => {
      characterLoading.style.display = 'none';
      characterGif.classList.remove('character-gif-loaded');
      characterSource.textContent = source ? `${source} · failed to load` : 'Image failed to load';
      if (characterRetry && activity) {
        characterRetry.hidden = false;
        characterRetry.onclick = () => retryActivityGif(activity);
      }
    },
  });
  if (source) characterSource.textContent = source;
}

function setPreviewDisplay(activity, gifUrl, fallbackUrls = [], { generation } = {}) {
  if (!activity) {
    previewCard.classList.remove('active');
    previewCard.style.removeProperty('--card-glow');
    previewEmoji.textContent = '😊';
    previewEmoji.style.display = '';
    previewGif.classList.remove('loaded');
    previewGif.removeAttribute('src');
    previewDetails.textContent = 'Pick an activity';
    previewState.textContent = 'Your status appears here';
    clearBtn.disabled = true;
    if (copyBtn) copyBtn.disabled = true;
    startTimer(null);
    return;
  }

  const category = ACTIVITY_CATEGORIES_WITH_CUSTOM.find((c) => c.id === activity.category)
    || ACTIVITY_CATEGORIES.find((c) => c.id === activity.category);
  previewCard.classList.add('active');
  previewCard.style.setProperty('--card-glow', `${category?.color || '#7aa2f7'}33`);

  previewDetails.textContent = activity.details;
  previewState.textContent = activity.state || '';
  clearBtn.disabled = false;
  if (copyBtn) copyBtn.disabled = false;

  if (gifUrl && currentSettings.animationsEnabled !== false) {
    previewEmoji.style.display = 'none';
    previewGif.classList.remove('loaded');
    loadImageWithFallback(previewGif, [gifUrl, ...fallbackUrls], {
      generation,
      onSuccess: () => {
        previewGif.classList.add('loaded');
        previewEmoji.style.display = 'none';
      },
      onFail: () => {
        previewGif.classList.remove('loaded');
        previewGif.removeAttribute('src');
        previewEmoji.textContent = activity.emoji;
        previewEmoji.style.display = '';
      },
    });
  } else {
    previewGif.classList.remove('loaded');
    previewGif.removeAttribute('src');
    previewEmoji.textContent = activity.emoji;
    previewEmoji.style.display = '';
  }
}

function setCharacterLabel(activity) {
  if (!activity) {
    characterLabel.textContent = 'Pick an activity';
    return;
  }
  characterLabel.textContent = `${activity.emoji} ${activity.state || activity.details}`;
}

async function applyActivityGif(activity, { bustCache = false } = {}) {
  if (!activity) return null;

  const generation = ++gifLoadGeneration;
  lastGifActivityId = activity.id;
  clearGifDisplay();
  characterLoading.style.display = 'flex';

  try {
    const resolved = await resolveGifUrl(activity, { bustCache });
    if (selectedActivityId !== activity.id || generation !== gifLoadGeneration) return null;

    currentGifUrl = resolved.url;
    currentDiscordImageUrl = resolved.discordUrl;
    setPreviewDisplay(activity, resolved.url, resolved.fallbacks, { generation });
    setCharacterDisplay(resolved.url, resolved.source, resolved.fallbacks, { generation, activity });
    return resolved;
  } catch {
    if (selectedActivityId === activity.id && generation === gifLoadGeneration) {
      characterLoading.style.display = 'none';
      if (characterRetry) {
        characterRetry.hidden = false;
        characterRetry.onclick = () => retryActivityGif(activity);
      }
    }
    return null;
  }
}

/** @deprecated use applyActivityGif */
async function loadActivityGif(activity, opts = {}) {
  return applyActivityGif(activity, opts);
}

async function retryActivityGif(activity) {
  if (!activity) return;
  clearActivityImageCacheEntry(activity.id);
  const resolved = await applyActivityGif(activity, { bustCache: true });
  if (resolved?.discordUrl && selectedActivityId === activity.id) {
    const rpcPayload = buildRpcPayload(activity, resolved.discordUrl);
    window.smiley.setActivity(rpcPayload, false).catch(() => {});
  }
}

function buildRpcPayload(activity, discordUrl) {
  if (activity?.isCustom) {
    const imageUrl = discordUrl || (isValidDiscordImageUrl(activity.gifUrl) ? activity.gifUrl : null);
    const fields = imageUrl ? discordImageFields(activity, imageUrl) : {};
    return {
      id: activity.id,
      details: activity.details,
      state: activity.state,
      category: activity.category,
      ...fields,
    };
  }
  const imageUrl =
    discordUrl ||
    getTenorFallback(activity) ||
    getActivityFallbackUrls(activity)[0] ||
    null;
  const imageFields = discordImageFields(activity, imageUrl);
  return {
    id: activity.id,
    details: activity.details,
    state: activity.state,
    category: activity.category,
    ...imageFields,
  };
}

async function updatePreview(activity) {
  if (!activity) {
    setPreviewDisplay(null);
    setCharacterDisplay(null, '');
    setCharacterLabel(null);
    clearGifDisplay();
    currentGifUrl = null;
    currentDiscordImageUrl = null;
    renderGifPicker(null);
    return;
  }

  renderGifPicker(activity);
  await applyActivityGif(activity);
}

// ─── Activity Grid ───────────────────────────────────────────────────
function renderCategoryTabs() {
  categoryTabs.innerHTML = ACTIVITY_CATEGORIES_WITH_CUSTOM.map(
    (cat) => `
    <button class="category-tab${cat.id === activeCategory ? ' active' : ''}" data-category="${cat.id}"
      style="${cat.id === activeCategory ? `--tab-color: ${cat.color}` : ''}" role="tab" aria-selected="${cat.id === activeCategory}">
      ${cat.emoji} ${cat.label}
    </button>
  `
  ).join('');

  categoryTabs.querySelectorAll('.category-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      searchQuery = '';
      searchInput.value = '';
      renderCategoryTabs();
      renderActivityGrid();
    });
  });
}

function sortWithFavorites(activities) {
  if (!favoriteIds.length || searchQuery.trim()) return activities;
  const favSet = new Set(favoriteIds);
  const favs = favoriteIds
    .map((id) => activities.find((a) => a.id === id))
    .filter(Boolean);
  const rest = activities.filter((a) => !favSet.has(a.id));
  return [...favs, ...rest];
}

function renderRecentChips() {
  if (!recentChips || !recentSection) return;
  const items = (recentActivities || []).slice(0, 5);
  if (!items.length) {
    recentSection.hidden = true;
    return;
  }
  recentSection.hidden = false;
  recentChips.innerHTML = items
    .map((item) => {
      const act = findActivity(item.id);
      const emoji = act?.emoji || '⭐';
      return `<button type="button" class="quick-chip" data-id="${item.id}" title="${escapeHtml(item.state || item.details)}">${emoji} ${escapeHtml(item.details)}</button>`;
    })
    .join('');
  recentChips.querySelectorAll('.quick-chip').forEach((chip) => {
    chip.addEventListener('click', () => selectActivity(chip.dataset.id));
  });
}

function getFilteredActivities() {
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    return getAllActivitiesMerged().filter(
      (a) => a.details.toLowerCase().includes(q) || a.state?.toLowerCase().includes(q) || a.emoji.includes(q)
    );
  }
  if (activeCategory === 'custom') {
    const list = customActivitiesConfig.map(customConfigToActivity);
    return sortWithFavorites(list);
  }
  const cat = ACTIVITY_CATEGORIES.find((c) => c.id === activeCategory);
  const list = cat ? cat.activities.map((a) => ({ ...a, category: cat.id, categoryColor: cat.color })) : [];
  return sortWithFavorites(list);
}

function renderActivityGrid() {
  const activities = getFilteredActivities();
  const showCreateCard = activeCategory === 'custom' && !searchQuery.trim();
  const isEmpty = activities.length === 0 && !showCreateCard;

  if (isEmpty) {
    activityGrid.innerHTML = '<div class="empty-state">No activities match your search</div>';
    return;
  }

  const cardsHtml = activities
    .map(
      (a, i) => {
        const isFav = favoriteIds.includes(a.id);
        const customActions = a.isCustom
          ? `<div class="activity-custom-actions">
              <button type="button" class="activity-custom-btn" data-edit="${a.id}" title="Edit">Edit</button>
              <button type="button" class="activity-custom-btn danger" data-delete="${a.id}" title="Delete">Delete</button>
            </div>`
          : '';
        return `
    <div class="activity-card${a.id === selectedActivityId ? ' selected' : ''}${isFav ? ' favorited' : ''}${a.isCustom ? ' is-custom' : ''}" data-id="${a.id}" role="button" tabindex="0"
      style="--card-accent: ${a.categoryColor || '#7aa2f7'}; animation-delay: ${i * 30}ms">
      <button type="button" class="activity-fav${isFav ? ' active' : ''}" data-fav="${a.id}" title="${isFav ? 'Unpin' : 'Pin'}">${isFav ? '★' : '☆'}</button>
      <span class="activity-emoji">${a.emoji}</span>
      <span class="activity-name">${escapeHtml(a.details)}</span>
      <span class="activity-state">${escapeHtml(a.state || '')}</span>
      ${customActions}
    </div>
  `;
      }
    )
    .join('');

  const createCardHtml = showCreateCard
    ? `<div class="activity-card is-create-card" data-create="true" role="button" tabindex="0" style="--card-accent: ${CUSTOM_CATEGORY.color}">
        <span class="activity-emoji">＋</span>
        <span class="activity-name">Create activity</span>
        <span class="activity-state">Add your own GIF</span>
      </div>`
    : '';

  activityGrid.innerHTML = cardsHtml + createCardHtml;

  activityGrid.querySelectorAll('.activity-fav').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      favoriteIds = await window.smiley.toggleFavorite(btn.dataset.fav);
      renderActivityGrid();
    });
  });

  activityGrid.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCreateActivityModal(btn.dataset.edit);
    });
  });

  activityGrid.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleDeleteCustomActivity(btn.dataset.delete);
    });
  });

  const createCard = activityGrid.querySelector('[data-create="true"]');
  if (createCard) {
    const openCreate = () => openCreateActivityModal();
    createCard.addEventListener('click', openCreate);
    createCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCreate();
      }
    });
  }

  activityGrid.querySelectorAll('.activity-card:not(.is-create-card)').forEach((card) => {
    card.addEventListener('click', () => selectActivity(card.dataset.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectActivity(card.dataset.id);
      }
    });
  });
}

async function selectActivity(id) {
  const activity = findActivity(id);
  if (!activity) return;

  const isReselect = selectedActivityId === id;
  selectedActivityId = id;
  renderActivityGrid();

  clearGifDisplay();
  setCharacterLabel(activity);
  setPreviewDisplay(activity, null);
  characterLoading.style.display = 'flex';
  renderGifPicker(activity);

  const resolved = await applyActivityGif(activity);
  if (!resolved || selectedActivityId !== id) return;

  if (activity.isCustom && !resolved.discordUrl) {
    showToast('Uploaded GIF shows in Smiley only — add a HTTPS GIF URL for Discord', 'error');
  }

  const rpcPayload = buildRpcPayload(activity, resolved.discordUrl);
  const result = await window.smiley.setActivity(rpcPayload, !isReselect);

  if (result?.error) {
    showToast(result.error, 'error');
    setConnectionStatus(false, result.error);
  } else if (result?.queued) {
    showToast('Update queued (Discord rate limit)', 'success');
  } else if (result?.success !== false) {
    showToast(`Status set: ${activity.details}`);
    if (!isReselect) startTimer(Date.now());
  }
}

async function handleCopy() {
  const activity = selectedActivityId ? findActivity(selectedActivityId) : null;
  if (!activity) return;
  const text = activity.state ? `${activity.details} — ${activity.state}` : activity.details;
  const result = await window.smiley.copyText(text);
  if (result?.success) showToast('Copied to clipboard');
  else showToast('Copy failed', 'error');
}

async function handleClear() {
  await window.smiley.clearActivity();
  selectedActivityId = null;
  renderActivityGrid();
  renderGifPicker(null);
  await updatePreview(null);
  showToast('Status cleared');
}

// ─── Settings ────────────────────────────────────────────────────────
function openSettings(tab = 'general') {
  window.smiley.getConfig().then((cfg) => {
    currentSettings = { ...cfg };
    autoConnectToggle.checked = cfg.autoConnect !== false;
    minimizeTrayToggle.checked = cfg.minimizeToTray !== false;
    if (autoCheckUpdatesToggle) autoCheckUpdatesToggle.checked = cfg.autoCheckUpdates !== false;
    if (autoInstallUpdatesToggle) autoInstallUpdatesToggle.checked = cfg.autoInstallUpdates !== false;
    showTimerToggle.checked = cfg.showTimer !== false;
    animationsToggle.checked = cfg.animationsEnabled !== false;
    if (launchAtLoginToggle) launchAtLoginToggle.checked = cfg.launchAtLogin === true;
    if (hotkeyToggle) hotkeyToggle.checked = cfg.hotkeyEnabled !== false;
    if (hotkeyHint && cfg.hotkey) hotkeyHint.textContent = `Shortcut: ${cfg.hotkey.replace('CommandOrControl', 'Cmd/Ctrl')}`;

    applyPlatformUI(cfg);

    wallpaperSettings = {
      filename: cfg.customWallpaper?.filename || null,
      blur: Number(cfg.customWallpaper?.blur) || 0,
      dim: Number(cfg.customWallpaper?.dim) || 0,
    };
    syncWallpaperControls();

    themeOptions.forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.theme === (cfg.theme || 'dark'));
    });

    switchSettingsTab(tab);
    loadCustomAnimationsList();
    renderCustomActivitiesSettingsList();

    if (cfg.version) {
      footerVersion.textContent = `Smiley v${cfg.version}`;
      if (aboutVersion) aboutVersion.textContent = `Smiley v${cfg.version}`;
    }

    settingsModal.showModal();
  });
}

function switchSettingsTab(tabId) {
  settingsTabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tabId));
  settingsPanels.forEach((p) => p.classList.toggle('active', p.dataset.panel === tabId));
}

async function handleSaveSettings(e) {
  if (e) e.preventDefault();

  const newSettings = {
    autoConnect: autoConnectToggle.checked,
    minimizeToTray: minimizeTrayToggle.checked,
    autoCheckUpdates: autoCheckUpdatesToggle?.checked !== false,
    autoInstallUpdates: autoInstallUpdatesToggle?.checked !== false,
    showTimer: showTimerToggle.checked,
    animationsEnabled: animationsToggle.checked,
    theme: currentSettings.theme || 'dark',
    customAnimation: activeCustomAnimation ? 'custom' : null,
    launchAtLogin: launchAtLoginToggle?.checked === true,
    hotkeyEnabled: hotkeyToggle?.checked !== false,
    customWallpaper: wallpaperSettings.filename
      ? { filename: wallpaperSettings.filename, blur: wallpaperSettings.blur, dim: wallpaperSettings.dim }
      : null,
  };

  const result = await window.smiley.saveConfig(newSettings);
  settingsModal.close();

  applyTheme(newSettings.theme);
  await applyWallpaper(wallpaperSettings);

  const timerEl = $('#previewTimer');
  if (timerEl) timerEl.style.display = newSettings.showTimer !== false ? '' : 'none';

  if (result?.connected) {
    setConnectionStatus(true);
    showToast('Connected to Discord!');
  } else {
    setConnectionStatus(false, result?.error || 'Connection failed');
    if (result?.error) showToast(result.error, 'error');
  }
}

const DARK_UI_THEMES = new Set([
  'dark', 'midnight', 'ocean', 'sakura', 'lowlight', 'sunset',
  'forest', 'lavender', 'cyber', 'coffee', 'rose',
]);

const brandLogoImg = $('#brandLogoImg');
const aboutLogoImg = $('#aboutLogoImg');

function prefersDarkScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isDarkUI() {
  const theme = appEl?.dataset?.theme || 'dark';
  return DARK_UI_THEMES.has(theme);
}

function updateBrandIcon() {
  const useLightIcon = isDarkUI() || prefersDarkScheme();
  const src = useLightIcon ? 'assets/icon-light.png' : 'assets/icon-dark.png';
  if (brandLogoImg) brandLogoImg.src = src;
  if (aboutLogoImg) aboutLogoImg.src = src;
}

function applyTheme(theme) {
  appEl.dataset.theme = theme || 'dark';
  currentSettings.theme = theme || 'dark';
  updateBrandIcon();
}

async function applyWallpaper(wallpaper = wallpaperSettings) {
  wallpaperSettings = {
    filename: wallpaper?.filename || null,
    blur: Number(wallpaper?.blur) || 0,
    dim: Number(wallpaper?.dim) || 0,
  };

  if (!wallpaperSettings.filename) {
    document.body.classList.remove('has-wallpaper');
    document.body.style.removeProperty('--wallpaper-url');
    document.body.style.removeProperty('--wallpaper-blur');
    document.body.style.removeProperty('--wallpaper-dim');
    return;
  }

  try {
    const result = await window.smiley.getWallpaperPath(wallpaperSettings.filename);
    if (!result?.url) {
      document.body.classList.remove('has-wallpaper');
      return;
    }
    document.body.classList.add('has-wallpaper');
    document.body.style.setProperty('--wallpaper-url', `url("${result.url}")`);
    document.body.style.setProperty('--wallpaper-blur', `${wallpaperSettings.blur}px`);
    document.body.style.setProperty('--wallpaper-dim', String(wallpaperSettings.dim / 100));
  } catch (err) {
    console.error('Failed to apply wallpaper:', err);
  }
}

function syncWallpaperControls() {
  const hasWallpaper = !!wallpaperSettings.filename;
  if (wallpaperBlurSlider) {
    wallpaperBlurSlider.disabled = !hasWallpaper;
    wallpaperBlurSlider.value = String(wallpaperSettings.blur);
  }
  if (wallpaperDimSlider) {
    wallpaperDimSlider.disabled = !hasWallpaper;
    wallpaperDimSlider.value = String(wallpaperSettings.dim);
  }
  if (wallpaperBlurValue) wallpaperBlurValue.textContent = String(wallpaperSettings.blur);
  if (wallpaperDimValue) wallpaperDimValue.textContent = String(wallpaperSettings.dim);
  if (resetWallpaperBtn) resetWallpaperBtn.hidden = !hasWallpaper;
  if (wallpaperPreview) wallpaperPreview.hidden = !hasWallpaper;
  if (hasWallpaper && wallpaperPreviewName) {
    wallpaperPreviewName.textContent = wallpaperSettings.filename;
  }
  if (hasWallpaper && wallpaperPreviewThumb) {
    window.smiley.getWallpaperPath(wallpaperSettings.filename).then((result) => {
      if (result?.url) wallpaperPreviewThumb.style.backgroundImage = `url("${result.url}")`;
    });
  } else if (wallpaperPreviewThumb) {
    wallpaperPreviewThumb.style.backgroundImage = '';
  }
}

async function handleUploadWallpaper() {
  const result = await window.smiley.pickWallpaper();
  if (result?.canceled) return;
  if (result?.error) {
    showToast(result.error, 'error');
    return;
  }
  if (!result?.filename) return;

  const oldFilename = wallpaperSettings.filename;
  wallpaperSettings = {
    filename: result.filename,
    blur: wallpaperSettings.blur || 0,
    dim: wallpaperSettings.dim || 0,
  };
  if (oldFilename && oldFilename !== result.filename) {
    await window.smiley.deleteWallpaper(oldFilename);
  }
  syncWallpaperControls();
  await applyWallpaper(wallpaperSettings);
  showToast('Wallpaper uploaded');
}

async function handleResetWallpaper() {
  if (wallpaperSettings.filename) {
    await window.smiley.deleteWallpaper(wallpaperSettings.filename);
  }
  wallpaperSettings = { filename: null, blur: 0, dim: 0 };
  syncWallpaperControls();
  await applyWallpaper(wallpaperSettings);
  showToast('Wallpaper reset');
}

// ─── Custom Activities (create / edit) ───────────────────────────────
function resetCreateActivityDraft() {
  createActivityDraft = {
    editingId: null,
    gifSource: 'url',
    resolvedGifUrl: null,
    localFileName: null,
    previewUrl: null,
    keepGifUrl: false,
    keepLocalFile: false,
  };
}

function setGifSourceTab(source) {
  createActivityDraft.gifSource = source;
  gifSourceTabs.forEach((tab) => {
    const active = tab.dataset.source === source;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (gifUrlPanel) gifUrlPanel.hidden = source !== 'url';
  if (gifUploadPanel) gifUploadPanel.hidden = source !== 'upload';
}

function showGifPreview(url) {
  if (!url || !customActivityGifPreview || !customActivityGifPreviewImg) return;
  customActivityGifPreview.hidden = false;
  customActivityGifPreviewImg.src = url;
}

function hideGifPreview() {
  if (customActivityGifPreview) customActivityGifPreview.hidden = true;
  if (customActivityGifPreviewImg) customActivityGifPreviewImg.removeAttribute('src');
}

function openCreateActivityModal(editId = null) {
  resetCreateActivityDraft();
  if (customActivityDetails) customActivityDetails.value = '';
  if (customActivityState) customActivityState.value = '';
  if (customActivityEmoji) customActivityEmoji.value = '✨';
  if (customActivityGifUrl) customActivityGifUrl.value = '';
  hideGifPreview();
  setGifSourceTab('url');

  if (editId) {
    const existing = customActivitiesConfig.find((a) => a.id === editId);
    if (!existing) return;
    createActivityDraft.editingId = editId;
    createActivityDraft.keepGifUrl = Boolean(existing.gifUrl);
    createActivityDraft.keepLocalFile = Boolean(existing.localFileName);
    createActivityDraft.resolvedGifUrl = existing.gifUrl || null;
    createActivityDraft.localFileName = existing.localFileName || null;
    createActivityDraft.previewUrl = existing.gifUrl || existing.localGifPath || null;
    if (createActivityTitle) createActivityTitle.textContent = '✏️ Edit Activity';
    if (customActivityDetails) customActivityDetails.value = existing.details;
    if (customActivityState) customActivityState.value = existing.state || '';
    if (customActivityEmoji) customActivityEmoji.value = existing.emoji || '✨';
    if (existing.gifUrl && customActivityGifUrl) customActivityGifUrl.value = existing.gifUrl;
    if (existing.localFileName) setGifSourceTab('upload');
    if (createActivityDraft.previewUrl) showGifPreview(createActivityDraft.previewUrl);
  } else if (createActivityTitle) {
    createActivityTitle.textContent = '✨ Create Activity';
  }

  if (createActivityModal) createActivityModal.showModal();
}

async function handleResolveGifPreview() {
  const raw = customActivityGifUrl?.value?.trim();
  if (!raw) {
    showToast('Paste a GIF URL first', 'error');
    return;
  }
  const result = await window.smiley.resolveGifUrl(raw);
  if (!result?.success) {
    showToast(result?.error || 'Could not resolve URL', 'error');
    return;
  }
  createActivityDraft.resolvedGifUrl = result.url;
  createActivityDraft.keepGifUrl = false;
  showGifPreview(result.url);
  showToast('GIF preview loaded');
}

async function handlePickActivityGif() {
  const result = await window.smiley.pickCustomActivityGif();
  if (result.canceled) return;
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }
  createActivityDraft.localFileName = result.fileName;
  createActivityDraft.previewUrl = result.previewUrl;
  createActivityDraft.keepLocalFile = false;
  showGifPreview(result.previewUrl);
  showToast('File ready — add a URL too for Discord');
}

async function handleSaveCustomActivity() {
  const details = customActivityDetails?.value?.trim();
  if (!details) {
    showToast('Title is required', 'error');
    customActivityDetails?.focus();
    return;
  }

  const payload = {
    id: createActivityDraft.editingId || undefined,
    details,
    state: customActivityState?.value?.trim() || '',
    emoji: customActivityEmoji?.value?.trim() || '✨',
  };

  if (createActivityDraft.gifSource === 'url') {
    const rawUrl = customActivityGifUrl?.value?.trim();
    if (rawUrl) payload.gifUrl = rawUrl;
  }

  if (createActivityDraft.localFileName) {
    payload.localFileName = createActivityDraft.localFileName;
  }

  if (createActivityDraft.editingId) {
    if (!payload.gifUrl && createActivityDraft.keepGifUrl) payload.keepGifUrl = true;
    if (!payload.localFileName && createActivityDraft.keepLocalFile) payload.keepLocalFile = true;
  }

  if (!payload.gifUrl && !payload.localFileName && !payload.keepGifUrl && !payload.keepLocalFile) {
    showToast('Add a GIF URL or upload a file', 'error');
    return;
  }

  const result = await window.smiley.saveCustomActivity(payload);
  if (!result?.success) {
    showToast(result?.error || 'Could not save activity', 'error');
    return;
  }

  customActivitiesConfig = await window.smiley.getCustomActivities();
  if (createActivityModal?.open) createActivityModal.close();
  activeCategory = 'custom';
  renderCategoryTabs();
  renderActivityGrid();
  renderCustomActivitiesSettingsList();
  showToast(createActivityDraft.editingId ? 'Activity updated' : 'Activity created');
}

async function handleDeleteCustomActivity(id) {
  const existing = customActivitiesConfig.find((a) => a.id === id);
  if (!existing) return;
  const result = await window.smiley.deleteCustomActivity(id);
  if (!result?.success) {
    showToast(result?.error || 'Delete failed', 'error');
    return;
  }
  customActivitiesConfig = await window.smiley.getCustomActivities();
  if (selectedActivityId === id) {
    selectedActivityId = null;
    await updatePreview(null);
  }
  renderActivityGrid();
  renderRecentChips();
  renderCustomActivitiesSettingsList();
  showToast('Activity deleted');
}

async function loadCustomActivitiesConfig() {
  try {
    customActivitiesConfig = (await window.smiley.getCustomActivities()) || [];
  } catch {
    customActivitiesConfig = [];
  }
}

function renderCustomActivitiesSettingsList() {
  if (!customActivitiesSettingsList) return;
  if (!customActivitiesConfig.length) {
    customActivitiesSettingsList.innerHTML = '<p class="field-hint">No custom activities yet — use the <strong>My Activities</strong> tab to create one.</p>';
    return;
  }
  customActivitiesSettingsList.innerHTML = customActivitiesConfig
    .map((ca) => {
      const thumb = ca.gifUrl || ca.localGifPath || '';
      const thumbHtml = thumb
        ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />`
        : '<span style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">✨</span>';
      return `
      <div class="custom-activity-settings-item" data-id="${escapeHtml(ca.id)}">
        ${thumbHtml}
        <div class="meta">
          <strong>${escapeHtml(ca.emoji)} ${escapeHtml(ca.details)}</strong>
          <span>${escapeHtml(ca.state || '')}${ca.gifUrl ? '' : ' · preview only'}</span>
        </div>
        <button type="button" class="btn-delete" data-delete-settings="${escapeHtml(ca.id)}" title="Delete">🗑️</button>
      </div>`;
    })
    .join('');

  customActivitiesSettingsList.querySelectorAll('[data-delete-settings]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await handleDeleteCustomActivity(btn.dataset.deleteSettings);
    });
  });
}

// ─── Custom Animations ───────────────────────────────────────────────
async function loadCustomAnimationsList() {
  try {
    const list = await window.smiley.getCustomAnimations();
    customAnimations = list || [];
    renderCustomAnimationsList();
  } catch (err) {
    console.error('Failed to load custom animations:', err);
  }
}

function renderCustomAnimationsList() {
  if (!customAnimations.length) {
    customAnimationList.innerHTML = '';
    return;
  }

  customAnimationList.innerHTML = customAnimations
    .map(
      (anim) => `
    <div class="custom-animation-item${anim.dataUrl === activeCustomAnimation ? ' active' : ''}" data-name="${anim.name}">
      <img src="${anim.dataUrl}" alt="${anim.name}" loading="lazy" />
      <span>${anim.name}</span>
      <button class="btn-delete" data-name="${anim.name}" title="Delete">🗑️</button>
    </div>
  `
    )
    .join('');

  customAnimationList.querySelectorAll('.custom-animation-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete')) return;
      const name = item.dataset.name;
      const anim = customAnimations.find((a) => a.name === name);
      if (anim) {
        activeCustomAnimation = anim.dataUrl;
        renderCustomAnimationsList();
        const activity = selectedActivityId ? findActivity(selectedActivityId) : null;
        if (activity) updatePreview(activity);
        showToast('Custom animation selected!');
      }
    });
  });

  customAnimationList.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = btn.dataset.name;
      const result = await window.smiley.deleteCustomAnimation(name);
      if (result.success) {
        if (activeCustomAnimation && customAnimations.find((a) => a.name === name)?.dataUrl === activeCustomAnimation) {
          activeCustomAnimation = null;
          const activity = selectedActivityId ? findActivity(selectedActivityId) : null;
          if (activity) updatePreview(activity);
          else updatePreview(null);
        }
        await loadCustomAnimationsList();
        showToast('Animation deleted');
      }
    });
  });
}

async function handleUploadAnimation() {
  const result = await window.smiley.pickCustomAnimation();
  if (result.canceled) return;
  if (result.error) { showToast(result.error, 'error'); return; }
  activeCustomAnimation = result.dataUrl;
  await loadCustomAnimationsList();
  const activity = selectedActivityId ? findActivity(selectedActivityId) : null;
  if (activity) updatePreview(activity);
  showToast('Custom animation uploaded!');
}

function setupDragDrop() {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    customAnimationDrop.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
  });
  ['dragenter', 'dragover'].forEach((eventName) => {
    customAnimationDrop.addEventListener(eventName, () => customAnimationDrop.classList.add('drag-over'));
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    customAnimationDrop.addEventListener(eventName, () => customAnimationDrop.classList.remove('drag-over'));
  });
  customAnimationDrop.addEventListener('click', handleUploadAnimation);
}

// ─── Bug Report ──────────────────────────────────────────────────────
const BUG_REPORT_REPO = 'https://github.com/1tsRajuWu/Smiley/issues/new';

function buildBugReportBody(version, platform) {
  return [
    `**Version:** ${version}`,
    `**OS / Platform:** ${platform}`,
    '',
    '**Steps to reproduce:**',
    '1. ',
    '',
    '**Expected behavior:**',
    '',
    '**Actual behavior:**',
    '',
  ].join('\n');
}

function buildBugReportUrl(version, platform) {
  const params = new URLSearchParams({
    template: 'bug_report.md',
    labels: 'bug',
    body: buildBugReportBody(version, platform),
  });
  return `${BUG_REPORT_REPO}?${params}`;
}

function buildBugReportEmailUrl(version, platform) {
  const subject = encodeURIComponent(`Smiley Bug Report (v${version})`);
  const body = encodeURIComponent(buildBugReportBody(version, platform));
  return `mailto:1tsRajuWu@users.noreply.github.com?subject=${subject}&body=${body}`;
}

async function openBugReport() {
  const cfg = await window.smiley.getConfig();
  const version = cfg.version || 'unknown';
  const platform = cfg.platform || navigator.userAgent;
  window.smiley.openExternal(buildBugReportUrl(version, platform));
}

async function openBugReportEmail() {
  const cfg = await window.smiley.getConfig();
  const version = cfg.version || 'unknown';
  const platform = cfg.platform || navigator.userAgent;
  window.smiley.openExternal(buildBugReportEmailUrl(version, platform));
}

// ─── Review / Feedback ───────────────────────────────────────────────
const REVIEW_REPO = 'https://github.com/1tsRajuWu/Smiley/issues/new';

function buildReviewBody(version, platform) {
  return [
    '**Rating (1–5 stars):**',
    '⭐⭐⭐⭐⭐',
    '',
    '**What you like:**',
    '',
    '**Suggestions / ideas:**',
    '',
    `**Smiley version:** ${version}`,
    `**OS:** ${platform}`,
    '',
  ].join('\n');
}

function buildReviewUrl(version, platform) {
  const params = new URLSearchParams({
    template: 'review.md',
    labels: 'review',
    body: buildReviewBody(version, platform),
  });
  return `${REVIEW_REPO}?${params}`;
}

async function openReview() {
  const cfg = await window.smiley.getConfig();
  const version = cfg.version || 'unknown';
  const platform = cfg.platform || navigator.userAgent;
  window.smiley.openExternal(buildReviewUrl(version, platform));
}

// ─── Legal Modal ─────────────────────────────────────────────────────
async function showLegal(type) {
  const titles = {
    license: 'License Agreement',
    tos: 'Terms of Service',
    privacy: 'Privacy Policy',
    legal: 'Legal Information',
  };
  const files = {
    license: '../LICENSE',
    tos: '../ToS.md',
    privacy: '../PRIVACY.md',
    legal: '../LEGAL.md',
  };
  legalTitle.textContent = titles[type] || 'Legal';
  legalBody.innerHTML = '<p>Loading...</p>';
  legalModal.showModal();
  try {
    const res = await fetch(files[type]);
    const text = await res.text();
    if (type === 'license') {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      legalBody.innerHTML = `<div class="legal-content"><pre class="legal-plain">${escaped}</pre></div>`;
      return;
    }
    let html = text
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    if (html.includes('|')) {
      const lines = html.split('<br>');
      const processed = lines.map((line) => {
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          const cells = line.split('|').filter((c) => c.trim());
          if (cells.length >= 2 && !cells[0].includes('---')) {
            return `<tr>${cells.map((c) => `<td>${c.trim()}</td>`).join('')}</tr>`;
          }
          return '';
        }
        return line;
      });
      html = processed.join('<br>');
      html = html.replace(/(<tr>.*?<\/tr>)+/g, (match) => `<table>${match}</table>`);
    }
    legalBody.innerHTML = `<div class="legal-content">${html}</div>`;
  } catch (e) {
    legalBody.innerHTML = '<p>Failed to load legal document.</p>';
  }
}

// ─── Update Status ───────────────────────────────────────────────────
function hideUpdateBanner() {
  updateBanner?.classList.remove('visible');
}

function isUpdateSignatureError(msg) {
  const lower = String(msg || '').toLowerCase();
  return (
    lower.includes('code signature') ||
    lower.includes('did not pass validation') ||
    lower.includes('code requirement') ||
    lower.includes('satisfy specified code requirement') ||
    lower.includes('signature verification') ||
    lower.includes('not signed')
  );
}

function buildManualUpdateMessage(version) {
  return version
    ? `Update couldn't install automatically. Download v${version} from GitHub.`
    : "Update couldn't install automatically. Download the latest version from GitHub.";
}

function syncUpdateBannerButtons() {
  if (!updateRestartBtn) return;
  const macManual = macAdHocUpdates && updateState.downloaded;
  updateRestartBtn.disabled = !updateState.downloaded && !macManual;
  if (macManual) {
    updateRestartBtn.textContent = 'Get update';
    updateRestartBtn.title =
      'Download the DMG from GitHub (auto-restart unavailable on unsigned Mac builds)';
  } else {
    updateRestartBtn.textContent = 'Restart';
    updateRestartBtn.title = updateState.downloaded
      ? 'Restart to install update'
      : 'Available after download completes';
  }
}

function handleUpdateStatus(data) {
  switch (data.status) {
    case 'checking':
      if (data.silent) showToast('Checking for updates...', 'subtle');
      else showToast('Checking for updates...');
      break;
    case 'dev-mode':
      showToast(data.message || 'Updates are only available in installed releases.');
      break;
    case 'no-release':
      showToast(data.message || 'No release on GitHub yet — open github.com/1tsRajuWu/Smiley/releases');
      break;
    case 'available':
      updateState = { downloaded: false, dismissed: false, percent: 0, version: data.version || null };
      syncUpdateBannerButtons();
      showToast(`Update v${data.version} available! Downloading...`);
      if (updateBannerText) updateBannerText.textContent = `Downloading v${data.version}… 0%`;
      updateBanner?.classList.add('visible');
      break;
    case 'downloading':
      updateState.downloaded = false;
      updateState.percent = data.percent ?? updateState.percent;
      if (updateState.dismissed) break;
      if (updateBannerText) {
        const pct = updateState.percent;
        const ver = data.version ? `v${data.version}` : 'update';
        updateBannerText.textContent =
          pct >= 99 ? `Finishing download of ${ver}…` : `Downloading ${ver}… ${pct}%`;
      }
      updateBanner?.classList.add('visible');
      syncUpdateBannerButtons();
      break;
    case 'up-to-date':
      if (data.silent) break;
      hideUpdateBanner();
      showToast('You are on the latest version!');
      break;
    case 'downloaded':
      updateState.downloaded = true;
      updateState.percent = 100;
      updateState.dismissed = false;
      updateState.version = data.version || updateState.version;
      syncUpdateBannerButtons();
      if (updateBannerText) {
        if (macAdHocUpdates) {
          updateBannerText.textContent = `Update v${data.version} ready — download from GitHub`;
        } else {
          updateBannerText.textContent = `Update v${data.version} ready — restart to apply`;
        }
      }
      updateBanner?.classList.add('visible');
      if (macAdHocUpdates) {
        showToast(`Update v${data.version} ready — use Get update to download the DMG.`);
      } else {
        showToast(`Update v${data.version} ready! Restart to apply.`);
      }
      break;
    case 'download-stalled':
      updateState = { downloaded: false, dismissed: true, percent: 0, version: null };
      syncUpdateBannerButtons();
      hideUpdateBanner();
      showToast(data.error || 'Update download stalled. Try again later.', 'error');
      break;
    case 'unsigned-update':
    case 'manual-install-required':
      updateState = { downloaded: false, dismissed: true, percent: 0, version: data.version || null };
      syncUpdateBannerButtons();
      hideUpdateBanner();
      showUpdateActionToast(
        data.message ||
          `Update couldn't install automatically. Download ${data.version ? `v${data.version}` : 'the latest version'} from GitHub.`,
        { url: data.releasesUrl || releasesUrl }
      );
      break;
    case 'error':
      updateState = { downloaded: false, dismissed: false, percent: 0, version: data.version || null };
      syncUpdateBannerButtons();
      hideUpdateBanner();
      if (data.expected) {
        showToast(data.message || data.error || 'Update check unavailable.');
      } else if (isUpdateSignatureError(String(data.error || ''))) {
        showUpdateActionToast(
          buildManualUpdateMessage(data.version),
          { url: data.releasesUrl || releasesUrl }
        );
      } else {
        showUpdateActionToast(
          data.error
            ? `Update failed. ${buildManualUpdateMessage(data.version)}`
            : buildManualUpdateMessage(data.version),
          { url: data.releasesUrl || releasesUrl }
        );
      }
      break;
  }
}

function setupModalClose(dialog, closeBtn) {
  if (!dialog) return;
  if (closeBtn) {
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dialog.open) dialog.close();
    });
  }
  dialog.addEventListener('click', (e) => {
    const content = dialog.querySelector('.modal-content');
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const clickedBackdrop =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (clickedBackdrop && dialog.open) dialog.close();
  });
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    dialog.close();
  });
}

// ─── Initialization ──────────────────────────────────────────────────
async function init() {
  renderCategoryTabs();
  renderActivityGrid();

  settingsBtn.addEventListener('click', () => openSettings('general'));
  if (minimizeBtn) minimizeBtn.addEventListener('click', () => window.smiley.minimizeWindow());
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', async () => {
      const result = await window.smiley.maximizeWindow();
      if (typeof result?.isMaximized === 'boolean') syncMaximizeButton(result.isMaximized);
    });
  }
  if (closeWindowBtn) closeWindowBtn.addEventListener('click', () => window.smiley.closeWindow());
  if (window.smiley.onWindowMaximized) {
    window.smiley.onWindowMaximized((isMaximized) => syncMaximizeButton(isMaximized));
    window.smiley.isWindowMaximized?.().then((max) => syncMaximizeButton(!!max));
  }
  setupModalClose(settingsModal, closeSettings);
  setupModalClose(legalModal, closeLegal);
  setupModalClose(createActivityModal, closeCreateActivity);
  setupModalClose(upiQrModal, closeUpiQr);
  if (cancelCreateActivity) cancelCreateActivity.addEventListener('click', () => createActivityModal?.close());
  if (saveCreateActivity) saveCreateActivity.addEventListener('click', handleSaveCustomActivity);
  if (resolveGifBtn) resolveGifBtn.addEventListener('click', handleResolveGifPreview);
  if (pickActivityGifBtn) pickActivityGifBtn.addEventListener('click', handlePickActivityGif);
  gifSourceTabs.forEach((tab) => {
    tab.addEventListener('click', () => setGifSourceTab(tab.dataset.source));
  });
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', handleSaveSettings);
  clearBtn.addEventListener('click', handleClear);
  if (copyBtn) copyBtn.addEventListener('click', handleCopy);

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key >= '1' && e.key <= '6') {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      const cat = ACTIVITY_CATEGORIES_WITH_CUSTOM[idx];
      if (cat) {
        activeCategory = cat.id;
        searchQuery = '';
        searchInput.value = '';
        renderCategoryTabs();
        renderActivityGrid();
      }
      return;
    }
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    if (e.key === 'Escape') {
      if (document.activeElement === searchInput && searchInput.value) {
        searchQuery = '';
        searchInput.value = '';
        renderActivityGrid();
        searchInput.blur();
      } else if (selectedActivityId) {
        handleClear();
      }
    }
  });

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = e.target.value;
      renderActivityGrid();
    }, 200);
  });

  settingsTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
  });

  themeOptions.forEach((opt) => {
    opt.addEventListener('click', () => {
      themeOptions.forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
      currentSettings.theme = opt.dataset.theme;
      applyTheme(opt.dataset.theme);
    });
  });

  setupDragDrop();

  if (uploadWallpaperBtn) uploadWallpaperBtn.addEventListener('click', handleUploadWallpaper);
  if (resetWallpaperBtn) resetWallpaperBtn.addEventListener('click', handleResetWallpaper);
  if (wallpaperBlurSlider) {
    wallpaperBlurSlider.addEventListener('input', () => {
      wallpaperSettings.blur = Number(wallpaperBlurSlider.value) || 0;
      if (wallpaperBlurValue) wallpaperBlurValue.textContent = String(wallpaperSettings.blur);
      applyWallpaper(wallpaperSettings);
    });
  }
  if (wallpaperDimSlider) {
    wallpaperDimSlider.addEventListener('input', () => {
      wallpaperSettings.dim = Number(wallpaperDimSlider.value) || 0;
      if (wallpaperDimValue) wallpaperDimValue.textContent = String(wallpaperSettings.dim);
      applyWallpaper(wallpaperSettings);
    });
  }

  donateBanner?.addEventListener('click', (e) => e.preventDefault());
  if (donatePaypalBtn) {
    donatePaypalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.smiley.openExternal(DONATION_URL);
    });
  }
  if (donateUpiBtn) {
    donateUpiBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyUpiId();
    });
  }
  if (donateUpiQrBtn) {
    donateUpiQrBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openUpiQrModal();
    });
  }
  if (supportUpiCopyBtn) supportUpiCopyBtn.addEventListener('click', () => copyUpiId());
  if (aboutUpiCopyBtn) aboutUpiCopyBtn.addEventListener('click', () => copyUpiId());
  if (aboutUpiQrBtn) aboutUpiQrBtn.addEventListener('click', () => openUpiQrModal());
  const upiQrCopyBtn = $('#upiQrCopyBtn');
  if (upiQrCopyBtn) upiQrCopyBtn.addEventListener('click', () => copyUpiId());

  document.querySelectorAll('.about-link[href^="http"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.smiley.openExternal(link.href);
    });
  });

  if (licenseLink) licenseLink.addEventListener('click', (e) => { e.preventDefault(); showLegal('license'); });
  if (legalInfoLink) legalInfoLink.addEventListener('click', (e) => { e.preventDefault(); showLegal('legal'); });
  if (tosLink) tosLink.addEventListener('click', (e) => { e.preventDefault(); showLegal('tos'); });
  if (privacyLink) privacyLink.addEventListener('click', (e) => { e.preventDefault(); showLegal('privacy'); });
  if (footerLicense) footerLicense.addEventListener('click', (e) => { e.preventDefault(); showLegal('license'); });
  if (footerTos) footerTos.addEventListener('click', (e) => { e.preventDefault(); showLegal('tos'); });
  if (footerPrivacy) footerPrivacy.addEventListener('click', (e) => { e.preventDefault(); showLegal('privacy'); });
  if (bugReportLink) bugReportLink.addEventListener('click', (e) => { e.preventDefault(); openBugReport(); });
  if (bugReportEmailLink) bugReportEmailLink.addEventListener('click', (e) => { e.preventDefault(); openBugReportEmail(); });
  if (reviewLink) reviewLink.addEventListener('click', (e) => { e.preventDefault(); openReview(); });
  if (footerBugReport) footerBugReport.addEventListener('click', (e) => { e.preventDefault(); openBugReport(); });
  if (footerReview) footerReview.addEventListener('click', (e) => { e.preventDefault(); openReview(); });

  async function triggerUpdateCheck() {
    showToast('Checking for updates...');
    try {
      const result = await window.smiley.checkForUpdates();
      if (!result) return;
      if (result.status === 'dev-mode') {
        showToast(result.message || 'Updates only work in the installed app from GitHub Releases.');
        return;
      }
      if (result.status === 'up-to-date') {
        showToast(`You're on the latest version (v${result.version || 'current'}).`);
        return;
      }
      if (result.status === 'available') {
        showToast(`Update v${result.version} found — downloading…`);
        return;
      }
      if (result.status === 'downloaded') {
        showToast(`Update v${result.version} ready — restart to apply.`);
        return;
      }
      if (result.status === 'no-release' || result.status === 'unsigned-update' || result.status === 'manual-install-required') {
        if (result.status === 'manual-install-required' || result.status === 'unsigned-update') {
          showUpdateActionToast(
            result.message || buildManualUpdateMessage(result.version),
            { url: result.releasesUrl || releasesUrl }
          );
        } else {
          showToast(result.message || 'No release on GitHub yet — download from Releases page.');
        }
        return;
      }
      if (result.status === 'busy' || result.status === 'timeout') {
        showToast(result.error || 'Update check failed.', 'error');
        return;
      }
      if (!result.ok && result.error) {
        showToast(result.error, 'error');
      }
    } catch (_) {
      showToast('Update check failed. Try again or download from GitHub Releases.', 'error');
    }
  }
  const checkUpdateBtn = $('#checkUpdateBtn');
  const checkUpdateBtnGeneral = $('#checkUpdateBtnGeneral');
  if (checkUpdateBtn) checkUpdateBtn.addEventListener('click', triggerUpdateCheck);
  if (checkUpdateBtnGeneral) checkUpdateBtnGeneral.addEventListener('click', triggerUpdateCheck);

  if (exportSettingsBtn) {
    exportSettingsBtn.addEventListener('click', async () => {
      const result = await window.smiley.exportSettings();
      if (result.canceled) return;
      if (result.success) showToast('Settings exported');
      else showToast(result.error || 'Export failed', 'error');
    });
  }

  if (importSettingsBtn) {
    importSettingsBtn.addEventListener('click', async () => {
      const result = await window.smiley.importSettings();
      if (result.canceled) return;
      if (result.success) {
        showToast('Settings imported — reopen Settings to review');
        await loadCustomActivitiesConfig();
        renderCategoryTabs();
        renderActivityGrid();
        openSettings('advanced');
      } else showToast(result.error || 'Import failed', 'error');
    });
  }

  if (resetWindowBtn) {
    resetWindowBtn.addEventListener('click', async () => {
      const result = await window.smiley.resetWindowPosition();
      if (result?.success) showToast('Window position reset');
      else showToast(result?.error || 'Could not reset window', 'error');
    });
  }

  if (updateDismissBtn) {
    updateDismissBtn.addEventListener('click', () => {
      updateState.dismissed = true;
      hideUpdateBanner();
    });
  }
  if (updateRestartBtn) {
    updateRestartBtn.disabled = true;
    updateRestartBtn.addEventListener('click', async () => {
      if (!updateState.downloaded) {
        showToast('Download still in progress — try again when ready', 'error');
        return;
      }
      const result = await window.smiley.installUpdate();
      if (!result?.success) {
        showToast(result?.error || 'No update ready — check again in a moment', 'error');
      }
    });
  }

  window.smiley.onSelectActivity((id) => selectActivity(id));

  window.smiley.onConfigChanged((data) => {
    if (data.recentActivities) {
      recentActivities = data.recentActivities;
      renderRecentChips();
    }
    if (data.favoriteActivities) {
      favoriteIds = data.favoriteActivities;
      renderActivityGrid();
    }
    if (data.customActivities) {
      customActivitiesConfig = data.customActivities;
      renderActivityGrid();
      renderCustomActivitiesSettingsList();
      if (selectedActivityId) {
        const activity = findActivity(selectedActivityId);
        if (activity) renderGifPicker(activity);
      }
    }
  });

  // IPC events
  window.smiley.onStatus((data) => {
    if (data.settings) {
      currentSettings = { ...currentSettings, ...data.settings };
      applyTheme(data.settings.theme);
      const timerEl = $('#previewTimer');
      if (timerEl) timerEl.style.display = data.settings.showTimer !== false ? '' : 'none';
    }
    if (data.version) {
      footerVersion.textContent = `Smiley v${data.version}`;
      if (aboutVersion) aboutVersion.textContent = `Smiley v${data.version}`;
    }
    if (data.activity) {
      const match = findActivity(data.activity.id) || getAllActivitiesMerged().find(
        (a) => a.details === data.activity.details && a.state === data.activity.state
      );
      if (match) {
        selectedActivityId = match.id;
        renderActivityGrid();
        renderGifPicker(match);
        updatePreview({ ...match, category: match.category });
      }
      if (data.sessionStart) startTimer(data.sessionStart);
    }
  });

  window.smiley.onInitialConnect((result) => {
    if (result.connected) setConnectionStatus(true);
    else setConnectionStatus(false, result.error);
  });

  window.smiley.onOpenSettings(() => openSettings('general'));
  window.smiley.onUpdateStatus(handleUpdateStatus);

  // Initial config load
  const cfg = await window.smiley.getConfig();
  currentSettings = { ...currentSettings, ...cfg };
  activityGifChoices = cfg.activityGifChoice || {};
  recentActivities = cfg.recentActivities || [];
  favoriteIds = cfg.favoriteActivities || [];
  await loadCustomActivitiesConfig();
  applyPlatformUI(cfg);
  if (cfg.releasesUrl) releasesUrl = cfg.releasesUrl;
  if (typeof cfg.macAdHocUpdates === 'boolean') macAdHocUpdates = cfg.macAdHocUpdates;
  wallpaperSettings = {
    filename: cfg.customWallpaper?.filename || null,
    blur: Number(cfg.customWallpaper?.blur) || 0,
    dim: Number(cfg.customWallpaper?.dim) || 0,
  };
  await applyWallpaper(wallpaperSettings);
  renderRecentChips();
  applyTheme(cfg.theme || 'dark');
  if (cfg.version) {
    footerVersion.textContent = `Smiley v${cfg.version}`;
    if (aboutVersion) aboutVersion.textContent = `Smiley v${cfg.version}`;
  }

  // Prompt setup when Client ID is missing
  if (!cfg.hasValidClientId) {
    setConnectionStatus(false, 'Discord not configured');
  }

  // Restore previous activity
  const status = await window.smiley.getStatus();
  if (status.activity) {
    const match = findActivity(status.activity.id) || getAllActivitiesMerged().find(
      (a) => a.details === status.activity.details && a.state === status.activity.state
    );
    if (match) {
      selectedActivityId = match.id;
      renderActivityGrid();
      await updatePreview({ ...match, category: match.category });
    }
    if (status.sessionStart) startTimer(status.sessionStart);
  }

  const timerEl = $('#previewTimer');
  if (timerEl) timerEl.style.display = cfg.showTimer !== false ? '' : 'none';

  updateBrandIcon();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBrandIcon);
}

init();
