/**
 * Smiley Mobile — activity companion (v7.9.6)
 * No Discord RPC on mobile; preview GIFs + copy status for desktop use.
 */
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ACTIVITY_CATEGORIES, ALL_ACTIVITIES } from './activities.js';
import { resolveDiscordImageUrl, getActivityFallbackUrls } from './discord-images.js';

const STORAGE_KEY = 'smiley-mobile-settings';
const FAVORITES_KEY = 'smiley-mobile-favorites';
const VERSION = '7.9.6';
const RELEASES_URL = 'https://github.com/1tsRajuWu/Smiley/releases/latest';
const BUG_REPORT_REPO = 'https://github.com/1tsRajuWu/Smiley/issues/new';

const isNative = Capacitor.isNativePlatform();

async function initNativeShell() {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f1117' });
  } catch {
    /* StatusBar not available on all platforms */
  }
}

const $ = (id) => document.getElementById(id);

const state = {
  category: ACTIVITY_CATEGORIES[0].id,
  selected: null,
  animations: true,
  theme: 'dark',
  favorites: new Set(),
  search: '',
};

const els = {
  app: $('app'),
  bottomNav: $('bottomNav'),
  activityGrid: $('activityGrid'),
  searchInput: $('searchInput'),
  characterGif: $('characterGif'),
  characterPlaceholder: $('characterPlaceholder'),
  characterLoading: $('characterLoading'),
  characterLabel: $('characterLabel'),
  characterSource: $('characterSource'),
  previewCard: $('previewCard'),
  previewGif: $('previewGif'),
  previewEmoji: $('previewEmoji'),
  previewDetails: $('previewDetails'),
  previewState: $('previewState'),
  copyBtn: $('copyBtn'),
  favoriteBtn: $('favoriteBtn'),
  settingsBtn: $('settingsBtn'),
  settingsModal: $('settingsModal'),
  closeSettings: $('closeSettings'),
  animationsToggle: $('animationsToggle'),
  themeOptions: $('themeOptions'),
  toastContainer: $('toastContainer'),
  downloadLatestBtn: $('downloadLatestBtn'),
  reportBugBtn: $('reportBugBtn'),
};

async function storageGet(key) {
  if (isNative) {
    const { value } = await Preferences.get({ key });
    return value;
  }
  return localStorage.getItem(key);
}

async function storageSet(key, value) {
  if (isNative) {
    await Preferences.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
}

function getPlatformLabel() {
  if (isNative) {
    const platform = Capacitor.getPlatform();
    return `${platform} · ${navigator.userAgent}`;
  }
  return navigator.userAgent;
}

function buildBugReportBody() {
  return [
    `**Version:** ${VERSION} (mobile)`,
    `**OS / Platform:** ${getPlatformLabel()}`,
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

function buildBugReportUrl() {
  const params = new URLSearchParams({
    template: 'bug_report.md',
    labels: 'bug',
    body: buildBugReportBody(),
  });
  return `${BUG_REPORT_REPO}?${params}`;
}

function buildReviewBody() {
  return [
    '**Rating (1–5 stars):**',
    '⭐⭐⭐⭐⭐',
    '',
    '**What you like:**',
    '',
    '**Suggestions / ideas:**',
    '',
    `**Smiley version:** ${VERSION} (mobile)`,
    `**OS:** ${getPlatformLabel()}`,
    '',
  ].join('\n');
}

function buildReviewUrl() {
  const params = new URLSearchParams({
    template: 'review.md',
    labels: 'review',
    body: buildReviewBody(),
  });
  return `${BUG_REPORT_REPO}?${params}`;
}

async function openExternal(url) {
  if (isNative) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

async function loadSettings() {
  const raw = await storageGet(STORAGE_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw);
      state.animations = s.animations !== false;
      state.theme = s.theme || 'dark';
    } catch { /* ignore */ }
  }

  const favRaw = await storageGet(FAVORITES_KEY);
  if (favRaw) {
    try {
      state.favorites = new Set(JSON.parse(favRaw));
    } catch { /* ignore */ }
  }
}

async function saveSettings() {
  await storageSet(STORAGE_KEY, JSON.stringify({ animations: state.animations, theme: state.theme }));
}

async function saveFavorites() {
  await storageSet(FAVORITES_KEY, JSON.stringify([...state.favorites]));
}

const DARK_UI_THEMES = new Set(['dark', 'midnight', 'ocean', 'sakura', 'lowlight']);

function updateBrandIcon() {
  const img = document.getElementById('brandLogoImg');
  if (!img) return;
  const useLight = DARK_UI_THEMES.has(state.theme) || window.matchMedia('(prefers-color-scheme: dark)').matches;
  img.src = useLight ? 'assets/icon-light.png' : 'assets/icon-dark.png';
}

function applyTheme() {
  els.app.dataset.theme = state.theme;
  els.animationsToggle.checked = state.animations;
  els.themeOptions.querySelectorAll('.theme-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.theme === state.theme);
  });
  updateBrandIcon();
}

function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  els.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function hapticLight() {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* noop */ }
}

