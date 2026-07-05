import { ACTIVITY_CATEGORIES, ALL_ACTIVITIES, fetchWaifuImage } from './activities.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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
const settingsForm = $('#settingsForm');
const closeSettings = $('#closeSettings');
const clientIdInput = $('#clientIdInput');
const donationInput = $('#donationInput');
const donateBanner = $('#donateBanner');
const toastContainer = $('#toastContainer');
const characterGif = $('#characterGif');
const characterLoading = $('#characterLoading');
const characterLabel = $('#characterLabel');
const characterSource = $('#characterSource');
const appEl = $('#app');
const footerVersion = $('#footerVersion');
const checkUpdateBtn = $('#checkUpdateBtn');
const legalModal = $('#legalModal');
const legalTitle = $('#legalTitle');
const legalBody = $('#legalBody');
const closeLegal = $('#closeLegal');
const tosLink = $('#tosLink');
const privacyLink = $('#privacyLink');

// Settings refs
const settingsTabs = $$('.settings-tab');
const settingsPanels = $$('.settings-panel');
const autoConnectToggle = $('#autoConnectToggle');
const minimizeTrayToggle = $('#minimizeTrayToggle');
const showTimerToggle = $('#showTimerToggle');
const animationsToggle = $('#animationsToggle');
const themeOptions = $$('.theme-option');
const customAnimationDrop = $('#customAnimationDrop');
const customAnimationList = $('#customAnimationList');

// ─── State ───────────────────────────────────────────────────────────
let activeCategory = ACTIVITY_CATEGORIES[0].id;
let selectedActivityId = null;
let sessionStart = null;
let timerInterval = null;
let searchQuery = '';
let currentSettings = {};
let customAnimations = [];
let activeCustomAnimation = null;
let currentWaifuUrl = null;

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

// ─── GIF Loading ─────────────────────────────────────────────────────
async function loadCharacterGif(category) {
  if (activeCustomAnimation) {
    setCharacterGif(activeCustomAnimation, 'Custom');
    return;
  }

  const cat = ACTIVITY_CATEGORIES.find((c) => c.id === category);
  if (!cat) {
    setCharacterGif(null, '');
    return;
  }

  // Show loading
  characterGif.style.display = 'none';
  characterLoading.style.display = 'flex';

  // Try waifu.pics API first
  let url = null;
  if (currentSettings.animationsEnabled !== false && cat.waifuTag) {
    try {
      url = await fetchWaifuImage(cat.waifuTag);
    } catch (e) { /* ignore */ }
  }

  // Fallback to Tenor GIF
  if (!url && cat.fallbackGif) {
    url = cat.fallbackGif;
  }

  currentWaifuUrl = url;
  setCharacterGif(url, cat.label);
}

function setCharacterGif(url, label) {
  characterLoading.style.display = 'none';
  if (!url) {
    characterGif.style.display = 'none';
    characterSource.textContent = '';
    return;
  }
  characterGif.src = url;
  characterGif.style.display = 'block';
  characterGif.classList.remove('character-gif-loaded');
  void characterGif.offsetWidth; // trigger reflow
  characterGif.classList.add('character-gif-loaded');
  characterSource.textContent = label ? `via waifu.pics · ${label}` : '';
}

// ─── Discord Preview ─────────────────────────────────────────────────
function updatePreview(activity) {
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
    loadCharacterGif(null);
    updateCharacterLabel(null);
    return;
  }

  const category = ACTIVITY_CATEGORIES.find((c) => c.id === activity.category);
  previewCard.classList.add('active');
  previewCard.style.setProperty('--card-glow', `${category?.color || '#7aa2f7'}33`);

  // Use GIF if available, else emoji
  if (currentWaifuUrl && currentSettings.animationsEnabled !== false) {
    previewEmoji.style.display = 'none';
    previewGif.src = currentWaifuUrl;
    previewGif.style.display = 'block';
  } else {
    previewGif.style.display = 'none';
    previewEmoji.textContent = activity.emoji;
    previewEmoji.style.display = '';
  }

  previewDetails.textContent = activity.details;
  previewState.textContent = activity.state || '';
  clearBtn.disabled = false;
  loadCharacterGif(activity.category);
  updateCharacterLabel(activity);
}

function updateCharacterLabel(activity) {
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
  return cat ? cat.activities.map((a) => ({ ...a, category: cat.id, categoryColor: cat.color, animationType: cat.animationType, waifuTag: cat.waifuTag, fallbackGif: cat.fallbackGif })) : [];
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
  updatePreview(activity);

  const rpcPayload = {
    details: activity.details,
    state: activity.state,
    largeImageKey: activity.largeImageKey,
    largeImageText: activity.largeImageText,
    smallImageKey: 'smiley',
    smallImageText: 'Smiley',
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
  updatePreview(null);
  showToast('Presence cleared');
}

// ─── Settings ────────────────────────────────────────────────────────
function openSettings(tab = 'general') {
  window.smiley.getConfig().then((cfg) => {
    currentSettings = { ...cfg };
    clientIdInput.value = cfg.clientId || '';
    donationInput.value = cfg.donationUrl || 'https://paypal.me/1tsRaj';
    autoConnectToggle.checked = cfg.autoConnect !== false;
    minimizeTrayToggle.checked = cfg.minimizeToTray !== false;
    showTimerToggle.checked = cfg.showTimer !== false;
    animationsToggle.checked = cfg.animationsEnabled !== false;

    themeOptions.forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.theme === (cfg.theme || 'dark'));
    });

    switchSettingsTab(tab);
    loadCustomAnimationsList();

    if (cfg.version) footerVersion.textContent = `Smiley v${cfg.version}`;

    settingsModal.showModal();
  });
}

