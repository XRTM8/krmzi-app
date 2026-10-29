/**
 * KRMZI - Professional Minimalist UI/UX Engine
 */

const state = {
  activeTab: 'home',
  librarySubtab: 'favs',
  episodes: [],
  series: [],
  filteredSeries: [],
  activeFilter: 'all',
  currentEpisode: null,
  currentSeries: null,
  currentSeriesEpisodes: [],
  activeServer: null,
  activeQuality: null,
  brightness: 1.0,
  favorites: JSON.parse(localStorage.getItem('krmzi_favs') || '[]'),
  history: JSON.parse(localStorage.getItem('krmzi_hist') || '[]'),
  preferredQuality: localStorage.getItem('krmzi_pref_quality') || '1080p (Full HD)',
  hudTimeout: null,
  autoNextTimerId: null,
  autoNextCancelled: false,
  currentVersion: '1.0.4',
  pendingUpdate: null
};

// DOM References
const contentCanvas = document.getElementById('contentCanvas');
const pullRefreshIndicator = document.getElementById('pullRefreshIndicator');
const brandBtn = document.getElementById('brandBtn');

// Spotlight
const heroSpotlight = document.getElementById('heroSpotlight');
const spotlightMedia = document.getElementById('spotlightMedia');
const spotlightTitle = document.getElementById('spotlightTitle');
const spotlightBadgeText = document.getElementById('spotlightBadgeText');
const spotlightProgressWrap = document.getElementById('spotlightProgressWrap');
const spotlightProgressBar = document.getElementById('spotlightProgressBar');
const spotlightProgressText = document.getElementById('spotlightProgressText');
const spotlightPlayBtn = document.getElementById('spotlightPlayBtn');
const spotlightPlayBtnText = document.getElementById('spotlightPlayBtnText');
const spotlightSeriesBtn = document.getElementById('spotlightSeriesBtn');

// Feed Sections
const historySection = document.getElementById('historySection');
const historyCarousel = document.getElementById('historyCarousel');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const episodesSection = document.getElementById('episodesSection');
const episodesCarousel = document.getElementById('episodesCarousel');
const genrePills = document.querySelectorAll('.genre-pill');
const seriesSection = document.getElementById('seriesSection');
const seriesGrid = document.getElementById('seriesGrid');
const seriesCountSub = document.getElementById('seriesCountSub');

// Library
const libraryView = document.getElementById('libraryView');
const libraryGrid = document.getElementById('libraryGrid');
const segmentBtns = document.querySelectorAll('.segment-btn');

// Dock
const dockBtns = document.querySelectorAll('.dock-btn');

// Search Modal
const openSearchBtn = document.getElementById('openSearchBtn');
const searchOverlay = document.getElementById('searchOverlay');
const closeSearchOverlay = document.getElementById('closeSearchOverlay');
const overlaySearchInput = document.getElementById('overlaySearchInput');
const clearSearchInput = document.getElementById('clearSearchInput');
const searchInitialState = document.getElementById('searchInitialState');
const searchGrid = document.getElementById('searchGrid');

// Player Screen
const mobilePlayer = document.getElementById('mobilePlayer');
const playerCanvas = document.getElementById('playerCanvas');
const nativePlayer = document.getElementById('nativePlayer');
const embedPlayer = document.getElementById('embedPlayer');
const brightnessFilter = document.getElementById('brightnessFilter');
const speed2xPill = document.getElementById('speed2xPill');
const swipeIndicator = document.getElementById('swipeIndicator');
const swipeIcon = document.getElementById('swipeIcon');
const swipeValue = document.getElementById('swipeValue');

const skipIntroBtn = document.getElementById('skipIntroBtn');
const autoNextCard = document.getElementById('autoNextCard');
const autoNextTitle = document.getElementById('autoNextTitle');
const autoNextTimer = document.getElementById('autoNextTimer');
const autoNextPlayBtn = document.getElementById('autoNextPlayBtn');
const autoNextCancelBtn = document.getElementById('autoNextCancelBtn');

const playerSpinner = document.getElementById('playerSpinner');
const gesturesLayer = document.getElementById('gesturesLayer');
const rippleLeft = document.getElementById('rippleLeft');
const rippleRight = document.getElementById('rippleRight');

const playerHudTop = document.getElementById('playerHudTop');
const playerHudBottom = document.getElementById('playerHudBottom');
const dismissPlayerBtn = document.getElementById('dismissPlayerBtn');
const hudEpTitle = document.getElementById('hudEpTitle');
const hudSeriesTitle = document.getElementById('hudSeriesTitle');
const playerFavBtn = document.getElementById('playerFavBtn');

const hudCenter = document.getElementById('hudCenter');
const centerPlay = document.getElementById('centerPlay');
const centerRewind = document.getElementById('centerRewind');
const centerForward = document.getElementById('centerForward');

const timelineBar = document.getElementById('timelineBar');
const timelineLoaded = document.getElementById('timelineLoaded');
const timelineProgress = document.getElementById('timelineProgress');
const timelineThumb = document.getElementById('timelineThumb');
const hudTime = document.getElementById('hudTime');

const openServersSheetBtn = document.getElementById('openServersSheetBtn');
const activeServerLabel = document.getElementById('activeServerLabel');
const openQualitySheetBtn = document.getElementById('openQualitySheetBtn');
const activeQualityLabel = document.getElementById('activeQualityLabel');
const togglePipBtn = document.getElementById('togglePipBtn');
const toggleFullscreenBtn = document.getElementById('toggleFullscreenBtn');

const drawerEpisodesCarousel = document.getElementById('drawerEpisodesCarousel');
const drawerCount = document.getElementById('drawerCount');

// Bottom Sheet
const sheetBackdrop = document.getElementById('sheetBackdrop');
const sheetTitle = document.getElementById('sheetTitle');
const sheetBody = document.getElementById('sheetBody');
const closeSheetBtn = document.getElementById('closeSheetBtn');

// Offline & Error
const offlineState = document.getElementById('offlineState');
const retryBtn = document.getElementById('retryBtn');

// In-App Updates System
const appVersionCard = document.getElementById('appVersionCard');
const installedVersionText = document.getElementById('installedVersionText');
const manualCheckUpdateBtn = document.getElementById('manualCheckUpdateBtn');
const checkUpdateIcon = document.getElementById('checkUpdateIcon');
const checkUpdateBtnText = document.getElementById('checkUpdateBtnText');

