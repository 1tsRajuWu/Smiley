import { ACTIVITY_CATEGORIES, ALL_ACTIVITIES } from './activities.js';
import { resolveActivityImage, discordImageFields } from './discord-images.js';

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

// Settings refs
const settingsTabs = document.querySelectorAll('.settings-tab');
const settingsPanels = document.querySelectorAll('.settings-panel');
const autoConnectToggle = $('#autoConnectToggle');
const minimizeTrayToggle = $('#minimizeTrayToggle');
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
const updateBanner = $('#updateBanner');
const updateBannerText = $('#updateBannerText');
const updateRestartBtn = $('#updateRestartBtn');
const updateDismissBtn = $('#updateDismissBtn');

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

// ─── Helpers ─────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
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
  if (!start) { timerText.textContent = '0:00'; return; }
  const tick = () => { timerText.textContent = formatElapsed(Date.now() - sessionStart); };
  tick();
  timerInterval = setInterval(tick, 1000);
}

async function resolveGifUrl(activity) {
  const { url, discordUrl, source } = await resolveActivityImage(activity, {
    animationsEnabled: currentSettings.animationsEnabled,
    customDataUrl: activeCustomAnimation,
  });
  return { url, discordUrl, source };
}

function setCharacterDisplay(url, source) {
  characterLoading.style.display = 'none';
  if (!url) {
    characterGif.style.display = 'none';
    characterSource.textContent = '';
    return;
  }
  characterGif.src = url;
  characterGif.style.display = 'block';
  characterGif.onload = () => characterGif.classList.add('character-gif-loaded');
  characterSource.textContent = source;
}

function setPreviewDisplay(activity, gifUrl) {
  if (!activity) {
    previewCard.classList.remove('active');
    previewCard.style.removeProperty('--card-glow');
    previewEmoji.textContent = '😊';
    previewEmoji.style.display = '';
    previewGif.style.display = 'none';
    previewDetails.textContent = 'Pick an activity';
    previewState.textContent = 'Your status appears here';
    clearBtn.disabled = true;
    startTimer(null);
    return;
  }

  const category = ACTIVITY_CATEGORIES.find((c) => c.id === activity.category);
  previewCard.classList.add('active');
  previewCard.style.setProperty('--card-glow', `${category?.color || '#7aa2f7'}33`);

  // Use GIF in preview if animations enabled
  if (gifUrl && currentSettings.animationsEnabled !== false) {
    previewEmoji.style.display = 'none';
    previewGif.src = gifUrl;
    previewGif.style.display = 'block';
  } else {
    previewGif.style.display = 'none';
    previewEmoji.textContent = activity.emoji;
    previewEmoji.style.display = '';
  }

  previewDetails.textContent = activity.details;
  previewState.textContent = activity.state || '';
  clearBtn.disabled = false;
}

function setCharacterLabel(activity) {
  if (!activity) {
    characterLabel.textContent = 'Pick an activity to see your character!';
    return;
  }
  const labels = {
    food: 'Yum! Time to eat! 🍽️',
    gaming: 'Game on! Let\'s go! 🎮',
    chill: 'Relaxing and vibing... 😌',
    work: 'Focus mode activated 💻',
    social: 'Having fun with friends! ✨',
  };
  characterLabel.textContent = labels[activity.category] || `${activity.details} time!`;
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
  characterGif.style.display = 'none';
  characterLoading.style.display = 'flex';

  // Resolve GIF
  const { url, discordUrl, source } = await resolveGifUrl(activity);
  currentGifUrl = url;
  currentDiscordImageUrl = discordUrl;

  // Update displays
  setPreviewDisplay(activity, url);
  setCharacterDisplay(url, source);
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

function getFilteredActivities() {
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    return ALL_ACTIVITIES.filter(
      (a) => a.details.toLowerCase().includes(q) || a.state?.toLowerCase().includes(q) || a.emoji.includes(q)
    );
  }
  const cat = ACTIVITY_CATEGORIES.find((c) => c.id === activeCategory);
  return cat ? cat.activities.map((a) => ({ ...a, category: cat.id, categoryColor: cat.color })) : [];
}

function renderActivityGrid() {
  const activities = getFilteredActivities();
  if (activities.length === 0) {
    activityGrid.innerHTML = '<div class="empty-state">No activities match your search</div>';
    return;
  }

  activityGrid.innerHTML = activities
    .map(
      (a, i) => `
    <button class="activity-card${a.id === selectedActivityId ? ' selected' : ''}" data-id="${a.id}"
      style="--card-accent: ${a.categoryColor || '#7aa2f7'}; animation-delay: ${i * 30}ms" type="button">
      <span class="activity-emoji">${a.emoji}</span>
      <span class="activity-name">${a.details}</span>
      <span class="activity-state">${a.state || ''}</span>
    </button>
  `
    )
    .join('');

  activityGrid.querySelectorAll('.activity-card').forEach((card) => {
    card.addEventListener('click', () => selectActivity(card.dataset.id));
  });
}