function switchSettingsTab(tabId) {
  settingsTabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tabId));
  settingsPanels.forEach((p) => p.classList.toggle('active', p.dataset.panel === tabId));
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const clientId = clientIdInput.value.trim();
  const donationUrl = donationInput.value.trim() || 'https://paypal.me/1tsRaj';

  if (!/^\d+$/.test(clientId)) {
    showToast('Client ID must be numeric', 'error');
    return;
  }

  const newSettings = {
    clientId, donationUrl,
    autoConnect: autoConnectToggle.checked,
    minimizeToTray: minimizeTrayToggle.checked,
    showTimer: showTimerToggle.checked,
    animationsEnabled: animationsToggle.checked,
    theme: currentSettings.theme || 'dark',
    customAnimation: activeCustomAnimation ? 'custom' : null,
  };

  const result = await window.smiley.saveConfig(newSettings);
  settingsModal.close();

  if (donationUrl) donateBanner.href = donationUrl;
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
const LEGAL_CONTENT = {
  tos: { title: 'Terms of Service', file: 'ToS.md' },
  privacy: { title: 'Privacy Policy', file: 'PRIVACY.md' },
};

async function showLegal(type) {
  const info = LEGAL_CONTENT[type];
  if (!info) return;
  legalTitle.textContent = info.title;
  legalBody.innerHTML = '<p>Loading...</p>';
  legalModal.showModal();
  try {
    const res = await fetch(info.file);
    const text = await res.text();
    // Simple markdown to HTML
    const html = text
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\|([^|]+)\|([^|]+)\|/g, '<tr><td>$1</td><td>$2</td></tr>')
      .replace(/\n/g, '<br>');
    legalBody.innerHTML = `<div class="legal-content">${html}</div>`;
  } catch (e) {
    legalBody.innerHTML = '<p>Failed to load. Please check the file in the app folder.</p>';
  }
}

// ─── Update Status ───────────────────────────────────────────────────
function handleUpdateStatus(data) {
  switch (data.status) {
    case 'checking':
      showToast('Checking for updates...');
      break;
    case 'available':
      showToast(`Update v${data.version} available! Downloading...`);
      break;
    case 'up-to-date':
      showToast('You are on the latest version!');
      break;
    case 'downloading':
      // silent
      break;
    case 'downloaded':
      showToast(`Update v${data.version} ready! Restart to apply.`);
      break;
    case 'error':
      showToast(`Update check failed: ${data.error}`, 'error');
      break;
  }
}

// ─── Initialization ──────────────────────────────────────────────────
async function init() {
  renderCategoryTabs();
  renderActivityGrid();

  settingsBtn.addEventListener('click', () => openSettings('general'));
  minimizeBtn.addEventListener('click', () => window.smiley.minimizeWindow());
  closeSettings.addEventListener('click', () => settingsModal.close());
  settingsForm.addEventListener('submit', handleSaveSettings);
  clearBtn.addEventListener('click', handleClear);

  checkUpdateBtn?.addEventListener('click', () => {
    window.smiley.checkForUpdates();
    showToast('Checking for updates...');
  });

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
  if (closeLegal) closeLegal.addEventListener('click', () => legalModal.close());

  // Events
  window.smiley.onStatus((data) => {
    if (data.donationUrl) donateBanner.href = data.donationUrl;
    if (data.settings) {
      currentSettings = { ...currentSettings, ...data.settings };
      applyTheme(data.settings.theme);
      const timerEl = $('#previewTimer');
      if (timerEl) timerEl.style.display = data.settings.showTimer !== false ? '' : 'none';
    }
    if (data.version) footerVersion.textContent = `Smiley v${data.version}`;
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
    else {
      setConnectionStatus(false, result.error);
      if (result.error?.includes('Client ID')) setTimeout(() => openSettings('general'), 500);
    }
  });

  window.smiley.onOpenSettings(() => {
    openSettings('general');
  });

  window.smiley.onUpdateStatus(handleUpdateStatus);

  const cfg = await window.smiley.getConfig();
  currentSettings = { ...currentSettings, ...cfg };
  applyTheme(cfg.theme || 'dark');
  if (cfg.version) footerVersion.textContent = `Smiley v${cfg.version}`;
  if (cfg.donationUrl) donateBanner.href = cfg.donationUrl;

  if (!cfg.hasValidClientId) {
    setConnectionStatus(false, 'Set your Client ID');
    setTimeout(() => openSettings('general'), 800);
  }

  const status = await window.smiley.getStatus();
  if (status.activity) {
    const match = ALL_ACTIVITIES.find((a) => a.details === status.activity.details && a.state === status.activity.state);
    if (match) {
      selectedActivityId = match.id;
      renderActivityGrid();
      updatePreview({ ...match, category: match.category });
    }
    if (status.sessionStart) startTimer(status.sessionStart);
  }

  const timerEl = $('#previewTimer');
  if (timerEl) timerEl.style.display = cfg.showTimer !== false ? '' : 'none';
}

init();
