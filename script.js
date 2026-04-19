/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ShunyaSpace — script.js  (v4)

   FIX LOG:
   ① buildUrl() — encodeURIComponent each path segment
     → fixes "no supported source found" for filenames with spaces
   ② playAudioById() — set currentTime via 'loadedmetadata' event
     → fixes resume position silently failing
   ③ global.json / home.json — fetched silently (debug, not warn)
     → no more console noise if those files are missing
   ④ renderAmbient() — shows thumbnails + proper controls
     → fixes "only volume control showing"
   ⑤ Ambient uses <audio> tag which CAN play .mp4 audio tracks
     → ambient .mp4 files now play correctly
   ⑥ openEchoById() + renderBooks() — PDFs open in in-page modal
     → replaces window.open(_blank) with embedded iframe reader
   ⑦ PDF progress saved to localStorage via page-number input
   ⑧ Volume slider added to bottom player bar
   ⑨ Echo grid uses responsive auto-fit grid
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

'use strict';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FALLBACK NAV — used if global.json is absent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const FALLBACK_NAV = [
  { id: 'home',    label: 'Pravaah', icon: '◌',  hint: 'The flow' },
  { id: 'audios',  label: 'Shravan',  icon: '◑',  hint: 'What is heard' },
  { id: 'ambient', label: 'Ambient',  icon: '〰', hint: 'Surrounding sound' },
  { id: 'videos',  label: 'Videos',   icon: '▷',  hint: 'Moving light' },
  { id: 'echo',    label: 'Echo',     icon: '∿',  hint: 'Words that remain' },
  { id: 'images',  label: 'Drishya',  icon: '◎',  hint: 'What is seen' },
  { id: 'books',   label: 'Books',    icon: '⊟',  hint: 'Deeper waters' },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const State = {
  data: {
    global: null, home: null,
    audios: [], ambient: [], videos: [],
    books: [], images: [],
    echo: { pdfs: [], txts: [], all: [] },
  },
  currentSection: '',
  isMobile: window.innerWidth < 900,
  rendered: new Set(),

  audio: {
    currentId:    null,
    isPlaying:    false,
    list:         [],
    currentIndex: -1,
  },
  ambient: {
    currentId: null,
    isPlaying: false,
    volume:    0.35,
  },
  pdf: {
    currentItem: null,
  },
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DOM CACHE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const DOM = {};

function cacheDom() {
  DOM.app           = document.getElementById('app');
  DOM.mainAudio     = document.getElementById('main-audio');
  DOM.ambientAudio  = document.getElementById('ambient-audio');  // <audio> plays .mp4 too
  DOM.playerBar     = document.getElementById('bottom-player');
  DOM.playerThumb   = document.getElementById('player-thumb');
  DOM.playerTitle   = document.getElementById('player-title');
  DOM.playerSub     = document.getElementById('player-speaker');
  DOM.playPauseBtn  = document.getElementById('btn-play-pause');
  DOM.prevBtn       = document.querySelector('.btn-prev');
  DOM.nextBtn       = document.querySelector('.btn-next');
  DOM.progressTrack = document.querySelector('.progress-track');
  DOM.progressFill  = document.querySelector('.progress-fill');
  DOM.timeElapsed   = document.getElementById('time-elapsed');
  DOM.timeRemain    = document.getElementById('time-remain');
  DOM.volumeSlider  = document.getElementById('player-volume');
  DOM.dlBtn         = document.getElementById('player-download');
  DOM.toast         = document.getElementById('toast');
  DOM.lightbox      = document.getElementById('lightbox');
  DOM.lightboxImg   = document.getElementById('lightbox-img');
  DOM.lightboxCap   = document.getElementById('lightbox-caption');
  DOM.lightboxDl    = document.getElementById('lightbox-dl');
  DOM.videoModal    = document.getElementById('video-modal');
  DOM.modalVideo    = document.getElementById('modal-video');
  DOM.txtReader     = document.getElementById('txt-reader');
  DOM.readerContent = document.getElementById('reader-content');
  DOM.sidebar       = document.getElementById('sidebar');
  DOM.pdfModal      = document.getElementById('pdf-modal');
  DOM.pdfIframe     = document.getElementById('pdf-iframe');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LOCAL STORAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const Store = {
  get:  k     => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:  (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },

  saveAudioTime:    (id, t) => Store.set(`audio_${id}`, t),
  getAudioTime:     id      => Store.get(`audio_${id}`) || 0,
  saveTxtScroll:    (id, p) => Store.set(`txt_${id}`, p),
  getTxtScroll:     id      => Store.get(`txt_${id}`) || 0,
  savePdfPage:      (id, p) => Store.set(`pdf_progress_${id}`, p),
  getPdfPage:       id      => Store.get(`pdf_progress_${id}`) || 1,
  saveLastAudio:    id      => Store.set('last_audio', id),
  getLastAudio:     ()      => Store.get('last_audio'),
  saveLastEcho:     id      => Store.set('last_echo', id),
  getLastEcho:      ()      => Store.get('last_echo'),
  getRecentImages:  ()      => Store.get('images_recent') || [],
  addRecentImage:   id => {
    let r = Store.getRecentImages();
    r = [id, ...r.filter(x => x !== id)].slice(0, 5);
    Store.set('images_recent', r);
  },
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   URL BUILDER  ← FIX ①
   Encodes each path segment with encodeURIComponent so filenames
   with spaces, parentheses, etc. produce valid URLs.
   e.g. "my file (1).mp3" → "my%20file%20(1).mp3"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function buildUrl(base, filePath) {
  if (!filePath) return '';
  // Split on "/" to preserve path separators, encode each segment independently
  const encoded = filePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
  return base + encoded;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   JSON LOADING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Fetch JSON from path.
 * silent=true → only log at debug level (no console.warn for optional files).
 */
async function fetchJSON(path, silent = false) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!silent) console.warn(`[ShunyaSpace] fetchJSON failed for ${path}:`, err.message);
    return null;
  }
}

/**
 * Parse { type, base_url, items[] } → flat array.
 * Attaches .url and .thumbnailUrl using buildUrl() for correct encoding.
 */
function parseSection(raw) {
  if (!raw || !Array.isArray(raw.items)) return [];
  const base = (raw.base_url || '').replace(/\/$/, '') + '/';
  const safeBase = base === '/' ? '' : base;

  return raw.items.map(item => ({
    ...item,
    url:          buildUrl(safeBase, item.file),
    thumbnailUrl: item.thumbnail ? buildUrl(safeBase, item.thumbnail) : '',
  }));
}

/** Parse echo JSON { type, base_url, pdfs[], txts[] } */
function parseEcho(raw) {
  if (!raw) return { pdfs: [], txts: [], all: [] };
  const base = (raw.base_url || '').replace(/\/$/, '') + '/';
  const safeBase = base === '/' ? '' : base;

  const mapItems = (arr, type) =>
    (arr || []).map(item => ({
      ...item,
      type,
      url:          buildUrl(safeBase, item.file),
      thumbnailUrl: item.thumbnail ? buildUrl(safeBase, item.thumbnail) : '',
    }));

  const pdfs = mapItems(raw.pdfs, 'pdf');
  const txts = mapItems(raw.txts, 'txt');
  return { pdfs, txts, all: [...txts, ...pdfs] };
}

/** Parse images JSON { type, base_url, items[] } */
function parseImages(raw) {
  if (!raw || !Array.isArray(raw.items)) return [];
  const base = (raw.base_url || '').replace(/\/$/, '') + '/';
  const safeBase = base === '/' ? '' : base;

  return raw.items.map(item => ({
    ...item,
    url:          buildUrl(safeBase, item.file),
    thumbnailUrl: buildUrl(safeBase, item.file),  // image itself is its own thumbnail
  }));
}

async function loadAllData() {
  console.log('[ShunyaSpace] Loading JSON data…');

  // global.json and home.json are optional — silent=true to suppress 404 noise
  // if they were missing. After running generate_json.py v4, they will exist.
  const [globalRaw, homeRaw, audiosRaw, ambientRaw, videosRaw, echoRaw, booksRaw, imagesRaw] =
    await Promise.all([
      fetchJSON('data/global.json',  true),   // ③ silent — optional
      fetchJSON('data/home.json',    true),   // ③ silent — optional
      fetchJSON('data/audios.json'),
      fetchJSON('data/ambient.json'),
      fetchJSON('data/videos.json'),
      fetchJSON('data/echo.json'),
      fetchJSON('data/books.json'),
      fetchJSON('data/images.json'),
    ]);

  State.data.global  = globalRaw;
  State.data.home    = homeRaw;
  State.data.audios  = parseSection(audiosRaw);
  State.data.ambient = parseSection(ambientRaw);
  State.data.videos  = parseSection(videosRaw);
  State.data.books   = parseSection(booksRaw);
  State.data.echo    = parseEcho(echoRaw);
  State.data.images  = parseImages(imagesRaw);
  State.audio.list   = State.data.audios;

  console.log('[ShunyaSpace] Loaded:', {
    audios:  State.data.audios.length,
    ambient: State.data.ambient.length,
    videos:  State.data.videos.length,
    books:   State.data.books.length,
    echo:    State.data.echo.all.length,
    images:  State.data.images.length,
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NAVIGATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initNav() {
  const navItems = State.data.global?.nav || FALLBACK_NAV;
  const navList  = document.getElementById('nav-list');

  navList.innerHTML = navItems.map(item => `
    <li class="nav-item">
      <a href="#" class="nav-link" data-section="${item.id}" aria-label="${item.label}">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
        <span class="nav-hint">${item.hint}</span>
      </a>
    </li>
  `).join('');

  navList.querySelectorAll('.nav-link').forEach(link =>
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.section);
      DOM.sidebar.classList.remove('open');
    })
  );
}

function navigateTo(sectionId) {
  if (State.currentSection === sectionId) return;

  document.querySelectorAll('.section').forEach(s =>
    s.classList.remove('visible', 'faded-in')
  );
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.section === sectionId)
  );

  const el = document.getElementById(`section-${sectionId}`);
  if (!el) {
    console.warn(`[ShunyaSpace] Missing element: #section-${sectionId}`);
    return;
  }

  el.classList.add('visible');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => el.classList.add('faded-in'))
  );

  if (!State.rendered.has(sectionId) || sectionId === 'home') {
    renderSection(sectionId);
    State.rendered.add(sectionId);
  }

  State.currentSection = sectionId;
}