async function selectActivity(id) {
  const activity = ALL_ACTIVITIES.find((a) => a.id === id);
  if (!activity) return;

  const isReselect = selectedActivityId === id;
  selectedActivityId = id;
  renderActivityGrid();

  // Update preview (includes async GIF loading)
  await updatePreview(activity);

  const imageFields = discordImageFields(activity, currentDiscordImageUrl);
  const rpcPayload = {
    id: activity.id,
    details: activity.details,
    state: activity.state,
    category: activity.category,
    ...imageFields,
  };

  const result = await window.smiley.setActivity(rpcPayload, !isReselect);

  if (result?.error) {
    showToast(result.error, 'error');
    setConnectionStatus(false, result.error);
  } else if (result?.queued) {
    showToast('Update queued (Discord rate limit)', 'success');
  } else if (result?.success !== false) {
    showToast(`Now showing: ${activity.details}`);
    if (!isReselect) startTimer(Date.now());
  }
}

async function handleClear() {
  await window.smiley.clearActivity();
  selectedActivityId = null;
  renderActivityGrid();
  await updatePreview(null);
  showToast('Presence cleared');
}

// ─── Settings ────────────────────────────────────────────────────────
function openSettings(tab = 'general') {
  window.smiley.getConfig().then((cfg) => {
    currentSettings = { ...cfg };
    donateBanner.href = DONATION_URL;
    autoConnectToggle.checked = cfg.autoConnect !== false;
    minimizeTrayToggle.checked = cfg.minimizeToTray !== false;
    showTimerToggle.checked = cfg.showTimer !== false;
    animationsToggle.checked = cfg.animationsEnabled !== false;
    if (launchAtLoginToggle) launchAtLoginToggle.checked = cfg.launchAtLogin === true;
    if (hotkeyToggle) hotkeyToggle.checked = cfg.hotkeyEnabled !== false;
    if (hotkeyHint && cfg.hotkey) hotkeyHint.textContent = `Shortcut: ${cfg.hotkey.replace('CommandOrControl', 'Cmd/Ctrl')}`;

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
    showTimer: showTimerToggle.checked,
    animationsEnabled: animationsToggle.checked,
    theme: currentSettings.theme || 'dark',
    customAnimation: activeCustomAnimation ? 'custom' : null,
    launchAtLogin: launchAtLoginToggle?.checked === true,
    hotkeyEnabled: hotkeyToggle?.checked !== false,
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

// ─── Legal Modal ─────────────────────────────────────────────────────
async function showLegal(type) {
  const titles = { tos: 'Terms of Service', privacy: 'Privacy Policy' };
  const files = { tos: '../ToS.md', privacy: '../PRIVACY.md' };
  legalTitle.textContent = titles[type] || 'Legal';
  legalBody.innerHTML = '<p>Loading...</p>';
  legalModal.showModal();
  try {
    const res = await fetch(files[type]);
    const text = await res.text();
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
function handleUpdateStatus(data) {
  switch (data.status) {
    case 'checking':
      showToast('Checking for updates...');
      break;
    case 'dev-mode':
      showToast(data.message || 'Updates are only available in installed releases.');
      break;
    case 'no-release':
      showToast(data.message || 'No release on GitHub yet — open github.com/1tsRajuWu/Smiley/releases');
      break;
    case 'available':
      showToast(`Update v${data.version} available! Downloading...`);
      if (updateBannerText) updateBannerText.textContent = `Downloading v${data.version}…`;
      updateBanner?.classList.add('visible');
      break;
    case 'downloading':
      if (updateBannerText) updateBannerText.textContent = `Downloading update… ${data.percent || 0}%`;
      updateBanner?.classList.add('visible');
      break;
    case 'up-to-date':
      showToast('You are on the latest version!');
      break;
    case 'downloaded':
      if (updateBannerText) updateBannerText.textContent = `Update v${data.version} ready — restart to apply`;
      updateBanner?.classList.add('visible');
      showToast(`Update v${data.version} ready! Restart to apply.`);
      break;
    case 'error':
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

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderActivityGrid();
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

  if (tosLink) tosLink.addEventListener('click', (e) => { e.preventDefault(); showLegal('tos'); });
  if (privacyLink) privacyLink.addEventListener('click', (e) => { e.preventDefault(); showLegal('privacy'); });

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
      if (result.status === 'no-release') {
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

  if (updateDismissBtn) updateDismissBtn.addEventListener('click', () => updateBanner?.classList.remove('visible'));
  if (updateRestartBtn) {
    updateRestartBtn.addEventListener('click', async () => {
      const result = await window.smiley.installUpdate();
      if (!result?.success) showToast('No update ready — check again in a moment', 'error');
    });
  }

  window.smiley.onSelectActivity((id) => selectActivity(id));

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