function buildStatusText(activity) {
  return `${activity.details}\n${activity.state}`;
}

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
    img.src = nextUrl;
    if (img.complete && img.naturalWidth > 0) onSuccess?.(nextUrl);
  };

  tryNext();
}

function renderBottomNav() {
  els.bottomNav.innerHTML = ACTIVITY_CATEGORIES.map(
    (cat) => `
    <button
      type="button"
      class="nav-tab${cat.id === state.category ? ' active' : ''}"
      data-category="${cat.id}"
      role="tab"
      aria-selected="${cat.id === state.category}"
      aria-label="${cat.label}"
    >
      <span class="nav-emoji">${cat.emoji}</span>
      <span>${cat.label}</span>
    </button>`
  ).join('');

  els.bottomNav.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.category;
      state.search = '';
      els.searchInput.value = '';
      renderBottomNav();
      renderActivities();
      hapticLight();
    });
  });
}

function getFilteredActivities() {
  const q = state.search.trim().toLowerCase();
  let list = ALL_ACTIVITIES.filter((a) => a.category === state.category);
  if (q) {
    list = ALL_ACTIVITIES.filter(
      (a) =>
        a.details.toLowerCase().includes(q) ||
        a.state.toLowerCase().includes(q) ||
        a.emoji.includes(q) ||
        a.id.includes(q)
    );
  }
  return list;
}

function renderActivities() {
  const list = getFilteredActivities();
  if (!list.length) {
    els.activityGrid.innerHTML = '<p class="empty-state">No activities found</p>';
    return;
  }

  els.activityGrid.innerHTML = list
    .map(
      (a, i) => `
    <button
      type="button"
      class="activity-card${state.selected?.id === a.id ? ' selected' : ''}"
      data-id="${a.id}"
      style="--card-accent:${a.categoryColor};animation-delay:${i * 25}ms"
    >
      <span class="activity-emoji">${a.emoji}</span>
      <span class="activity-name">${a.details}</span>
      <span class="activity-state">${a.state}</span>
    </button>`
    )
    .join('');

  els.activityGrid.querySelectorAll('.activity-card').forEach((card) => {
    card.addEventListener('click', () => selectActivity(card.dataset.id));
  });
}

async function selectActivity(id) {
  const activity = ALL_ACTIVITIES.find((a) => a.id === id);
  if (!activity) return;

  state.selected = activity;
  hapticLight();
  renderActivities();
  updatePreview(activity);
  updateActions();
}

function updateActions() {
  const has = !!state.selected;
  els.copyBtn.disabled = !has;
  els.favoriteBtn.disabled = !has;
  const fav = state.selected && state.favorites.has(state.selected.id);
  els.favoriteBtn.textContent = fav ? '★ Favorited' : '☆ Favorite';
  els.favoriteBtn.classList.toggle('favorited', !!fav);
}