function renderSection(id) {
  ({
    home:    renderHome,
    audios:  renderAudios,
    ambient: renderAmbient,
    videos:  renderVideos,
    echo:    renderEcho,
    images:  renderImages,
    books:   renderBooks,
  })[id]?.();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHARED CARD BUILDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function buildCard(item, { badge = '', delay = 0, extraClass = '' } = {}) {
  const thumb = item.thumbnailUrl
    ? `<img data-src="${item.thumbnailUrl}" alt="" loading="lazy">`
    : `<div class="card-thumb-placeholder">${badge || '◌'}</div>`;

  return `
    <div class="content-card animate-in ${extraClass}"
         data-id="${item.id}"
         style="animation-delay:${delay}s">
      <div class="card-thumb">${thumb}</div>
      <div class="card-info">
        ${badge ? `<span class="card-badge">${badge}</span>` : ''}
        <div class="card-title">${item.title || item.file || '—'}</div>
      </div>
    </div>`;
}

function lazyLoad(container) {
  container.querySelectorAll('img[data-src]').forEach(img => {
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.src    = el.dataset.src;
      el.onload  = () => el.classList.add('loaded');
      el.onerror = () => {
        const wrap = el.closest('.card-thumb, .ambient-thumb');
        if (wrap) wrap.innerHTML = '<div class="card-thumb-placeholder">◌</div>';
      };
      io.disconnect();
    });
    io.observe(img);
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HOME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderHome() {
  const container = document.getElementById('home-inner');
  const { home, global } = State.data;

  const quotes = home?.quotes || [];
  const q = quotes[Math.floor(Math.random() * quotes.length)] || {
    text: 'The quieter you become, the more you can hear.', author: 'Ram Dass',
  };

  const lastAudio = State.data.audios.find(a => a.id === Store.getLastAudio());
  const lastEcho  = State.data.echo.all.find(e => e.id === Store.getLastEcho());
  const lastImg   = State.data.images.find(i => i.id === Store.getRecentImages()[0]);

  const resumeItems = [
    lastAudio && { action: 'resume-audio', id: lastAudio.id, type: '↺ Continue Listening', title: lastAudio.title },
    lastEcho  && { action: 'resume-echo',  id: lastEcho.id,  type: '↺ Continue Reading',   title: lastEcho.title  },
    lastImg   && { action: 'resume-image', id: lastImg.id,   type: '◎ Recently Viewed',    title: lastImg.file || 'An image' },
  ].filter(Boolean);

  container.innerHTML = `
    <div class="home-hero">
      <div class="home-shunya-glyph">शून्य</div>
      <div class="home-welcome">${home?.welcome || 'You have arrived.'}</div>
      <div class="home-tagline">${global?.site?.tagline || 'A silence you can enter'}</div>
    </div>

    <div class="home-quote-block animate-in">
      <div class="quote-text">${q.text}</div>
      <div class="quote-author">— ${q.author}</div>
    </div>

    ${resumeItems.length ? `
      <div class="home-resume">
        <div class="resume-title">Where you left off</div>
        <div class="resume-cards">
          ${resumeItems.map(r => `
            <div class="resume-card animate-in" data-action="${r.action}" data-id="${r.id}">
              <div class="resume-card-type">${r.type}</div>
              <div class="resume-card-title">${r.title}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}
  `;

  container.querySelectorAll('[data-action]').forEach(card => {
    card.addEventListener('click', () => {
      const { action, id } = card.dataset;
      if (action === 'resume-audio') { navigateTo('audios'); setTimeout(() => playAudioById(id), 300); }
      if (action === 'resume-echo')  { navigateTo('echo');   setTimeout(() => openEchoById(id),  300); }
      if (action === 'resume-image') { navigateTo('images'); setTimeout(() => openImageById(id), 400); }
    });
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AUDIOS — grid of cards + bottom player
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderAudios() {
  const container = document.getElementById('audios-list');
  const audios    = State.data.audios;

  if (!audios.length) {
    container.innerHTML = emptyState('◑', 'No audios yet.<br>Add files to <code>shunya_data/audios/</code> and run <code>generate_json.py</code>');
    return;
  }

  container.innerHTML = `<div class="content-grid">${
    audios.map((a, i) => buildCard(a, {
      badge:      'Audio',
      delay:      i * 0.05,
      extraClass: State.audio.currentId === a.id ? 'is-active' : '',
    })).join('')
  }</div>`;

  lazyLoad(container);

  container.querySelectorAll('.content-card').forEach(card =>
    card.addEventListener('click', () => playAudioById(card.dataset.id))
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AUDIO PLAYBACK ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function playAudioById(id) {
  const item = State.data.audios.find(a => a.id === id);
  if (!item) return;

  Store.saveLastAudio(id);

  // Mobile: stop ambient before playing discourse audio
  if (State.isMobile && State.ambient.isPlaying) stopAmbient();

  // Same track → toggle
  if (State.audio.currentId === id) {
    toggleAudioPlayback();
    return;
  }

  // Save position on track being replaced
  if (State.audio.currentId) {
    Store.saveAudioTime(State.audio.currentId, DOM.mainAudio.currentTime);
  }

  State.audio.currentId    = id;
  State.audio.currentIndex = State.data.audios.findIndex(a => a.id === id);

  DOM.mainAudio.src = item.url;

  // ② FIX: set currentTime AFTER metadata loads, not immediately after .src assignment
  const savedTime = Store.getAudioTime(id);
  if (savedTime > 0) {
    DOM.mainAudio.addEventListener('loadedmetadata', () => {
      DOM.mainAudio.currentTime = savedTime;
    }, { once: true });
  }

  DOM.mainAudio.play()
    .then(() => {
      State.audio.isPlaying = true;
      showPlayerBar(item, 'Audio');
      refreshAudioUI();
    })
    .catch(err => {
      console.warn('[ShunyaSpace] Audio play failed:', item.url, err.message);
      showToast('Could not load audio. Check the URL in audios.json.');
      showPlayerBar(item, 'Audio');
    });
}

function toggleAudioPlayback() {
  if (DOM.mainAudio.paused) {
    DOM.mainAudio.play().catch(() => {});
    State.audio.isPlaying = true;
  } else {
    DOM.mainAudio.pause();
    State.audio.isPlaying = false;
  }
  refreshAudioUI();
}

function refreshAudioUI() {
  document.querySelectorAll('#audios-list .content-card').forEach(card =>
    card.classList.toggle('is-active', card.dataset.id === State.audio.currentId)
  );
  if (DOM.playPauseBtn) DOM.playPauseBtn.textContent = State.audio.isPlaying ? '⏸' : '▷';
}

function bindAudioEvents() {
  DOM.mainAudio.addEventListener('timeupdate', () => {
    if (State.audio.currentId) Store.saveAudioTime(State.audio.currentId, DOM.mainAudio.currentTime);
    updateProgress(DOM.mainAudio.currentTime, DOM.mainAudio.duration);
  });

  DOM.mainAudio.addEventListener('ended', () => {
    State.audio.isPlaying = false;
    refreshAudioUI();
    const next = State.audio.currentIndex + 1;
    if (next < State.audio.list.length) playAudioById(State.audio.list[next].id);
  });

  DOM.mainAudio.addEventListener('play',  () => { State.audio.isPlaying = true;  refreshAudioUI(); });
  DOM.mainAudio.addEventListener('pause', () => { State.audio.isPlaying = false; refreshAudioUI(); });

  DOM.mainAudio.addEventListener('error', e => {
    console.warn('[ShunyaSpace] Audio element error:', DOM.mainAudio.src, e);
    showToast('Audio failed to load. Check console for details.');
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AMBIENT — thumbnails + full controls  ← FIX ④
   Ambient files may be .mp3 OR .mp4.
   The <audio> element can play .mp4 audio tracks in all modern browsers.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderAmbient() {
  const grid  = document.getElementById('ambient-grid');
  const items = State.data.ambient;

  if (!items.length) {
    grid.innerHTML = emptyState('〰',
      'No ambient sounds found.<br>' +
      'Add .mp3 or .mp4 files to <code>shunya_data/ambient/</code> ' +
      'and run <code>generate_json.py</code>');
    return;
  }

  const activeItem = items.find(a => a.id === State.ambient.currentId);

  grid.innerHTML = `
    ${activeItem ? `
      <div class="ambient-now-playing animate-in">
        ${activeItem.thumbnailUrl
          ? `<div class="ambient-np-thumb" style="background-image:url('${activeItem.thumbnailUrl}')"></div>`
          : `<div class="ambient-np-thumb ambient-np-thumb--empty">〰</div>`}
        <div class="ambient-np-info">
          <div class="ambient-np-label">Now playing</div>
          <div class="ambient-np-title">${activeItem.title}</div>
        </div>
        <div class="ambient-np-controls">
          <input type="range" class="ambient-vol-slider" min="0" max="100"
                 value="${Math.round(State.ambient.volume * 100)}"
                 title="Ambient volume">
          <button class="ambient-stop-btn">■ Stop</button>
        </div>
      </div>` : ''}

    <div class="ambient-cards-grid">
      ${items.map((a, i) => {
        const isPlaying = State.ambient.currentId === a.id && State.ambient.isPlaying;
        return `
          <div class="ambient-card animate-in ${isPlaying ? 'playing' : ''}"
               data-id="${a.id}" style="animation-delay:${i * 0.06}s">
            ${a.thumbnailUrl
              ? `<div class="ambient-thumb">
                   <img data-src="${a.thumbnailUrl}" alt="${a.title}" loading="lazy">
                 </div>`
              : `<div class="ambient-thumb ambient-thumb--empty">〰</div>`}
            <div class="ambient-card-info">
              <div class="ambient-title">${a.title}</div>
              <div class="ambient-status">${isPlaying ? '● Playing' : '○ Play'}</div>
            </div>
          </div>`;
      }).join('')}
    </div>
  `;

  lazyLoad(grid);

  grid.querySelectorAll('.ambient-card').forEach(card =>
    card.addEventListener('click', () => toggleAmbient(card.dataset.id))
  );

  grid.querySelector('.ambient-stop-btn')?.addEventListener('click', () => {
    stopAmbient();
    State.rendered.delete('ambient');
    renderAmbient();
  });

  grid.querySelector('.ambient-vol-slider')?.addEventListener('input', function () {
    State.ambient.volume      = this.value / 100;
    DOM.ambientAudio.volume   = State.ambient.volume;
  });
}

function toggleAmbient(id) {
  const item = State.data.ambient.find(a => a.id === id);
  if (!item) return;

  // Same ambient → stop (toggle off)
  if (State.ambient.currentId === id && State.ambient.isPlaying) {
    stopAmbient();
    State.rendered.delete('ambient');
    renderAmbient();
    return;
  }

  // Mobile: stop discourse audio first
  if (State.isMobile && State.audio.isPlaying) {
    DOM.mainAudio.pause();
    State.audio.isPlaying = false;
    refreshAudioUI();
  }

  stopAmbient();

  DOM.ambientAudio.src    = item.url;
  DOM.ambientAudio.loop   = true;
  DOM.ambientAudio.volume = State.ambient.volume;

  DOM.ambientAudio.play()
    .then(() => {
      State.ambient.currentId = id;
      State.ambient.isPlaying = true;
      updateAmbientMini(item);
      State.rendered.delete('ambient');
      renderAmbient();
    })
    .catch(err => {
      console.warn('[ShunyaSpace] Ambient play failed:', item.url, err.message);
      showToast('Could not load ambient sound. Check the URL in ambient.json.');
    });
}

function stopAmbient() {
  if (!DOM.ambientAudio.paused) DOM.ambientAudio.pause();
  DOM.ambientAudio.removeAttribute('src');
  State.ambient.currentId = null;
  State.ambient.isPlaying = false;
  updateAmbientMini(null);
}

function updateAmbientMini(item) {
  const mini    = document.querySelector('.ambient-mini');
  const titleEl = mini?.querySelector('.ambient-mini-title span:first-child');
  if (!mini || !titleEl) return;
  if (item) {
    mini.classList.add('active');
    titleEl.textContent = `〰 ${item.title}`;
  } else {
    mini.classList.remove('active');
    titleEl.textContent = 'No ambient';
  }
}

function initAmbientControls() {
  document.getElementById('ambient-volume')?.addEventListener('input', function () {
    State.ambient.volume     = this.value / 100;
    DOM.ambientAudio.volume  = State.ambient.volume;
  });

  document.querySelector('.ambient-mini-stop')?.addEventListener('click', () => {
    stopAmbient();
    State.rendered.delete('ambient');
    renderAmbient();
  });

  DOM.ambientAudio?.addEventListener('error', () => {
    showToast('Ambient audio error. Check the file URL.');
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VIDEOS — grid → fullscreen modal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderVideos() {
  const container = document.getElementById('videos-grid');
  const videos    = State.data.videos;

  if (!videos.length) {
    container.innerHTML = emptyState('▷', 'No videos yet.<br>Add files to <code>shunya_data/videos/</code> and run <code>generate_json.py</code>');
    return;
  }

  container.innerHTML = `<div class="content-grid">${
    videos.map((v, i) => buildCard(v, { badge: '▷', delay: i * 0.06 })).join('')
  }</div>`;

  lazyLoad(container);

  container.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => {
      const item = State.data.videos.find(v => v.id === card.dataset.id);
      if (item) openVideoModal(item);
    });
  });
}

function openVideoModal(item) {
  DOM.modalVideo.src = item.url;
  DOM.videoModal.classList.add('open');
  DOM.modalVideo.play().catch(err => {
    console.warn('[ShunyaSpace] Video play failed:', item.url, err.message);
    showToast('Could not load video. Check the URL in videos.json.');
  });
}

function closeVideoModal() {
  DOM.videoModal.classList.remove('open');
  DOM.modalVideo.pause();
  DOM.modalVideo.removeAttribute('src');
}

function initVideoModal() {
  document.querySelector('.video-modal-close')?.addEventListener('click', closeVideoModal);
  DOM.videoModal?.addEventListener('click', e => {
    if (e.target === DOM.videoModal) closeVideoModal();
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ECHO — responsive grid → TXT reader | PDF modal  ← FIX ⑥
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderEcho() {
  const container = document.getElementById('echo-grid');
  const all       = State.data.echo.all;

  if (!all.length) {
    container.innerHTML = emptyState('∿', 'No writings yet.<br>Add files to <code>shunya/echo/</code> and run <code>generate_json.py</code>');
    return;
  }

  // ⑨ Responsive grid — applied via inline style override + CSS class
  container.innerHTML = all.map((item, i) => buildCard(item, {
    badge:      item.type === 'pdf' ? 'PDF' : 'TXT',
    delay:      i * 0.06,
    extraClass: `echo-${item.type}`,
  })).join('');

  lazyLoad(container);

  container.querySelectorAll('.content-card').forEach(card =>
    card.addEventListener('click', () => openEchoById(card.dataset.id))
  );
}

function openEchoById(id) {
  const item = State.data.echo.all.find(e => e.id === id);
  if (!item) return;
  Store.saveLastEcho(id);

  if (item.type === 'pdf') {
    openPdfModal(item);   // ⑥ FIX: in-page PDF reader instead of new tab
    return;
  }

  openTxtReader(item);
}

/* ── TXT READER ── */
async function openTxtReader(item) {
  document.getElementById('reader-doc-title').textContent = item.title || item.file || '—';
  document.getElementById('reader-eyebrow').textContent   = 'Echo · Writing';
  DOM.readerContent.textContent = 'Loading…';
  DOM.txtReader.classList.add('open');

  const wrap = document.querySelector('.reader-content-wrap');

  try {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    DOM.readerContent.textContent = text;
    setTimeout(() => { wrap.scrollTop = Store.getTxtScroll(item.id); }, 80);
  } catch (err) {
    console.warn('[ShunyaSpace] TXT fetch failed:', item.url, err.message);
    DOM.readerContent.textContent =
      `${item.title || ''}\n\n` +
      `[Could not load: ${item.url}]\n\n` +
      `Ensure the file exists and you are running from a local web server.`;
  }

  // Persist scroll
  wrap.addEventListener('scroll', () => Store.saveTxtScroll(item.id, wrap.scrollTop), { passive: true });
}

function initTxtReader() {
  const close = () => DOM.txtReader.classList.remove('open');
  document.getElementById('reader-close')?.addEventListener('click', close);
  document.getElementById('reader-close-top')?.addEventListener('click', close);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PDF READER MODAL  ← NEW FEATURE ⑦
   Opens PDFs in an in-page iframe modal.
   Saves + restores reading progress via localStorage (page number).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function openPdfModal(item) {
  State.pdf.currentItem = item;
  const savedPage = Store.getPdfPage(item.id);

  document.getElementById('pdf-modal-title').textContent = item.title || item.file || '—';
  document.getElementById('pdf-page-num').value          = savedPage;
  document.getElementById('pdf-total-pages').textContent = '—';
  document.getElementById('pdf-dl-btn').href             = item.url;
  document.getElementById('pdf-dl-btn').setAttribute('download', item.file || '');

  // #page= hash works in Chrome, Firefox, Edge built-in viewers
  DOM.pdfIframe.src = item.url + (savedPage > 1 ? `#page=${savedPage}` : '');
  DOM.pdfModal.classList.add('open');
}

function closePdfModal() {
  // Save current page before closing
  if (State.pdf.currentItem) {
    const page = parseInt(document.getElementById('pdf-page-num').value) || 1;
    Store.savePdfPage(State.pdf.currentItem.id, page);
  }
  DOM.pdfModal.classList.remove('open');
  DOM.pdfIframe.src = '';
  State.pdf.currentItem = null;
}

function goToPdfPage(page) {
  if (!State.pdf.currentItem || !page) return;
  const p = Math.max(1, parseInt(page) || 1);
  document.getElementById('pdf-page-num').value = p;
  // Update iframe with new page hash
  DOM.pdfIframe.src = State.pdf.currentItem.url + `#page=${p}`;
}

function initPdfModal() {
  document.getElementById('pdf-close-btn')?.addEventListener('click', closePdfModal);
  DOM.pdfModal?.addEventListener('click', e => {
    if (e.target === DOM.pdfModal) closePdfModal();
  });

  // Page number input: jump on Enter or blur
  const pageInput = document.getElementById('pdf-page-num');
  pageInput?.addEventListener('change', () => goToPdfPage(pageInput.value));
  pageInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') goToPdfPage(pageInput.value);
  });

  document.getElementById('pdf-prev-page')?.addEventListener('click', () => {
    const cur = parseInt(pageInput?.value) || 1;
    goToPdfPage(Math.max(1, cur - 1));
  });

  document.getElementById('pdf-next-page')?.addEventListener('click', () => {
    const cur = parseInt(pageInput?.value) || 1;
    goToPdfPage(cur + 1);
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   IMAGES — grid → lightbox
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderImages() {
  const container = document.getElementById('images-grid');
  const images    = State.data.images;

  if (!images.length) {
    container.innerHTML = emptyState('◎', 'No images yet.<br>Add files to <code>shunya/images/</code> and run <code>generate_json.py</code>');
    return;
  }

  container.innerHTML = images.map((img, i) => `
    <div class="image-card animate-in" data-id="${img.id}" style="animation-delay:${i * 0.04}s">
      <img data-src="${img.url}" alt="" loading="lazy">
      <div class="image-card-overlay">
        <span class="image-caption">${img.file || ''}</span>
        <a href="${img.url}" download class="image-download-btn" title="Download">↓</a>
      </div>
    </div>
  `).join('');

  lazyLoad(container);

  container.querySelectorAll('.image-card').forEach(card =>
    card.addEventListener('click', e => {
      if (e.target.classList.contains('image-download-btn')) return;
      openImageById(card.dataset.id);
    })
  );
}

function openImageById(id) {
  const img = State.data.images.find(i => i.id === id);
  if (!img) return;
  Store.addRecentImage(id);
  DOM.lightboxImg.src         = img.url;
  DOM.lightboxCap.textContent = img.file || '';
  DOM.lightboxDl.href         = img.url;
  DOM.lightbox.classList.add('open');
}

function initLightbox() {
  document.getElementById('lightbox-close')?.addEventListener('click', () =>
    DOM.lightbox.classList.remove('open')
  );
  DOM.lightbox?.addEventListener('click', e => {
    if (e.target === DOM.lightbox) DOM.lightbox.classList.remove('open');
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BOOKS — grid → PDF modal  ← FIX ⑥
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderBooks() {
  const container = document.getElementById('books-grid');
  const books     = State.data.books;

  if (!books.length) {
    container.innerHTML = emptyState('⊟', 'No books yet.<br>Add PDFs to <code>shunya/books/pdfs/</code> and run <code>generate_json.py</code>');
    return;
  }

  container.innerHTML = `<div class="content-grid">${
    books.map((b, i) => buildCard(b, { badge: 'PDF', delay: i * 0.06 })).join('')
  }</div>`;

  lazyLoad(container);

  container.querySelectorAll('.content-card').forEach(card => {
    const item = books.find(b => b.id === card.dataset.id);
    if (!item) return;

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.innerHTML = `
      <button class="btn-read">Read</button>
      <a href="${item.url}" download class="btn-dl">↓ Save</a>
    `;
    card.appendChild(actions);

    // Both card click and "Read" button open PDF modal
    card.addEventListener('click', e => {
      if (e.target.classList.contains('btn-dl')) return;
      openPdfModal(item);
    });

    actions.querySelector('.btn-read').addEventListener('click', e => {
      e.stopPropagation();
      openPdfModal(item);
    });
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BOTTOM PLAYER BAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function showPlayerBar(item, label) {
  DOM.playerBar.classList.add('visible');
  DOM.playerTitle.textContent        = item.title || item.file || '—';
  DOM.playerSub.textContent          = label || '';
  DOM.playerThumb.src                = item.thumbnailUrl || '';
  DOM.playerThumb.style.display      = item.thumbnailUrl ? 'block' : 'none';
  DOM.dlBtn.href                     = item.url || '#';
  DOM.dlBtn.setAttribute('download', item.file || '');
}

function updateProgress(current, duration) {
  if (!duration || isNaN(duration)) return;
  DOM.progressFill.style.width = `${(current / duration) * 100}%`;
  DOM.timeElapsed.textContent  = fmt(current);
  DOM.timeRemain.textContent   = `-${fmt(duration - current)}`;
}

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function initPlayerBar() {
  DOM.playPauseBtn?.addEventListener('click', () => {
    if (DOM.mainAudio.src) toggleAudioPlayback();
  });

  DOM.prevBtn?.addEventListener('click', () => {
    const i = State.audio.currentIndex;
    if (i > 0) playAudioById(State.audio.list[i - 1].id);
  });

  DOM.nextBtn?.addEventListener('click', () => {
    const i = State.audio.currentIndex;
    if (i < State.audio.list.length - 1) playAudioById(State.audio.list[i + 1].id);
  });

  DOM.progressTrack?.addEventListener('click', e => {
    if (!DOM.mainAudio.duration) return;
    const r = DOM.progressTrack.getBoundingClientRect();
    DOM.mainAudio.currentTime = ((e.clientX - r.left) / r.width) * DOM.mainAudio.duration;
  });

  // ⑧ Volume slider for main audio player
  DOM.volumeSlider?.addEventListener('input', function () {
    DOM.mainAudio.volume = this.value / 100;
  });
  // Sync slider with initial volume
  if (DOM.volumeSlider) DOM.volumeSlider.value = 80;
  DOM.mainAudio.volume = 0.8;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RANDOM WISDOM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function randomWisdom() {
  const pool = [
    ...State.data.audios.map(a  => ({ type: 'audio', id: a.id })),
    ...State.data.echo.all.map(e => ({ type: 'echo',  id: e.id })),
    ...State.data.images.map(i  => ({ type: 'image', id: i.id })),
    ...State.data.books.map(b   => ({ type: 'book',  id: b.id })),
  ];
  if (!pool.length) return showToast('Nothing in the library yet.');

  const pick = pool[Math.floor(Math.random() * pool.length)];
  showToast('Opening something unexpected…');

  setTimeout(() => {
    if (pick.type === 'audio') { navigateTo('audios'); setTimeout(() => playAudioById(pick.id), 400); }
    if (pick.type === 'echo')  { navigateTo('echo');   setTimeout(() => openEchoById(pick.id),  400); }
    if (pick.type === 'image') { navigateTo('images'); setTimeout(() => openImageById(pick.id), 500); }
    if (pick.type === 'book')  { navigateTo('books'); }
  }, 600);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MOBILE NAV + ESC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initMobileNav() {
  document.getElementById('mobile-menu-toggle')?.addEventListener('click', () =>
    DOM.sidebar.classList.toggle('open')
  );
  window.addEventListener('resize', () => { State.isMobile = window.innerWidth < 900; });
}

function initEscKey() {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    DOM.txtReader?.classList.remove('open');
    DOM.lightbox?.classList.remove('open');
    DOM.pdfModal?.classList.remove('open');
    if (DOM.pdfModal?.classList.contains('open') === false && State.pdf.currentItem) {
      closePdfModal();
    }
    closeVideoModal();
    DOM.sidebar?.classList.remove('open');
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UTILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function showToast(msg, ms = 3000) {
  if (!DOM.toast) return;
  DOM.toast.innerHTML = msg;
  DOM.toast.classList.add('show');
  setTimeout(() => DOM.toast.classList.remove('show'), ms);
}

function emptyState(glyph, msg) {
  return `<div class="empty-state">
    <div class="empty-state-glyph">${glyph}</div>
    <div class="empty-state-text">${msg}</div>
  </div>`;
}

function initSiteMeta() {
  const g    = State.data.global;
  const name = g?.site?.name     || 'ShunyaSpace';
  const sub  = g?.site?.subtitle || 'शून्य';
  const nameEl = document.getElementById('logo-name');
  const subEl  = document.getElementById('logo-sub');
  if (nameEl) nameEl.textContent = name;
  if (subEl)  subEl.textContent  = sub;
  document.title = name;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STARS CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initStars() {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const stars = Array.from({ length: 120 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 0.8 + 0.2,
    o: Math.random() * 0.4 + 0.1,
    s: Math.random() * 0.0003 + 0.0001,
    p: Math.random() * Math.PI * 2,
  }));

  let t = 0;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    t += 0.01;
    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192,132,252,${s.o * (0.6 + 0.4 * Math.sin(t * s.s * 100 + s.p))})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BOOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function boot() {
  cacheDom();
  await loadAllData();

  initSiteMeta();
  initNav();
  initPlayerBar();
  bindAudioEvents();
  initVideoModal();
  initTxtReader();
  initPdfModal();
  initLightbox();
  initMobileNav();
  initAmbientControls();
  initEscKey();
  initStars();

  document.getElementById('btn-random')?.addEventListener('click', randomWisdom);

  navigateTo('home');

  if (DOM.app) DOM.app.style.opacity = '1';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
