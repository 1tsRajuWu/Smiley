import { ACTIVITY_CATEGORIES, ALL_ACTIVITIES } from './activities.js';
import {
  resolveDiscordImageUrl,
  discordImageFields,
  getActivityFallbackUrls,
} from './discord-images.js';

const DONATION_URL = 'https://paypal.me/1tsRaj';

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
const searchInput = $('#searchInput');
const settingsBtn = $('#settingsBtn');
const minimizeBtn = $('#minimizeBtn');
const settingsModal = $('#settingsModal');
const saveSettingsBtn = $('#saveSettingsBtn');
const closeSettings = $('#closeSettings');
const donateBanner = $('#donateBanner');
const toastContainer = $('#toastContainer');
const characterGif = $('#characterGif');
const characterLoading = $('#characterLoading');
const characterLabel = $('#characterLabel');
const characterSource = $('#characterSource');
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
const bugReportLink = $('#bugReportLink');
const bugReportEmailLink = $('#bugReportEmailLink');
const footerBugReport = $('#footerBugReport');
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
let updateState = { downloaded: false, dismissed: false, percent: 0 };
let searchDebounceTimer = null;
let recentActivities = [];
let favoriteIds = [];
let wallpaperSettings = { filename: null, blur: 0, dim: 0 };
let isMacPlatform = /Mac|iPhone|iPod|iPad/.test(navigator.platform);

// ─── Helpers ─────────────────────────────────────────────────────────
function formatShortcutHint(mac = isMacPlatform) {
  if (mac) return '⌘1–5 categories · ⌘K search · Esc clear';
  return 'Ctrl+1–5 categories · Ctrl+K search · Esc clear';
}

function updateFooterShortcuts(mac = isMacPlatform) {
  if (footerShortcuts) footerShortcuts.textContent = formatShortcutHint(mac);
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

async function resolveGifUrl(activity) {
  const { url, discordUrl, source, fallbacks } = await resolveDiscordImageUrl(activity, {
    animationsEnabled: currentSettings.animationsEnabled,
    customDataUrl: activeCustomAnimation,
  });
  return { url, discordUrl, source, fallbacks };
}

/** Load an <img> through a URL chain — hidden display:none blocks browser fetch. */
function loadImageWithFallback(img, urls, { onSuccess, onFail } = {}) {
  const queue = [...new Set(urls.filter(Boolean))];
  let index = 0;

  const tryNext = () => {
    if (index >= queue.length) {
      onFail?.();
      return;
    }
    const nextUrl = queue[index++];
    img.onload = () => onSuccess?.(nextUrl);
    img.onerror = tryNext;
    img.loading = 'eager';
    img.decoding = 'async';
    img.src = nextUrl;
    if (img.complete && img.naturalWidth > 0) onSuccess?.(nextUrl);
  };

  tryNext();
}

function setCharacterDisplay(url, source, fallbackUrls = []) {
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
    onSuccess: () => {
      characterLoading.style.display = 'none';
      characterGif.classList.add('character-gif-loaded');
    },
    onFail: () => {
      characterLoading.style.display = 'none';
      characterGif.classList.remove('character-gif-loaded');
      characterSource.textContent = source ? `${source} · failed to load` : 'Image failed to load';
    },
  });
  characterSource.textContent = source;
}