async function updatePreview(activity) {
  els.previewCard.classList.add('active');
  els.previewDetails.textContent = activity.details;
  els.previewState.textContent = activity.state;
  els.previewEmoji.textContent = activity.emoji;
  els.characterLabel.textContent = `${activity.emoji} ${activity.state || activity.details}`;

  els.characterLoading.hidden = false;
  els.characterGif.classList.remove('loaded');
  els.characterPlaceholder.hidden = true;
  els.previewGif.classList.remove('loaded');

  try {
    const { url, source, fallbacks } = await resolveDiscordImageUrl(activity, {
      animationsEnabled: state.animations,
    });
    const chain = [url, ...(fallbacks || getActivityFallbackUrls(activity))].filter(Boolean);
    els.characterSource.textContent = source || '';

    if (chain.length && state.animations) {
      loadImageWithFallback(els.characterGif, chain, {
        onSuccess: () => {
          els.characterGif.classList.add('loaded');
          els.characterLoading.hidden = true;
          els.characterPlaceholder.hidden = true;
        },
        onFail: () => {
          els.characterLoading.hidden = true;
          els.characterPlaceholder.hidden = false;
          els.characterPlaceholder.textContent = activity.emoji;
          els.characterSource.textContent = source ? `${source} · failed to load` : 'Image failed to load';
        },
      });

      loadImageWithFallback(els.previewGif, chain, {
        onSuccess: () => {
          els.previewGif.classList.add('loaded');
          els.previewEmoji.hidden = true;
        },
        onFail: () => {
          els.previewGif.classList.remove('loaded');
          els.previewEmoji.hidden = false;
        },
      });
    } else {
      els.characterLoading.hidden = true;
      els.characterPlaceholder.hidden = false;
      els.characterPlaceholder.textContent = activity.emoji;
      els.previewEmoji.hidden = false;
    }
  } catch {
    els.characterLoading.hidden = true;
    els.characterPlaceholder.hidden = false;
    els.characterPlaceholder.textContent = activity.emoji;
  }
}

async function copyStatus() {
  if (!state.selected) return;
  const text = buildStatusText(state.selected);

  try {
    if (isNative) {
      await Clipboard.write({ string: text });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('Clipboard unavailable');
    }
    await hapticLight();
    toast('Status copied! Paste in desktop Smiley or Discord.');
  } catch {
    toast('Could not copy — try selecting text manually', 'error');
  }
}

async function toggleFavorite() {
  if (!state.selected) return;
  const id = state.selected.id;
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  await saveFavorites();
  updateActions();
  await hapticLight();
  toast(state.favorites.has(id) ? 'Added to favorites' : 'Removed from favorites');
}

function bindEvents() {
  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderActivities();
  });

  els.copyBtn.addEventListener('click', copyStatus);
  els.favoriteBtn.addEventListener('click', toggleFavorite);

  els.settingsBtn.addEventListener('click', () => els.settingsModal.showModal());
  els.closeSettings.addEventListener('click', () => els.settingsModal.close());
  els.settingsModal.addEventListener('click', (e) => {
    if (e.target === els.settingsModal) els.settingsModal.close();
  });

  els.animationsToggle.addEventListener('change', async (e) => {
    state.animations = e.target.checked;
    await saveSettings();
    if (state.selected) updatePreview(state.selected);
  });

  els.themeOptions.addEventListener('click', async (e) => {
    const chip = e.target.closest('.theme-chip');
    if (!chip) return;
    state.theme = chip.dataset.theme;
    applyTheme();
    await saveSettings();
  });

  els.downloadLatestBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openExternal(RELEASES_URL);
  });

  els.reportBugBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openExternal(buildBugReportUrl());
  });

  const footerBugReport = $('footerBugReport');
  footerBugReport?.addEventListener('click', (e) => {
    e.preventDefault();
    openExternal(buildBugReportUrl());
  });

  const footerReview = $('footerReview');
  footerReview?.addEventListener('click', (e) => {
    e.preventDefault();
    openExternal(buildReviewUrl());
  });
}

async function init() {
  await initNativeShell();
  await loadSettings();
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBrandIcon);
  renderBottomNav();
  renderActivities();
  bindEvents();

  if (state.favorites.size) {
    const firstFav = ALL_ACTIVITIES.find((a) => state.favorites.has(a.id));
    if (firstFav) {
      state.category = firstFav.category;
      renderBottomNav();
      await selectActivity(firstFav.id);
    }
  }

  console.info(`Smiley Mobile v${VERSION} ready`);
}

init();