const updateModalScrim = document.getElementById('updateModalScrim');
const updateSheet = document.getElementById('updateSheet');
const updateModalTitle = document.getElementById('updateModalTitle');
const updateModalVersion = document.getElementById('updateModalVersion');
const updateChangelog = document.getElementById('updateChangelog');
const confirmUpdateBtn = document.getElementById('confirmUpdateBtn');
const dismissUpdateBtn = document.getElementById('dismissUpdateBtn');

// Centralized Native-First API Call
async function apiCall(endpoint, params = {}) {
  // 1. Android Native Bridge (Zero CORS, zero network handshake, direct Kotlin speed)
  if (window.KrmziBridge) {
    try {
      let rawJson = null;
      if (endpoint === '/api/episodes') {
        rawJson = window.KrmziBridge.getEpisodes(parseInt(params.page) || 1);
      } else if (endpoint === '/api/series') {
        rawJson = window.KrmziBridge.getSeries(parseInt(params.page) || 1);
      } else if (endpoint === '/api/series/detail') {
        rawJson = window.KrmziBridge.getSeriesDetail(params.url || '');
      } else if (endpoint === '/api/episode/detail') {
        rawJson = window.KrmziBridge.getEpisodeDetail(params.url || '');
      } else if (endpoint === '/api/search') {
        rawJson = window.KrmziBridge.search(params.q || '');
      }
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (parsed) return parsed;
      }
    } catch (bridgeErr) {
      console.warn('KrmziBridge execution failed, falling back to fetch:', bridgeErr);
    }
  }

  // 2. Fetch fallback (for Node development or WebViewAssetLoader)
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${endpoint}?${qs}` : endpoint;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`);
  }
  return await res.json();
}

function showOfflineState() {
  if (offlineState) offlineState.classList.remove('hidden');
}

function hideOfflineState() {
  if (offlineState) offlineState.classList.add('hidden');
}

function checkAndShowOffline() {
  if (state.episodes.length === 0 && state.series.length === 0) {
    showOfflineState();
    spotlightTitle.textContent = 'تعذر الاتصال بالموقع';
    spotlightBadgeText.textContent = 'غير متصل';
  }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupPullToRefresh();
  setupGenreFilter();
  setupSearch();
  setupPlayerTouch();
  setupBottomSheet();
  setupUpdateSystem();
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      haptic();
      loadData(true);
    });
  }
  loadData();
});

// Haptic Touch
function haptic(intensity = 'light') {
  if (navigator.vibrate) {
    try {
      if (intensity === 'heavy') navigator.vibrate([20]);
      else if (intensity === 'double') navigator.vibrate([8, 25, 8]);
      else navigator.vibrate([6]);
    } catch (e) {}
  }
}

// Initial Data
async function loadData(isRefresh = false) {
  renderHistory();
  hideOfflineState();
  if (isRefresh) {
    haptic('double');
  }
  try {
    await Promise.all([fetchEpisodes(), fetchSeries()]);
  } catch (err) {
    console.error('Error during initial loadData:', err);
    checkAndShowOffline();
  }
}

// Navigation Dock
function setupNavigation() {
  brandBtn.addEventListener('click', () => {
    haptic();
    switchTab('home');
  });

  dockBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      haptic();
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      haptic();
      segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.librarySubtab = btn.dataset.subtab;
      renderLibrary();
    });
  });

  clearHistoryBtn.addEventListener('click', () => {
    haptic('heavy');
    state.history = [];
    localStorage.removeItem('krmzi_hist');
    historySection.classList.add('hidden');
    if (state.activeTab === 'library') renderLibrary();
  });
}

function switchTab(tab) {
  state.activeTab = tab;
  dockBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  if (tab === 'home') {
    heroSpotlight.classList.remove('hidden');
    episodesSection.classList.remove('hidden');
    seriesSection.classList.remove('hidden');
    libraryView.classList.add('hidden');
    renderHistory();
  } else if (tab === 'series') {
    heroSpotlight.classList.add('hidden');
    episodesSection.classList.add('hidden');
    seriesSection.classList.remove('hidden');
    historySection.classList.add('hidden');
    libraryView.classList.add('hidden');
  } else if (tab === 'search') {
    openSearch();
    return;
  } else if (tab === 'library') {
    heroSpotlight.classList.add('hidden');
    episodesSection.classList.add('hidden');
    seriesSection.classList.add('hidden');
    historySection.classList.add('hidden');
    libraryView.classList.remove('hidden');
    renderLibrary();
  }

  contentCanvas.scrollTo({ top: 0, behavior: 'smooth' });
}

// Pull to Refresh
function setupPullToRefresh() {
  let startY = 0;
  let isPulling = false;

  contentCanvas.addEventListener('touchstart', (e) => {
    if (contentCanvas.scrollTop === 0) {
      startY = e.touches[0].clientY;
      isPulling = true;
    }
  }, { passive: true });

  contentCanvas.addEventListener('touchmove', (e) => {
    if (!isPulling || contentCanvas.scrollTop > 0) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 45) {
      pullRefreshIndicator.classList.add('visible');
    }
  }, { passive: true });

  contentCanvas.addEventListener('touchend', async () => {
    if (pullRefreshIndicator.classList.contains('visible')) {
      haptic('heavy');
      await loadData(true);
      setTimeout(() => {
        pullRefreshIndicator.classList.remove('visible');
      }, 400);
    }
    isPulling = false;
  });
}

// Genre Filter
function setupGenreFilter() {
  genrePills.forEach(pill => {
    pill.addEventListener('click', () => {
      haptic();
      genrePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeFilter = pill.dataset.filter;
      applyGenreFilter();
    });
  });
}

function applyGenreFilter() {
  if (state.activeFilter === 'all') {
    state.filteredSeries = state.series;
  } else {
    state.filteredSeries = state.series.filter(s => s.title.includes(state.activeFilter));
  }
  renderSeriesGrid(state.filteredSeries);
}

// Fetch Episodes
async function fetchEpisodes() {
  renderEpisodesSkeleton();
  try {
    const data = await apiCall('/api/episodes', { page: 1 });
    state.episodes = data.episodes || [];

    if (state.episodes.length > 0) {
      renderSpotlight(state.episodes[0]);
      renderEpisodesCarousel(state.episodes);
      hideOfflineState();
    } else {
      checkAndShowOffline();
    }
    return data;
  } catch (err) {
    console.error('Failed to load episodes:', err);
    checkAndShowOffline();
    throw err;
  }
}