function setPreviewDisplay(activity, gifUrl, fallbackUrls = []) {
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

  const category = ACTIVITY_CATEGORIES.find((c) => c.id === activity.category);
  previewCard.classList.add('active');
  previewCard.style.setProperty('--card-glow', `${category?.color || '#7aa2f7'}33`);

  previewDetails.textContent = activity.details;
  previewState.textContent = activity.state || '';
  clearBtn.disabled = false;
  if (copyBtn) copyBtn.disabled = false;

  if (gifUrl && currentSettings.animationsEnabled !== false) {
    previewEmoji.style.display = 'none';
    loadImageWithFallback(previewGif, [gifUrl, ...fallbackUrls], {
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

async function updatePreview(activity) {
  if (!activity) {
    setPreviewDisplay(null);
    setCharacterDisplay(null, '');
    setCharacterLabel(null);
    currentGifUrl = null;
    currentDiscordImageUrl = null;
    return;
  }

  // Show loading state
  characterGif.classList.remove('character-gif-loaded');
  characterLoading.style.display = 'flex';

  // Resolve GIF
  const { url, discordUrl, source, fallbacks } = await resolveGifUrl(activity);
  currentGifUrl = url;
  currentDiscordImageUrl = discordUrl;

  setPreviewDisplay(activity, url, fallbacks);
  setCharacterDisplay(url, source, fallbacks);
  setCharacterLabel(activity);
}

// ─── Activity Grid ───────────────────────────────────────────────────
function renderCategoryTabs() {
  categoryTabs.innerHTML = ACTIVITY_CATEGORIES.map(
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
      const act = ALL_ACTIVITIES.find((a) => a.id === item.id);
      const emoji = act?.emoji || '⭐';
      return `<button type="button" class="quick-chip" data-id="${item.id}" title="${item.state || item.details}">${emoji} ${item.details}</button>`;
    })
    .join('');
  recentChips.querySelectorAll('.quick-chip').forEach((chip) => {
    chip.addEventListener('click', () => selectActivity(chip.dataset.id));
  });
}

function getFilteredActivities() {
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    return ALL_ACTIVITIES.filter(
      (a) => a.details.toLowerCase().includes(q) || a.state?.toLowerCase().includes(q) || a.emoji.includes(q)
    );
  }
  const cat = ACTIVITY_CATEGORIES.find((c) => c.id === activeCategory);
  const list = cat ? cat.activities.map((a) => ({ ...a, category: cat.id, categoryColor: cat.color })) : [];
  return sortWithFavorites(list);
}

function renderActivityGrid() {
  const activities = getFilteredActivities();
  if (activities.length === 0) {
    activityGrid.innerHTML = '<div class="empty-state">No activities match your search</div>';
    return;
  }

  activityGrid.innerHTML = activities
    .map(
      (a, i) => {
        const isFav = favoriteIds.includes(a.id);
        return `
    <div class="activity-card${a.id === selectedActivityId ? ' selected' : ''}${isFav ? ' favorited' : ''}" data-id="${a.id}" role="button" tabindex="0"
      style="--card-accent: ${a.categoryColor || '#7aa2f7'}; animation-delay: ${i * 30}ms">
      <button type="button" class="activity-fav${isFav ? ' active' : ''}" data-fav="${a.id}" title="${isFav ? 'Unpin' : 'Pin'}">${isFav ? '★' : '☆'}</button>
      <span class="activity-emoji">${a.emoji}</span>
      <span class="activity-name">${a.details}</span>
      <span class="activity-state">${a.state || ''}</span>
    </div>
  `;
      }
    )
    .join('');

  activityGrid.querySelectorAll('.activity-fav').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      favoriteIds = await window.smiley.toggleFavorite(btn.dataset.fav);
      renderActivityGrid();
    });
  });

  activityGrid.querySelectorAll('.activity-card').forEach((card) => {
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
  const activity = ALL_ACTIVITIES.find((a) => a.id === id);
  if (!activity) return;

  const isReselect = selectedActivityId === id;
  selectedActivityId = id;
  renderActivityGrid();

  // Immediate UI — don't block on GIF fetch
  setCharacterLabel(activity);
  setPreviewDisplay(activity, null);
  characterGif.classList.remove('character-gif-loaded');
  characterLoading.style.display = 'flex';

  const fallbackUrls = getActivityFallbackUrls(activity);
  const fallbackFields = discordImageFields(activity, fallbackUrls[0] || null);
  const rpcPayload = {
    id: activity.id,
    details: activity.details,
    state: activity.state,
    category: activity.category,
    ...fallbackFields,
  };

  const result = await window.smiley.setActivity(rpcPayload, !isReselect);

  resolveGifUrl(activity)
    .then(({ url, discordUrl, source, fallbacks }) => {
      if (selectedActivityId !== id) return;
      currentGifUrl = url;
      currentDiscordImageUrl = discordUrl;
      setPreviewDisplay(activity, url, fallbacks);
      setCharacterDisplay(url, source, fallbacks);

      if (discordUrl && discordUrl !== fallbackFields.discordImageUrl) {
        const imageFields = discordImageFields(activity, discordUrl);
        window.smiley.setActivity({ ...rpcPayload, ...imageFields }, false).catch(() => {});
      }
    })
    .catch(() => {
      if (selectedActivityId === id) characterLoading.style.display = 'none';
    });

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
  const activity = selectedActivityId ? ALL_ACTIVITIES.find((a) => a.id === selectedActivityId) : null;
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
  await updatePreview(null);
  showToast('Status cleared');
}

// ─── Settings ────────────────────────────────────────────────────────
function openSettings(tab = 'general') {
  window.smiley.getConfig().then((cfg) => {
    currentSettings = { ...cfg };
    donateBanner.href = DONATION_URL;
    autoConnectToggle.checked = cfg.autoConnect !== false;
    minimizeTrayToggle.checked = cfg.minimizeToTray !== false;
    if (autoCheckUpdatesToggle) autoCheckUpdatesToggle.checked = cfg.autoCheckUpdates !== false;
    if (autoInstallUpdatesToggle) autoInstallUpdatesToggle.checked = cfg.autoInstallUpdates !== false;
    showTimerToggle.checked = cfg.showTimer !== false;
    animationsToggle.checked = cfg.animationsEnabled !== false;
    if (launchAtLoginToggle) launchAtLoginToggle.checked = cfg.launchAtLogin === true;
    if (hotkeyToggle) hotkeyToggle.checked = cfg.hotkeyEnabled !== false;
    if (hotkeyHint && cfg.hotkey) hotkeyHint.textContent = `Shortcut: ${cfg.hotkey.replace('CommandOrControl', 'Cmd/Ctrl')}`;

    if (typeof cfg.isMac === 'boolean') isMacPlatform = cfg.isMac;
    updateFooterShortcuts(isMacPlatform);

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

  donateBanner.href = DONATION_URL;
  applyTheme(newSettings.theme);

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

function applyTheme(theme) {
  appEl.dataset.theme = theme || 'dark';
  currentSettings.theme = theme || 'dark';
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
        const activity = selectedActivityId ? ALL_ACTIVITIES.find((a) => a.id === selectedActivityId) : null;
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
          const activity = selectedActivityId ? ALL_ACTIVITIES.find((a) => a.id === selectedActivityId) : null;
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
  const activity = selectedActivityId ? ALL_ACTIVITIES.find((a) => a.id === selectedActivityId) : null;
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

// ─── Legal Modal ─────────────────────────────────────────────────────
async function showLegal(type) {
  const titles = { license: 'License Agreement', tos: 'Terms of Service', privacy: 'Privacy Policy' };
  const files = { license: '../LICENSE', tos: '../ToS.md', privacy: '../PRIVACY.md' };
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

function syncUpdateBannerButtons() {
  if (!updateRestartBtn) return;
  updateRestartBtn.disabled = !updateState.downloaded;
  updateRestartBtn.title = updateState.downloaded
    ? 'Restart to install update'
    : 'Available after download completes';
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
      updateState = { downloaded: false, dismissed: false, percent: 0 };
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
      syncUpdateBannerButtons();
      if (updateBannerText) {
        updateBannerText.textContent = `Update v${data.version} ready — restart to apply`;
      }
      updateBanner?.classList.add('visible');
      showToast(`Update v${data.version} ready! Restart to apply.`);
      break;
    case 'download-stalled':
      updateState = { downloaded: false, dismissed: true, percent: 0 };
      syncUpdateBannerButtons();
      hideUpdateBanner();
      showToast(data.error || 'Update download stalled. Try again later.', 'error');
      break;
    case 'unsigned-update':
      updateState = { downloaded: false, dismissed: true, percent: 0 };
      syncUpdateBannerButtons();
      hideUpdateBanner();
      showToast(data.message || 'Download the latest installer from GitHub Releases.', 'error');
      break;
    case 'error':
      updateState = { downloaded: false, dismissed: false, percent: 0 };
      syncUpdateBannerButtons();
      hideUpdateBanner();
      if (data.expected) {
        showToast(data.message || data.error || 'Update check unavailable.');
      } else {
        showToast(`Update error: ${data.error}`, 'error');
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
  minimizeBtn.addEventListener('click', () => window.smiley.minimizeWindow());
  setupModalClose(settingsModal, closeSettings);
  setupModalClose(legalModal, closeLegal);
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', handleSaveSettings);
  clearBtn.addEventListener('click', handleClear);
  if (copyBtn) copyBtn.addEventListener('click', handleCopy);

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      const cat = ACTIVITY_CATEGORIES[idx];
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

  donateBanner.addEventListener('click', (e) => {
    e.preventDefault();
    window.smiley.openExternal(donateBanner.href);
  });

  const aboutLink = $('.about-link');
  if (aboutLink) {
    aboutLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.smiley.openExternal(aboutLink.href);
    });
  }

  if (licenseLink) licenseLink.addEventListener('click', (e) => { e.preventDefault(); showLegal('license'); });
  if (tosLink) tosLink.addEventListener('click', (e) => { e.preventDefault(); showLegal('tos'); });
  if (privacyLink) privacyLink.addEventListener('click', (e) => { e.preventDefault(); showLegal('privacy'); });
  if (bugReportLink) bugReportLink.addEventListener('click', (e) => { e.preventDefault(); openBugReport(); });
  if (bugReportEmailLink) bugReportEmailLink.addEventListener('click', (e) => { e.preventDefault(); openBugReportEmail(); });
  if (footerBugReport) footerBugReport.addEventListener('click', (e) => { e.preventDefault(); openBugReport(); });

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
      if (result.status === 'no-release' || result.status === 'unsigned-update') {
        showToast(result.message || 'No release on GitHub yet — download from Releases page.');
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
  });

  // IPC events
  window.smiley.onStatus((data) => {
    if (data.donationUrl) donateBanner.href = DONATION_URL;
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
      const match = ALL_ACTIVITIES.find((a) => a.details === data.activity.details && a.state === data.activity.state);
      if (match) {
        selectedActivityId = match.id;
        renderActivityGrid();
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
  recentActivities = cfg.recentActivities || [];
  favoriteIds = cfg.favoriteActivities || [];
  if (typeof cfg.isMac === 'boolean') isMacPlatform = cfg.isMac;
  updateFooterShortcuts(isMacPlatform);
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
  donateBanner.href = DONATION_URL;

  // Prompt setup when Client ID is missing
  if (!cfg.hasValidClientId) {
    setConnectionStatus(false, 'Discord not configured');
  }

  // Restore previous activity
  const status = await window.smiley.getStatus();
  if (status.activity) {
    const match = ALL_ACTIVITIES.find((a) => a.details === status.activity.details && a.state === status.activity.state);
    if (match) {
      selectedActivityId = match.id;
      renderActivityGrid();
      await updatePreview({ ...match, category: match.category });
    }
    if (status.sessionStart) startTimer(status.sessionStart);
  }

  const timerEl = $('#previewTimer');
  if (timerEl) timerEl.style.display = cfg.showTimer !== false ? '' : 'none';
}

init();