// Fetch Series
async function fetchSeries() {
  renderSeriesSkeleton();
  try {
    const data = await apiCall('/api/series', { page: 1 });
    state.series = data.series || [];
    state.filteredSeries = state.series;
    if (seriesCountSub) {
      seriesCountSub.textContent = `${state.series.length} مسلسل`;
    }
    renderSeriesGrid(state.filteredSeries);
    return data;
  } catch (err) {
    console.error('Failed to load series:', err);
    checkAndShowOffline();
    throw err;
  }
}

function renderPinnedResume() {
  if (state.history.length > 0) {
    const item = state.history[0];
    if (item.thumbnail) {
      spotlightMedia.style.backgroundImage = `url(${item.thumbnail})`;
    }
    spotlightTitle.textContent = item.seriesTitle || item.title;
    
    const epNumText = item.episodeNum ? `الحلقة ${item.episodeNum}` : '';
    spotlightBadgeText.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> مثبت • آخر ما شاهدت ${epNumText ? '• ' + epNumText : ''}`;
    
    // Progress calculation
    const duration = item.duration || 1;
    const cur = item.currentTime || 0;
    const pct = Math.min(100, Math.max(0, Math.round((cur / duration) * 100)));
    
    spotlightProgressWrap.classList.remove('hidden');
    spotlightProgressBar.style.width = `${pct}%`;
    spotlightProgressText.textContent = `وصلت إلى ${formatTime(cur)} / ${formatTime(duration)} (${pct}%)`;
    
    spotlightPlayBtnText.textContent = item.episodeNum ? `استئناف حلقة ${item.episodeNum}` : 'متابعة المشاهدة';
    
    spotlightPlayBtn.onclick = () => {
      haptic('heavy');
      openEpisode(item.url);
    };
    
    spotlightSeriesBtn.onclick = () => {
      haptic();
      if (item.seriesUrl) {
        openSeriesByUrl(item.seriesUrl);
      } else {
        searchSeries(item.seriesTitle || item.title);
      }
    };
    return true;
  } else {
    spotlightProgressWrap.classList.add('hidden');
    spotlightPlayBtnText.textContent = 'مشاهدة الحلقة';
    return false;
  }
}

function renderSpotlight(ep) {
  // If user has watched history, prioritize pinning their latest watched series at the top!
  if (renderPinnedResume()) {
    return;
  }

  spotlightMedia.style.backgroundImage = `url(${ep.thumbnail})`;
  spotlightTitle.textContent = ep.title;
  spotlightBadgeText.textContent = ep.episodeNum ? `الحلقة ${ep.episodeNum}` : 'الأحدث الآن';
  spotlightProgressWrap.classList.add('hidden');
  spotlightPlayBtnText.textContent = 'مشاهدة الحلقة';

  spotlightPlayBtn.onclick = () => {
    haptic();
    openEpisode(ep.url);
  };
  spotlightSeriesBtn.onclick = () => {
    haptic();
    searchSeries(ep.seriesTitle);
  };
}

function renderEpisodesCarousel(episodes) {
  episodesCarousel.innerHTML = episodes.map(ep => `
    <div class="ep-tile" onclick="haptic(); openEpisode('${ep.url}')">
      <div class="ep-tile-poster">
        <img src="${ep.thumbnail}" alt="${ep.title}" class="ep-tile-img" loading="lazy">
        ${ep.episodeNum ? `<div class="ep-tile-badge">حلقة <span>${ep.episodeNum}</span></div>` : ''}
      </div>
      <div class="ep-tile-name">${ep.title}</div>
      <div class="ep-tile-series">${ep.seriesTitle}</div>
    </div>
  `).join('');
}

function renderSeriesGrid(seriesList) {
  if (seriesList.length === 0) {
    seriesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 30px 0; font-size: 13px;">لا توجد مسلسلات تطابق هذا التصنيف.</p>`;
    return;
  }
  seriesGrid.innerHTML = seriesList.map(ser => `
    <div class="series-tile" onclick="haptic(); openSeriesByUrl('${ser.url}')">
      <img src="${ser.thumbnail}" alt="${ser.title}" class="series-tile-thumb" loading="lazy">
      <div class="series-tile-body">
        <div class="series-tile-title">${ser.title}</div>
        <div class="series-tile-sub">تصفح الحلقات</div>
      </div>
    </div>
  `).join('');
}

function renderHistory() {
  renderPinnedResume();

  if (state.history.length === 0) {
    historySection.classList.add('hidden');
    return;
  }
  historySection.classList.remove('hidden');

  historyCarousel.innerHTML = state.history.map(item => {
    const progressPercent = item.duration ? Math.min(100, (item.currentTime / item.duration) * 100) : 0;
    return `
      <div class="ep-tile" onclick="haptic(); openEpisode('${item.url}')">
        <div class="ep-tile-poster">
          <img src="${item.thumbnail}" alt="${item.title}" class="ep-tile-img">
          <div class="tile-progress-track">
            <div class="tile-progress-fill" style="width: ${progressPercent}%;"></div>
          </div>
          ${item.episodeNum ? `<div class="ep-tile-badge">حلقة <span>${item.episodeNum}</span></div>` : ''}
        </div>
        <div class="ep-tile-name">${item.seriesTitle || item.title}</div>
        <div class="ep-tile-series">وصلت إلى ${formatTime(item.currentTime)} (${Math.round(progressPercent)}%)</div>
      </div>
    `;
  }).join('');
}

function renderLibrary() {
  if (state.librarySubtab === 'favs') {
    if (state.favorites.length === 0) {
      libraryGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 60px 0; font-size: 13px;">لم تقم بإضافة مسلسلات للمفضلة بعد.</p>`;
      return;
    }
    libraryGrid.innerHTML = state.favorites.map(fav => `
      <div class="series-tile" onclick="haptic(); openEpisode('${fav.url}')">
        <img src="${fav.thumbnail}" alt="${fav.title}" class="series-tile-thumb">
        <div class="series-tile-body">
          <div class="series-tile-title">${fav.title}</div>
          <div class="series-tile-sub"><i class="fa-solid fa-play"></i> استئناف</div>
        </div>
      </div>
    `).join('');
  } else {
    if (state.history.length === 0) {
      libraryGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 60px 0; font-size: 13px;">سجل المشاهدة فارغ.</p>`;
      return;
    }
    libraryGrid.innerHTML = state.history.map(hist => `
      <div class="series-tile" onclick="haptic(); openEpisode('${hist.url}')">
        <img src="${hist.thumbnail}" alt="${hist.title}" class="series-tile-thumb">
        <div class="series-tile-body">
          <div class="series-tile-title">${hist.title}</div>
          <div class="series-tile-sub">متبقي ${formatTime((hist.duration || 0) - hist.currentTime)}</div>
        </div>
      </div>
    `).join('');
  }
}

// Skeletons
function renderEpisodesSkeleton() {
  episodesCarousel.innerHTML = Array(4).fill(0).map(() => `
    <div class="ep-tile">
      <div class="ep-tile-poster skeleton-cell"></div>
      <div class="skeleton-cell" style="height: 12px; border-radius: 4px; margin-top: 4px;"></div>
    </div>
  `).join('');
}

function renderSeriesSkeleton() {
  seriesGrid.innerHTML = Array(4).fill(0).map(() => `
    <div class="series-tile">
      <div class="skeleton-cell" style="aspect-ratio: 16/11;"></div>
      <div class="series-tile-body">
        <div class="skeleton-cell" style="height: 12px; border-radius: 4px;"></div>
      </div>
    </div>
  `).join('');
}

// Search System
function setupSearch() {
  openSearchBtn.addEventListener('click', () => {
    haptic();
    openSearch();
  });
  closeSearchOverlay.addEventListener('click', () => {
    haptic();
    closeSearch();
  });

  let searchTimer;
  overlaySearchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearSearchInput.classList.toggle('hidden', !q);
    clearTimeout(searchTimer);

    if (!q) {
      searchInitialState.classList.remove('hidden');
      searchGrid.classList.add('hidden');
      return;
    }

    searchTimer = setTimeout(() => executeSearch(q), 300);
  });

  clearSearchInput.addEventListener('click', () => {
    haptic();
    overlaySearchInput.value = '';
    clearSearchInput.classList.add('hidden');
    searchInitialState.classList.remove('hidden');
    searchGrid.classList.add('hidden');
  });
}

function openSearch() {
  searchOverlay.classList.remove('hidden');
  setTimeout(() => overlaySearchInput.focus(), 100);
}

function closeSearch() {
  searchOverlay.classList.add('hidden');
  overlaySearchInput.value = '';
  clearSearchInput.classList.add('hidden');
  searchInitialState.classList.remove('hidden');
  searchGrid.classList.add('hidden');
}

async function executeSearch(query) {
  searchInitialState.classList.add('hidden');
  searchGrid.classList.remove('hidden');
  searchGrid.innerHTML = Array(4).fill(0).map(() => `
    <div class="series-tile"><div class="skeleton-cell" style="aspect-ratio: 16/11;"></div></div>
  `).join('');

  try {
    const data = await apiCall('/api/search', { q: query });
    renderSearchResults(data.results || []);
  } catch (e) {
    searchGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 40px 0;">تعذر البحث. يرجى المحاولة لاحقاً.</p>`;
  }
}

function renderSearchResults(results) {
  if (results.length === 0) {
    searchGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 50px 0; font-size: 13px;">لم يتم العثور على نتائج.</p>`;
    return;
  }

  searchGrid.innerHTML = results.map(item => {
    const isSeries = item.type === 'series';
    const clickFn = isSeries ? `openSeriesByUrl('${item.url}')` : `openEpisode('${item.url}')`;
    return `
      <div class="series-tile" onclick="closeSearch(); haptic(); ${clickFn}">
        <img src="${item.thumbnail}" alt="${item.title}" class="series-tile-thumb" loading="lazy">
        <div class="series-tile-body">
          <div class="series-tile-title">${item.title}</div>
          <div class="series-tile-sub">${isSeries ? 'مسلسل كامل' : 'حلقة'}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Player Logic
async function openEpisode(epUrl) {
  mobilePlayer.classList.remove('hidden');
  playerSpinner.classList.remove('hidden');
  resetPlayer();

  hudEpTitle.textContent = 'جاري التحميل...';
  hudSeriesTitle.textContent = '';

  try {
    const ep = await apiCall('/api/episode/detail', { url: epUrl });
    state.currentEpisode = ep;

    // Immediately save to history so it's pinned to the top as the latest watched episode!
    saveHistory(true);

    hudEpTitle.textContent = ep.title;
    hudSeriesTitle.textContent = ep.episodeNum ? `الحلقة ${ep.episodeNum}` : '';

    refreshFavState();

    if (ep.seriesUrl) {
      loadDrawer(ep.seriesUrl, ep.url);
    }

    if (ep.directStreams && ep.directStreams.length > 0) {
      playDirectStream(ep.directStreams);
    } else if (ep.servers && ep.servers.length > 0) {
      playSandboxedEmbed(ep.servers[0]);
    } else {
      playerSpinner.innerHTML = '<p style="font-size: 13px;">لم تتوفر سيرفرات بث لهذه الحلقة.</p>';
    }
  } catch (err) {
    console.error('Failed to open episode:', err);
    playerSpinner.innerHTML = '<p style="font-size: 13px; color: #ff5555;">تعذر تشغيل الحلقة. تحقق من الاتصال.</p>';
  }
}

let directWatchdogTimer = null;
let currentDirectIndex = 0;

function clearDirectWatchdog() {
  if (directWatchdogTimer) {
    clearTimeout(directWatchdogTimer);
    directWatchdogTimer = null;
  }
}

function resetPlayer() {
  clearDirectWatchdog();
  nativePlayer.pause();
  nativePlayer.src = '';
  embedPlayer.src = 'about:blank';
  mobilePlayer.classList.remove('embed-mode');
  timelineProgress.style.width = '0%';
  timelineThumb.style.right = '0%';
  hudTime.textContent = '00:00 / 00:00';
  skipIntroBtn.classList.add('hidden');
  autoNextCard.classList.add('hidden');
  clearInterval(state.autoNextTimerId);
  state.autoNextCancelled = false;
}

function playDirectStream(streams, index = 0) {
  clearDirectWatchdog();
  mobilePlayer.classList.remove('embed-mode');
  embedPlayer.classList.add('hidden');
  embedPlayer.src = 'about:blank';
  nativePlayer.classList.remove('hidden');
  playerSpinner.classList.remove('hidden');

  currentDirectIndex = index;
  let selected = streams[currentDirectIndex];
  if (!selected) {
    fallbackToEmbedServer();
    return;
  }

  state.activeQuality = selected;
  state.activeServer = { name: 'مباشر (بدون إعلانات ⚡)' };
  activeServerLabel.textContent = 'مباشر ⚡';
  activeQualityLabel.textContent = selected.quality;

  nativePlayer.onerror = (e) => {
    console.warn(`Direct stream quality ${selected.quality} error, trying next...`);
    clearDirectWatchdog();
    if (currentDirectIndex + 1 < streams.length) {
      playDirectStream(streams, currentDirectIndex + 1);
    } else {
      fallbackToEmbedServer();
    }
  };

  // Watchdog: If playback doesn't start within 5.5 seconds, auto try next stream or embed
  directWatchdogTimer = setTimeout(() => {
    if (nativePlayer.readyState < 2 && nativePlayer.currentTime === 0) {
      console.warn(`Direct stream stall on quality ${selected.quality}, trying next...`);
      if (currentDirectIndex + 1 < streams.length) {
        playDirectStream(streams, currentDirectIndex + 1);
      } else {
        fallbackToEmbedServer();
      }
    }
  }, 5500);

  nativePlayer.oncanplay = () => {
    playerSpinner.classList.add('hidden');
  };

  nativePlayer.onplaying = () => {
    clearDirectWatchdog();
    playerSpinner.classList.add('hidden');
  };

  nativePlayer.src = selected.url;

  const saved = state.history.find(h => h.url === state.currentEpisode.url);
  if (saved && saved.currentTime > 10) {
    nativePlayer.currentTime = saved.currentTime;
  }

  nativePlayer.play().catch(err => {
    console.warn('Native player play catch:', err);
  });
  showHud();
}

function fallbackToEmbedServer() {
  clearDirectWatchdog();
  const ep = state.currentEpisode;
  if (ep && ep.servers && ep.servers.length > 0) {
    showPill('fa-rotate', 'تم الانتقال لسيرفر بديل');
    playSandboxedEmbed(ep.servers[0]);
  } else {
    playerSpinner.innerHTML = '<p style="font-size: 13px; color: #ff5555;">تعذر تشغيل الفيديو من جميع السيرفرات.</p>';
  }
}

function playSandboxedEmbed(server) {
  clearDirectWatchdog();
  nativePlayer.pause();
  nativePlayer.src = '';
  nativePlayer.classList.add('hidden');
  playerSpinner.classList.add('hidden');

  mobilePlayer.classList.add('embed-mode');
  embedPlayer.classList.remove('hidden');
  embedPlayer.src = server.embedUrl;

  state.activeServer = server;
  activeServerLabel.textContent = server.name;
  activeQualityLabel.textContent = 'تلقائي';
  showHud();
}

// Touch Gestures: Swipes, 2x Hold & Seek
function setupPlayerTouch() {
  dismissPlayerBtn.addEventListener('click', () => {
    haptic();
    closePlayer();
  });

  let touchStartX = 0;
  let touchStartY = 0;
  let longPressTimer = null;
  let is2xActive = false;
  let isVerticalSwipe = false;
  let swipeTarget = null;
  let startVal = 1;
  let lastTapTime = 0;

  gesturesLayer.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isVerticalSwipe = false;
    is2xActive = false;

    const rect = gesturesLayer.getBoundingClientRect();
    const xPos = touch.clientX - rect.left;
    swipeTarget = xPos < rect.width / 2 ? 'brightness' : 'volume';
    startVal = swipeTarget === 'brightness' ? state.brightness : nativePlayer.volume;

    longPressTimer = setTimeout(() => {
      if (!nativePlayer.paused && !isVerticalSwipe) {
        is2xActive = true;
        haptic('double');
        nativePlayer.playbackRate = 2.0;
        speed2xPill.classList.remove('hidden');
      }
    }, 350);
  }, { passive: true });

  gesturesLayer.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
      clearTimeout(longPressTimer);
      isVerticalSwipe = true;

      const delta = -dy / 140;
      const newVal = Math.max(0.1, Math.min(1.0, startVal + delta));

      if (swipeTarget === 'brightness') {
        state.brightness = newVal;
        const darkness = (1 - newVal) * 0.85;
        brightnessFilter.style.setProperty('--brightness-darkness', darkness);
        showPill('fa-sun', `${Math.round(newVal * 100)}%`);
      } else {
        nativePlayer.volume = newVal;
        const icon = newVal === 0 ? 'fa-volume-xmark' : newVal < 0.5 ? 'fa-volume-low' : 'fa-volume-high';
        showPill(icon, `${Math.round(newVal * 100)}%`);
      }
    }
  }, { passive: true });

  gesturesLayer.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);

    if (is2xActive) {
      is2xActive = false;
      haptic();
      nativePlayer.playbackRate = 1.0;
      speed2xPill.classList.add('hidden');
      return;
    }

    if (isVerticalSwipe) {
      setTimeout(() => swipeIndicator.classList.add('hidden'), 450);
      return;
    }

    const now = Date.now();
    const tapLength = now - lastTapTime;
    const rect = gesturesLayer.getBoundingClientRect();
    const isLeftHalf = (touchStartX - rect.left) < rect.width / 2;

    if (tapLength < 300 && tapLength > 0) {
      haptic('double');
      if (isLeftHalf) {
        seekRelative(-10);
        triggerRipple(rippleLeft);
      } else {
        seekRelative(10);
        triggerRipple(rippleRight);
      }
    } else {
      toggleHud();
    }
    lastTapTime = now;
  });

  centerPlay.addEventListener('click', () => {
    haptic();
    togglePlay();
  });
  centerRewind.addEventListener('click', () => {
    haptic();
    seekRelative(-10);
  });
  centerForward.addEventListener('click', () => {
    haptic();
    seekRelative(10);
  });

  skipIntroBtn.addEventListener('click', () => {
    haptic('heavy');
    nativePlayer.currentTime += 85;
    skipIntroBtn.classList.add('hidden');
  });

  autoNextPlayBtn.addEventListener('click', () => {
    haptic();
    playNextEpisodeNow();
  });
  autoNextCancelBtn.addEventListener('click', () => {
    haptic();
    state.autoNextCancelled = true;
    autoNextCard.classList.add('hidden');
    clearInterval(state.autoNextTimerId);
  });

  timelineBar.addEventListener('click', (e) => {
    if (!nativePlayer.duration) return;
    haptic();
    const rect = timelineBar.getBoundingClientRect();
    const pos = (rect.right - e.clientX) / rect.width;
    nativePlayer.currentTime = pos * nativePlayer.duration;
  });

  nativePlayer.addEventListener('timeupdate', onTimeUpdate);
  nativePlayer.addEventListener('progress', onProgress);
  nativePlayer.addEventListener('play', () => {
    centerPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
    resetHudTimer();
    if (window.KrmziBridge && window.KrmziBridge.setVideoPlaying) {
      window.KrmziBridge.setVideoPlaying(true);
    }
  });
  nativePlayer.addEventListener('pause', () => {
    centerPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
    showHud(false);
    if (window.KrmziBridge && window.KrmziBridge.setVideoPlaying) {
      window.KrmziBridge.setVideoPlaying(false);
    }
  });

  openServersSheetBtn.addEventListener('click', () => {
    haptic();
    openServersSheet();
  });
  openQualitySheetBtn.addEventListener('click', () => {
    haptic();
    openQualitySheet();
  });

  togglePipBtn.addEventListener('click', () => {
    haptic();
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else if (nativePlayer.requestPictureInPicture) {
      nativePlayer.requestPictureInPicture().catch(() => {});
    }
  });

  toggleFullscreenBtn.addEventListener('click', () => {
    haptic();
    if (!document.fullscreenElement) {
      playerCanvas.requestFullscreen().catch(() => {});
      if (window.KrmziBridge && window.KrmziBridge.setLandscape) {
        window.KrmziBridge.setLandscape(true);
      }
    } else {
      document.exitFullscreen().catch(() => {});
      if (window.KrmziBridge && window.KrmziBridge.setLandscape) {
        window.KrmziBridge.setLandscape(false);
      }
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const isFull = !!document.fullscreenElement;
    if (window.KrmziBridge && window.KrmziBridge.setLandscape) {
      window.KrmziBridge.setLandscape(isFull);
    }
  });

  playerFavBtn.addEventListener('click', () => {
    haptic('heavy');
    toggleFavorite();
  });
}

function showPill(iconClass, text) {
  swipeIcon.className = `fa-solid ${iconClass}`;
  swipeValue.textContent = text;
  swipeIndicator.classList.remove('hidden');
}

function togglePlay() {
  if (nativePlayer.paused) nativePlayer.play();
  else nativePlayer.pause();
}

function seekRelative(seconds) {
  if (!nativePlayer.duration) return;
  nativePlayer.currentTime = Math.max(0, Math.min(nativePlayer.duration, nativePlayer.currentTime + seconds));
  resetHudTimer();
}

function triggerRipple(elem) {
  elem.classList.add('active');
  setTimeout(() => elem.classList.remove('active'), 500);
}

function toggleHud() {
  const isHidden = playerHudTop.classList.contains('hud-hidden');
  if (isHidden) showHud();
  else hideHud();
}

function showHud(autoHide = true) {
  playerHudTop.classList.remove('hud-hidden');
  playerHudBottom.classList.remove('hud-hidden');
  if (!mobilePlayer.classList.contains('embed-mode')) {
    hudCenter.classList.remove('hud-hidden');
  } else {
    hudCenter.classList.add('hud-hidden');
  }
  if (autoHide) resetHudTimer();
}

function hideHud() {
  if (!mobilePlayer.classList.contains('embed-mode') && nativePlayer.paused) return;
  playerHudTop.classList.add('hud-hidden');
  playerHudBottom.classList.add('hud-hidden');
  hudCenter.classList.add('hud-hidden');
}

function resetHudTimer() {
  clearTimeout(state.hudTimeout);
  state.hudTimeout = setTimeout(hideHud, 3200);
}

function onTimeUpdate() {
  if (!nativePlayer.duration) return;
  const current = nativePlayer.currentTime;
  const duration = nativePlayer.duration;
  const percent = (current / duration) * 100;

  timelineProgress.style.width = `${percent}%`;
  timelineThumb.style.right = `${100 - percent}%`;
  hudTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;

  if (current > 5 && current < 150) {
    skipIntroBtn.classList.remove('hidden');
  } else {
    skipIntroBtn.classList.add('hidden');
  }

  if (duration - current <= 40 && !state.autoNextCancelled && state.currentSeriesEpisodes.length > 0) {
    checkAutoNext();
  }

  saveHistory();
}

function checkAutoNext() {
  if (state.autoNextTimerId || !autoNextCard.classList.contains('hidden')) return;

  const currentIdx = state.currentSeriesEpisodes.findIndex(e => e.url === state.currentEpisode.url);
  if (currentIdx >= 0 && currentIdx < state.currentSeriesEpisodes.length - 1) {
    const nextEp = state.currentSeriesEpisodes[currentIdx + 1];
    autoNextTitle.textContent = nextEp.title;
    autoNextCard.classList.remove('hidden');

    let secondsLeft = 5;
    autoNextTimer.textContent = secondsLeft;

    state.autoNextTimerId = setInterval(() => {
      secondsLeft--;
      autoNextTimer.textContent = secondsLeft;
      if (secondsLeft <= 0) {
        clearInterval(state.autoNextTimerId);
        playNextEpisodeNow();
      }
    }, 1000);
  }
}

function playNextEpisodeNow() {
  clearInterval(state.autoNextTimerId);
  autoNextCard.classList.add('hidden');
  const currentIdx = state.currentSeriesEpisodes.findIndex(e => e.url === state.currentEpisode.url);
  if (currentIdx >= 0 && currentIdx < state.currentSeriesEpisodes.length - 1) {
    const nextEp = state.currentSeriesEpisodes[currentIdx + 1];
    openEpisode(nextEp.url);
  }
}

function onProgress() {
  if (nativePlayer.buffered.length > 0 && nativePlayer.duration) {
    const end = nativePlayer.buffered.end(nativePlayer.buffered.length - 1);
    timelineLoaded.style.width = `${(end / nativePlayer.duration) * 100}%`;
  }
}

function closePlayer() {
  clearDirectWatchdog();
  saveHistory(true);
  nativePlayer.pause();
  nativePlayer.src = '';
  embedPlayer.src = 'about:blank';
  mobilePlayer.classList.remove('embed-mode');
  mobilePlayer.classList.add('hidden');
  if (window.KrmziBridge && window.KrmziBridge.setVideoPlaying) {
    window.KrmziBridge.setVideoPlaying(false);
  }
  if (window.KrmziBridge && window.KrmziBridge.setLandscape) {
    window.KrmziBridge.setLandscape(false);
  }
}

// Drawer Episodes
async function loadDrawer(seriesUrl, currentEpUrl) {
  try {
    const ser = await apiCall('/api/series/detail', { url: seriesUrl });
    state.currentSeriesEpisodes = ser.episodes || [];
    drawerCount.textContent = `${state.currentSeriesEpisodes.length} حلقة`;

    drawerEpisodesCarousel.innerHTML = state.currentSeriesEpisodes.map(ep => {
      const isCur = ep.url === currentEpUrl;
      return `
        <div class="drawer-pill ${isCur ? 'active' : ''}" onclick="haptic(); openEpisode('${ep.url}')">
          ${ep.title}
        </div>
      `;
    }).join('');
  } catch (e) {}
}

// Bottom Sheet
function setupBottomSheet() {
  closeSheetBtn.addEventListener('click', () => {
    haptic();
    closeSheet();
  });
  sheetBackdrop.addEventListener('click', (e) => {
    if (e.target === sheetBackdrop) {
      haptic();
      closeSheet();
    }
  });
}

function openSheet(title, itemsHtml) {
  sheetTitle.textContent = title;
  sheetBody.innerHTML = itemsHtml;
  sheetBackdrop.classList.remove('hidden');
}

function closeSheet() {
  sheetBackdrop.classList.add('hidden');
}

function openServersSheet() {
  if (!state.currentEpisode) return;
  const ep = state.currentEpisode;

  let itemsHtml = '';
  if (ep.directStreams && ep.directStreams.length > 0) {
    itemsHtml += `
      <div class="sheet-row active" onclick="haptic(); playDirectStream(state.currentEpisode.directStreams); closeSheet();">
        <span><i class="fa-solid fa-bolt" style="color: #10b981;"></i> سيرفر مباشر (بدون إعلانات 1080p)</span>
        <span class="sheet-pill direct">موصى به</span>
      </div>
    `;
  }

  if (ep.servers) {
    ep.servers.forEach(s => {
      itemsHtml += `
        <div class="sheet-row" onclick="haptic(); playSandboxedEmbed({ embedUrl: '${s.embedUrl}', name: '${s.name}' }); closeSheet();">
          <span><i class="fa-solid fa-server"></i> سيرفر ${s.name}</span>
          <span class="sheet-pill">حماية 🛡️</span>
        </div>
      `;
    });
  }

  openSheet('سيرفر المشاهدة', itemsHtml);
}

function openQualitySheet() {
  if (!state.currentEpisode || !state.currentEpisode.directStreams) {
    openSheet('دقة العرض', '<p style="text-align: center; color: var(--text-dim); padding: 10px; font-size: 13px;">الجودة تلقائية على هذا السيرفر.</p>');
    return;
  }

  const streams = state.currentEpisode.directStreams;
  const itemsHtml = streams.map(s => {
    const isAct = state.activeQuality && state.activeQuality.quality === s.quality;
    return `
      <div class="sheet-row ${isAct ? 'active' : ''}" onclick="haptic(); switchStreamQuality('${s.url}', '${s.quality}'); closeSheet();">
        <span>${s.quality}</span>
        ${isAct ? '<i class="fa-solid fa-check"></i>' : ''}
      </div>
    `;
  }).join('');

  openSheet('اختيار الدقة', itemsHtml);
}

function switchStreamQuality(url, qualityName) {
  const curPos = nativePlayer.currentTime;
  const wasPlaying = !nativePlayer.paused;
  state.preferredQuality = qualityName;
  localStorage.setItem('krmzi_pref_quality', qualityName);

  nativePlayer.src = url;
  nativePlayer.currentTime = curPos;
  if (wasPlaying) nativePlayer.play();
  activeQualityLabel.textContent = qualityName;
}

// Open Series Details in Bottom Sheet
async function openSeriesByUrl(url) {
  openSheet('جاري التحميل...', '<div class="spinner-ring" style="margin: 20px auto;"></div>');
  try {
    const ser = await apiCall('/api/series/detail', { url: url });

    const itemsHtml = `
      <div style="display: flex; gap: 12px; margin-bottom: 12px;">
        <img src="${ser.poster}" style="width: 70px; height: 100px; border-radius: 10px; object-fit: cover;">
        <div>
          <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 4px;">${ser.title}</h4>
          <p style="font-size: 11px; color: var(--text-sub); line-height: 1.5; max-height: 80px; overflow-y: auto;">${ser.story || 'لا يتوفر ملخص.'}</p>
        </div>
      </div>
      <h5 style="font-size: 13px; font-weight: 800; margin: 10px 0 6px 0;">الحلقات (${ser.episodes.length}):</h5>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 250px; overflow-y: auto;">
        ${ser.episodes.map(ep => `
          <button class="sheet-row" style="padding: 10px; font-size: 12px; justify-content: center;" onclick="closeSheet(); haptic(); openEpisode('${ep.url}');">
            ${ep.title}
          </button>
        `).join('')}
      </div>
    `;

    openSheet(ser.title, itemsHtml);
  } catch (e) {
    openSheet('خطأ', '<p style="text-align: center; color: var(--text-dim); font-size: 13px;">تعذر جلب الحلقات.</p>');
  }
}

function searchSeries(title) {
  executeSearch(title);
  openSearch();
}

// Favorites & History
function toggleFavorite() {
  if (!state.currentEpisode) return;
  const ep = state.currentEpisode;
  const idx = state.favorites.findIndex(f => f.url === ep.url);

  if (idx >= 0) {
    state.favorites.splice(idx, 1);
  } else {
    state.favorites.unshift({
      title: ep.title,
      url: ep.url,
      thumbnail: ep.poster
    });
  }

  localStorage.setItem('krmzi_favs', JSON.stringify(state.favorites));
  refreshFavState();
}

function refreshFavState() {
  if (!state.currentEpisode) return;
  const isFav = state.favorites.some(f => f.url === state.currentEpisode.url);
  playerFavBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart" style="color: var(--accent);"></i>' : '<i class="fa-regular fa-heart"></i>';
}

let lastSaveTime = 0;
function saveHistory(force = false) {
  if (!state.currentEpisode) return;
  const now = Date.now();
  if (!force && now - lastSaveTime < 3000) return;
  lastSaveTime = now;

  const ep = state.currentEpisode;
  let sTitle = ep.seriesTitle || '';
  if (!sTitle && ep.title) {
    sTitle = ep.title.replace(/الحلقة\s*\d+.*/, '').trim();
  }

  const cur = (nativePlayer && !isNaN(nativePlayer.currentTime) && nativePlayer.currentTime > 0) ? nativePlayer.currentTime : 0;
  const dur = (nativePlayer && !isNaN(nativePlayer.duration) && nativePlayer.duration > 0) ? nativePlayer.duration : 0;

  const item = {
    title: ep.title,
    seriesTitle: sTitle || ep.title,
    seriesUrl: ep.seriesUrl || '',
    episodeNum: ep.episodeNum || '',
    url: ep.url,
    thumbnail: ep.poster || '',
    currentTime: cur,
    duration: dur,
    updatedAt: now
  };

  // Replace any existing entry for this series so the series always points to the latest reached episode!
  const idx = state.history.findIndex(h => h.url === item.url || (item.seriesTitle && h.seriesTitle === item.seriesTitle));
  if (idx >= 0) {
    // Preserve previously stored progress if player is in embed mode or just opened
    if (cur === 0 && state.history[idx].currentTime > 0) {
      item.currentTime = state.history[idx].currentTime;
      item.duration = state.history[idx].duration;
    }
    state.history.splice(idx, 1);
  }
  state.history.unshift(item);
  if (state.history.length > 25) state.history.pop();
  localStorage.setItem('krmzi_hist', JSON.stringify(state.history));

  renderHistory();
}

function formatTime(secs) {
  if (isNaN(secs)) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ==================== In-App Updates System ====================
function isNewerVersion(current, latest) {
  if (!latest) return false;
  const cParts = current.replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  const lParts = latest.replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  const max = Math.max(cParts.length, lParts.length);
  for (let i = 0; i < max; i++) {
    const c = cParts[i] || 0;
    const l = lParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

async function checkForUpdates(isManual = false) {
  if (isManual) {
    if (checkUpdateIcon) checkUpdateIcon.classList.add('fa-spin');
    if (checkUpdateBtnText) checkUpdateBtnText.textContent = 'جاري التحقق...';
    if (manualCheckUpdateBtn) manualCheckUpdateBtn.disabled = true;
  }

  let updateInfo = null;

  try {
    if (window.KrmziBridge && window.KrmziBridge.checkForUpdates) {
      const raw = window.KrmziBridge.checkForUpdates();
      if (raw) {
        updateInfo = JSON.parse(raw);
      }
    } else {
      // Direct Web Fetch from GitHub API
      const res = await fetch('https://api.github.com/repos/XRTM8/krmzi-app/releases/latest');
      if (res.ok) {
        const json = await res.json();
        const tag = (json.tag_name || '').replace(/^v/, '');
        const hasUpdate = isNewerVersion(state.currentVersion, tag);
        let apkUrl = '';
        if (json.assets && json.assets.length > 0) {
          const apkAsset = json.assets.find(a => a.name && a.name.endsWith('.apk'));
          if (apkAsset) apkUrl = apkAsset.browser_download_url;
        }
        if (!apkUrl) apkUrl = json.html_url || 'https://github.com/XRTM8/krmzi-app/releases/latest';

        updateInfo = {
          hasUpdate,
          currentVersion: state.currentVersion,
          latestVersion: tag,
          releaseName: json.name || 'تحديث جديد',
          changelog: json.body || '',
          downloadUrl: apkUrl,
          isSuccess: true
        };
      }
    }
  } catch (err) {
    console.warn('Update check error:', err);
  }

  if (isManual) {
    if (checkUpdateIcon) checkUpdateIcon.classList.remove('fa-spin');
    if (manualCheckUpdateBtn) manualCheckUpdateBtn.disabled = false;
  }

  if (updateInfo && updateInfo.hasUpdate) {
    if (isManual) {
      if (checkUpdateBtnText) checkUpdateBtnText.textContent = 'التحقق من التحديثات';
      openUpdateModal(updateInfo);
    } else {
      // Auto-check: verify it hasn't been dismissed within the last 24 hours
      const lastDismissed = parseInt(localStorage.getItem('krmzi_update_dismissed') || '0');
      const now = Date.now();
      if (now - lastDismissed > 24 * 60 * 60 * 1000) {
        openUpdateModal(updateInfo);
      }
    }
  } else {
    if (isManual) {
      if (manualCheckUpdateBtn) manualCheckUpdateBtn.classList.add('success');
      if (checkUpdateIcon) checkUpdateIcon.className = 'fa-solid fa-check';
      if (checkUpdateBtnText) checkUpdateBtnText.textContent = `أنت على أحدث إصدار (v${state.currentVersion}) ✓`;
      haptic('double');

      setTimeout(() => {
        if (manualCheckUpdateBtn) manualCheckUpdateBtn.classList.remove('success');
        if (checkUpdateIcon) checkUpdateIcon.className = 'fa-solid fa-arrows-rotate';
        if (checkUpdateBtnText) checkUpdateBtnText.textContent = 'التحقق من التحديثات';
      }, 3500);
    }
  }
}

function openUpdateModal(info) {
  state.pendingUpdate = info;
  if (updateModalTitle) updateModalTitle.textContent = info.releaseName || 'تحديث جديد متوفر!';
  if (updateModalVersion) updateModalVersion.textContent = 'الإصدار v' + info.latestVersion;
  
  if (updateChangelog) {
    let notes = info.changelog || 'تحسينات عامة في الأداء وثبات التطبيق وإصلاحات لمشغل الفيديو.';
    notes = notes.replace(/#{1,6}\s+/g, '').trim();
    updateChangelog.textContent = notes;
  }

  if (updateModalScrim) updateModalScrim.classList.remove('hidden');
  haptic('double');
}

function closeUpdateModal() {
  if (updateModalScrim) updateModalScrim.classList.add('hidden');
  localStorage.setItem('krmzi_update_dismissed', Date.now().toString());
}

function setupUpdateSystem() {
  if (window.KrmziBridge && window.KrmziBridge.getAppVersion) {
    try {
      const vData = JSON.parse(window.KrmziBridge.getAppVersion());
      if (vData && vData.versionName) {
        state.currentVersion = vData.versionName.replace(/^v/, '');
      }
    } catch (e) {}
  }

  if (installedVersionText) {
    installedVersionText.textContent = `v${state.currentVersion}`;
  }

  if (manualCheckUpdateBtn) {
    manualCheckUpdateBtn.addEventListener('click', () => {
      haptic();
      checkForUpdates(true);
    });
  }

  if (confirmUpdateBtn) {
    confirmUpdateBtn.addEventListener('click', () => {
      haptic('heavy');
      if (state.pendingUpdate && state.pendingUpdate.downloadUrl) {
        if (window.KrmziBridge && window.KrmziBridge.openDownloadUrl) {
          window.KrmziBridge.openDownloadUrl(state.pendingUpdate.downloadUrl);
        } else {
          window.open(state.pendingUpdate.downloadUrl, '_blank');
        }
      }
      closeUpdateModal();
    });
  }

  if (dismissUpdateBtn) {
    dismissUpdateBtn.addEventListener('click', () => {
      haptic();
      closeUpdateModal();
    });
  }

  if (updateModalScrim) {
    updateModalScrim.addEventListener('click', (e) => {
      if (e.target === updateModalScrim) {
        closeUpdateModal();
      }
    });
  }

  // Silent automatic check 3.5 seconds after launch
  setTimeout(() => {
    checkForUpdates(false);
  }, 3500);
}
