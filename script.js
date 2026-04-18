/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ShunyaSpace — script.js  (v2)
   New JSON format: { type, base_url, items[] }
   Unified bottom player for audio / video / ambient
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

'use strict';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const State = {
  data: {
    global: null, home: null,
    audios: [], ambient: [], videos: [],
    echo: { pdfs: [], txts: [], all: [] },
    books: [], images: [],
  },
  currentSection: 'home',
  isMobile: window.innerWidth < 900,

  // Discourse audio player (uses #main-audio element)
  audio: {
    currentId:    null,
    isPlaying:    false,
    list:         [],   // flat array of audio items
    currentIndex: -1,
  },

  // Ambient player (uses #main-video or #main-audio — see below)
  ambient: {
    currentId: null,
    isPlaying: false,
    volume:    0.3,
  },
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DOM REFERENCES  (set after DOMContentLoaded)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const DOM = {};

function cacheDom() {
  DOM.mainAudio      = document.getElementById('main-audio');
  DOM.ambientAudio   = document.getElementById('ambient-audio');
  DOM.mainVideo      = document.getElementById('main-video');
  DOM.playerBar      = document.getElementById('bottom-player');
  DOM.playerThumb    = document.getElementById('player-thumb');
  DOM.playerTitle    = document.getElementById('player-title');
  DOM.playerSub      = document.getElementById('player-speaker');
  DOM.playPauseBtn   = document.getElementById('btn-play-pause');
  DOM.prevBtn        = document.querySelector('.btn-prev');
  DOM.nextBtn        = document.querySelector('.btn-next');
  DOM.progressTrack  = document.querySelector('.progress-track');
  DOM.progressFill   = document.querySelector('.progress-fill');
  DOM.timeElapsed    = document.getElementById('time-elapsed');
  DOM.timeRemain     = document.getElementById('time-remain');
  DOM.dlBtn          = document.getElementById('player-download');
  DOM.toast          = document.getElementById('toast');
  DOM.lightbox       = document.getElementById('lightbox');
  DOM.lightboxImg    = document.getElementById('lightbox-img');
  DOM.lightboxCaption = document.getElementById('lightbox-caption');
  DOM.lightboxDl     = document.getElementById('lightbox-dl');
  DOM.videoModal     = document.getElementById('video-modal');
  DOM.modalVideo     = document.getElementById('modal-video');
  DOM.txtReader      = document.getElementById('txt-reader');
  DOM.readerContent  = document.getElementById('reader-content');
  DOM.sidebar        = document.getElementById('sidebar');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LOCAL STORAGE HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const Store = {
  get:   (k)    => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:   (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },

  saveAudioTime:  (id, t)  => Store.set(`audio_${id}`, t),
  getAudioTime:   (id)     => Store.get(`audio_${id}`) || 0,
  saveTxtScroll:  (id, pos) => Store.set(`txt_${id}`, pos),
  getTxtScroll:   (id)     => Store.get(`txt_${id}`) || 0,
  saveLastAudio:  (id)     => Store.set('last_audio', id),
  getLastAudio:   ()       => Store.get('last_audio'),
  saveLastEcho:   (id)     => Store.set('last_echo', id),
  getLastEcho:    ()       => Store.get('last_echo'),
  getRecentImages: ()      => Store.get('images_recent') || [],
  addRecentImage: (id) => {
    let r = Store.getRecentImages();
    r = [id, ...r.filter(x => x !== id)].slice(0, 5);
    Store.set('images_recent', r);
  },
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   JSON LOADING + FORMAT PARSING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Fetch JSON from path, return null on failure */
async function fetchJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Could not load ${path}:`, err.message);
    return null;
  }
}

/**
 * Parse a standard section JSON  { type, base_url, items[] }
 * Attaches full .url and .thumbnailUrl to each item.
 */
function parseSection(data) {
  if (!data || !Array.isArray(data.items)) return [];
  const base = data.base_url || '';

  return data.items.map(item => ({
    ...item,
    url:          base + item.file,
    thumbnailUrl: item.thumbnail ? base + item.thumbnail : '',
  }));
}

/** Parse echo JSON  { type, base_url, pdfs[], txts[] } */
function parseEcho(data) {
  if (!data) return { pdfs: [], txts: [], all: [] };
  const base = data.base_url || '';

  const map = (arr, type) =>
    (arr || []).map(item => ({
      ...item,
      type,
      url:          base + item.file,
      thumbnailUrl: item.thumbnail ? base + item.thumbnail : '',
    }));

  const pdfs = map(data.pdfs, 'pdf');
  const txts = map(data.txts, 'txt');
  return { pdfs, txts, all: [...txts, ...pdfs] };
}

/** Parse images JSON  { type, base_url, items[] }  (no thumbnails) */
function parseImages(data) {
  if (!data || !Array.isArray(data.items)) return [];
  const base = data.base_url || '';
  return data.items.map(item => ({
    ...item,
    url: base + item.file,
  }));
}

async function loadAllData() {
  const [global, home, audiosRaw, ambientRaw, videosRaw, echoRaw, booksRaw, imagesRaw] =
    await Promise.all([
      fetchJSON('data/global.json'),
      fetchJSON('data/home.json'),
      fetchJSON('data/audios.json'),
      fetchJSON('data/ambient.json'),
      fetchJSON('data/videos.json'),
      fetchJSON('data/echo.json'),
      fetchJSON('data/books.json'),
      fetchJSON('data/images.json'),
    ]);

  State.data.global  = global;
  State.data.home    = home;
  State.data.audios  = parseSection(audiosRaw);
  State.data.ambient = parseSection(ambientRaw);
  State.data.videos  = parseSection(videosRaw);
  State.data.books   = parseSection(booksRaw);
  State.data.echo    = parseEcho(echoRaw);
  State.data.images  = parseImages(imagesRaw);

  State.audio.list = State.data.audios;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NAVIGATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initNav() {
  const nav     = State.data.global?.nav || [];
  const navList = document.getElementById('nav-list');

  navList.innerHTML = nav.map(item => `
    <li class="nav-item">
      <a href="#" class="nav-link" data-section="${item.id}" aria-label="${item.label}">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
        <span class="nav-hint">${item.hint}</span>
      </a>
    </li>
  `).join('');

  navList.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.section);
      DOM.sidebar.classList.remove('open');
    });
  });
}

function navigateTo(sectionId) {
  document.querySelectorAll('.section').forEach(s =>
    s.classList.remove('visible', 'faded-in')
  );

  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.section === sectionId)
  );

  const el = document.getElementById(`section-${sectionId}`);
  if (!el) return;

  el.classList.add('visible');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => el.classList.add('faded-in'))
  );

  renderSection(sectionId);
  State.currentSection = sectionId;
}

function renderSection(id) {
  const renderers = {
    home:    renderHome,
    images:  renderImages,
    audios:  renderAudios,
    videos:  renderVideos,
    echo:    renderEcho,
    ambient: renderAmbient,
    books:   renderBooks,
  };
  renderers[id]?.();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHARED CARD BUILDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Build a generic content card with thumbnail + title.
 * The card dispatches a custom event 'card-click' with item payload.
 */
function buildCard(item, opts = {}) {
  const {
    badge    = '',
    subtitle = '',
    delay    = 0,
    extraClass = '',
  } = opts;

  const thumb = item.thumbnailUrl
    ? `<img data-src="${item.thumbnailUrl}" alt="${item.title || ''}" loading="lazy">`
    : `<div class="card-thumb-placeholder">${badge || '◌'}</div>`;

  return `
    <div class="content-card animate-in ${extraClass}"
         data-id="${item.id}"
         style="animation-delay:${delay}s">
      <div class="card-thumb">${thumb}</div>
      <div class="card-info">
        ${badge ? `<span class="card-badge">${badge}</span>` : ''}
        <div class="card-title">${item.title || item.file || ''}</div>
        ${subtitle ? `<div class="card-sub">${subtitle}</div>` : ''}
      </div>
    </div>
  `;
}

/** Attach lazy loading to all [data-src] images inside a container */
function attachLazyLoad(container) {
  container.querySelectorAll('img[data-src]').forEach(img => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          el.src = el.dataset.src;
          el.onload = () => el.classList.add('loaded');
          obs.unobserve(el);
        }
      });
    });
    obs.observe(img);
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HOME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderHome() {
  const { home, global } = State.data;
  const container = document.getElementById('home-inner');

  // Random quote
  const quotes = home?.quotes || [];
  const q = quotes[Math.floor(Math.random() * quotes.length)] || {};

  // Resume items — look up by stored IDs
  const lastAudioId = Store.getLastAudio();
  const lastEchoId  = Store.getLastEcho();
  const recentImgs  = Store.getRecentImages();

  const audioItem = State.data.audios.find(a => a.id === lastAudioId);
  const echoItem  = State.data.echo.all.find(e => e.id === lastEchoId);
  const imgItem   = recentImgs.length
    ? State.data.images.find(i => i.id === recentImgs[0])
    : null;

  const resumeCards = [
    audioItem ? `<div class="resume-card animate-in" data-action="resume-audio" data-id="${audioItem.id}">
      <div class="resume-card-type">↺ Continue Listening</div>
      <div class="resume-card-title">${audioItem.title}</div>
    </div>` : '',
    echoItem ? `<div class="resume-card animate-in" data-action="resume-echo" data-id="${echoItem.id}">
      <div class="resume-card-type">↺ Continue Reading</div>
      <div class="resume-card-title">${echoItem.title}</div>
    </div>` : '',
    imgItem ? `<div class="resume-card animate-in" data-action="resume-image" data-id="${imgItem.id}">
      <div class="resume-card-type">◎ Recently Viewed</div>
      <div class="resume-card-title">${imgItem.file || 'An image'}</div>
    </div>` : '',
  ].filter(Boolean).join('');

  container.innerHTML = `
    <div class="home-hero">
      <div class="home-shunya-glyph">शून्य</div>
      <div class="home-welcome">${home?.welcome || 'You have arrived.'}</div>
      <div class="home-tagline">${global?.site?.tagline || ''}</div>
    </div>

    <div class="home-quote-block animate-in">
      <div class="quote-text">${q.text || ''}</div>
      <div class="quote-author">— ${q.author || ''}</div>
    </div>

    ${resumeCards ? `<div class="home-resume">
      <div class="resume-title">Where you left off</div>
      <div class="resume-cards">${resumeCards}</div>
    </div>` : ''}
  `;

  container.querySelectorAll('[data-action]').forEach(card => {
    card.addEventListener('click', () => {
      const { action, id } = card.dataset;
      if (action === 'resume-audio') {
        navigateTo('audios');
        setTimeout(() => playAudioById(id), 300);
      } else if (action === 'resume-echo') {
        navigateTo('echo');
        setTimeout(() => openEchoById(id), 300);
      } else if (action === 'resume-image') {
        navigateTo('images');
        setTimeout(() => openImageById(id), 400);
      }
    });
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   IMAGES — grid of cards → lightbox on click
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderImages() {
  const container = document.getElementById('images-grid');
  const images    = State.data.images;

  if (!images.length) {
    container.innerHTML = emptyState('◎', 'No images yet. Add files to the images folder and run generate_json.py');
    return;
  }

  container.innerHTML = images.map((img, i) => `
    <div class="image-card animate-in" data-id="${img.id}" style="animation-delay:${i * 0.04}s">
      <img data-src="${img.url}" alt="${img.file || ''}" loading="lazy">
      <div class="image-card-overlay">
        <span class="image-caption">${img.file || ''}</span>
        <a href="${img.url}" download class="image-download-btn" title="Download">↓</a>
      </div>
    </div>
  `).join('');

  attachLazyLoad(container);

  container.querySelectorAll('.image-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('image-download-btn')) return;
      openImageById(card.dataset.id);
    });
  });
}

function openImageById(id) {
  const img = State.data.images.find(i => i.id === id);
  if (!img) return;
  Store.addRecentImage(id);
  DOM.lightboxImg.src       = img.url;
  DOM.lightboxCaption.textContent = img.file || '';
  DOM.lightboxDl.href       = img.url;
  DOM.lightbox.classList.add('open');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AUDIOS — grid of cards → bottom player
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderAudios() {
  const container = document.getElementById('audios-list');
  const audios    = State.data.audios;

  if (!audios.length) {
    container.innerHTML = emptyState('◑', 'No audios yet. Add .mp3 files to shunya_data/audios and run generate_json.py');
    return;
  }

  container.innerHTML = `<div class="content-grid">${
    audios.map((a, i) => buildCard(a, {
      badge:    'Audio',
      delay:    i * 0.05,
      extraClass: State.audio.currentId === a.id ? 'is-active' : '',
    })).join('')
  }</div>`;

  attachLazyLoad(container);

  container.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => playAudioById(card.dataset.id));
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AUDIO PLAYBACK ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function playAudioById(id) {
  const item = State.data.audios.find(a => a.id === id);
  if (!item) return;

  Store.saveLastAudio(id);

  // Mobile: stop ambient if playing
  if (State.isMobile && State.ambient.isPlaying) stopAmbient();

  // Same track → toggle play/pause
  if (State.audio.currentId === id) {
    toggleAudioPlayback();
    return;
  }

  // Save time on old track
  if (State.audio.currentId) {
    Store.saveAudioTime(State.audio.currentId, DOM.mainAudio.currentTime);
  }

  // Load new track
  State.audio.currentId    = id;
  State.audio.currentIndex = State.data.audios.findIndex(a => a.id === id);

  DOM.mainAudio.src          = item.url;
  DOM.mainAudio.currentTime  = Store.getAudioTime(id);

  DOM.mainAudio.play()
    .then(() => {
      State.audio.isPlaying = true;
      showPlayerBar(item, 'audio');
      updateAudioUI();
    })
    .catch(() => {
      showToast('Audio could not be loaded. Check the URL.');
      showPlayerBar(item, 'audio');
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
  updateAudioUI();
}

function updateAudioUI() {
  // Highlight active card
  document.querySelectorAll('#audios-list .content-card').forEach(card => {
    card.classList.toggle('is-active', card.dataset.id === State.audio.currentId);
  });
  // Update play/pause button icon
  DOM.playPauseBtn.textContent = State.audio.isPlaying ? '⏸' : '▷';
}

/* ── Audio element event listeners ── */
function bindAudioEvents() {
  DOM.mainAudio.addEventListener('timeupdate', () => {
    if (State.audio.currentId) {
      Store.saveAudioTime(State.audio.currentId, DOM.mainAudio.currentTime);
    }
    updateProgressUI(DOM.mainAudio.currentTime, DOM.mainAudio.duration);
  });

  DOM.mainAudio.addEventListener('ended', () => {
    State.audio.isPlaying = false;
    updateAudioUI();
    // Auto-advance to next track
    const next = State.audio.currentIndex + 1;
    if (next < State.audio.list.length) {
      playAudioById(State.audio.list[next].id);
    }
  });

  DOM.mainAudio.addEventListener('play',  () => { State.audio.isPlaying = true;  updateAudioUI(); });
  DOM.mainAudio.addEventListener('pause', () => { State.audio.isPlaying = false; updateAudioUI(); });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VIDEOS — grid → modal player
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderVideos() {
  const container = document.getElementById('videos-grid');
  const videos    = State.data.videos;

  if (!videos.length) {
    container.innerHTML = emptyState('▷', 'No videos yet. Add files to shunya_data/videos and run generate_json.py');
    return;
  }

  container.innerHTML = `<div class="content-grid">${
    videos.map((v, i) => buildCard(v, { badge: '▷', delay: i * 0.06 })).join('')
  }</div>`;

  attachLazyLoad(container);

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
  DOM.modalVideo.play().catch(() => {
    showToast('Video could not be loaded. Check the URL.');
  });
}

function initVideoModal() {
  document.querySelector('.video-modal-close').addEventListener('click', closeVideoModal);
  DOM.videoModal.addEventListener('click', e => {
    if (e.target === DOM.videoModal) closeVideoModal();
  });
}

function closeVideoModal() {
  DOM.videoModal.classList.remove('open');
  DOM.modalVideo.pause();
  DOM.modalVideo.src = '';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ECHO — cards → TXT reader or PDF (new tab)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderEcho() {
  const container = document.getElementById('echo-grid');
  const { pdfs, txts } = State.data.echo;
  const all = [...txts, ...pdfs];

  if (!all.length) {
    container.innerHTML = emptyState('∿', 'No writings yet. Add files to shunya/echo and run generate_json.py');
    return;
  }

  container.innerHTML = all.map((item, i) => buildCard(item, {
    badge:    item.type === 'pdf' ? 'PDF' : 'TXT',
    delay:    i * 0.06,
    extraClass: `echo-${item.type}`,
  })).join('');

  attachLazyLoad(container);

  container.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => openEchoById(card.dataset.id));
  });
}

function openEchoById(id) {
  const item = State.data.echo.all.find(e => e.id === id);
  if (!item) return;

  Store.saveLastEcho(id);

  if (item.type === 'pdf') {
    window.open(item.url, '_blank');
    return;
  }

  openTxtReader(item);
}

async function openTxtReader(item) {
  document.getElementById('reader-doc-title').textContent = item.title || item.file;
  document.getElementById('reader-eyebrow').textContent   = 'Echo · Writing';
  DOM.readerContent.textContent = 'Loading...';
  DOM.txtReader.classList.add('open');

  const wrap = document.querySelector('.reader-content-wrap');

  try {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error('File not found');
    const text = await res.text();
    DOM.readerContent.textContent = text;
    setTimeout(() => { wrap.scrollTop = Store.getTxtScroll(item.id); }, 80);
  } catch {
    DOM.readerContent.textContent =
      `${item.title}\n\n${item.excerpt || ''}\n\n` +
      `[Full text not available. Place the file at: ${item.file}]`;
  }

  // Persist scroll position
  const scrollHandler = () => Store.saveTxtScroll(item.id, wrap.scrollTop);
  wrap.addEventListener('scroll', scrollHandler, { passive: true });

  // Clean up listener when reader closes
  DOM.txtReader.dataset.scrollCleanup = 'pending';
}

function initTxtReader() {
  const closeReader = () => DOM.txtReader.classList.remove('open');
  document.getElementById('reader-close').addEventListener('click', closeReader);
  document.getElementById('reader-close-top').addEventListener('click', closeReader);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AMBIENT — cards → looped background audio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderAmbient() {
  const container = document.getElementById('ambient-grid');
  const items     = State.data.ambient;

  if (!items.length) {
    container.innerHTML = emptyState('〰', 'No ambient sounds yet. Add files to shunya_data/ambient and run generate_json.py');
    return;
  }

  container.innerHTML = items.map((a, i) => `
    <div class="ambient-card animate-in ${State.ambient.currentId === a.id && State.ambient.isPlaying ? 'playing' : ''}"
         data-id="${a.id}" data-url="${a.url}" style="animation-delay:${i * 0.06}s">
      <div class="ambient-icon">〰</div>
      <div class="ambient-title">${a.title}</div>
      <div class="ambient-status">${State.ambient.currentId === a.id && State.ambient.isPlaying ? '● Playing' : '○ Tap'}</div>
    </div>
  `).join('');

  container.querySelectorAll('.ambient-card').forEach(card => {
    card.addEventListener('click', () => toggleAmbient(card.dataset.id));
  });
}

function toggleAmbient(id) {
  const item = State.data.ambient.find(a => a.id === id);
  if (!item) return;

  // Clicking the same → stop
  if (State.ambient.currentId === id && State.ambient.isPlaying) {
    stopAmbient();
    return;
  }

  // Mobile: stop discourse audio if playing
  if (State.isMobile && State.audio.isPlaying) {
    DOM.mainAudio.pause();
    State.audio.isPlaying = false;
    updateAudioUI();
  }

  stopAmbient();   // stop any previous ambient

  DOM.ambientAudio.src    = item.url;
  DOM.ambientAudio.loop   = true;
  DOM.ambientAudio.volume = State.ambient.volume;

  DOM.ambientAudio.play()
    .then(() => {
      State.ambient.currentId = id;
      State.ambient.isPlaying = true;
      updateAmbientMini(item);
      renderAmbient();
    })
    .catch(() => {
      showToast('Ambient sound could not be loaded.');
    });
}

function stopAmbient() {
  if (!DOM.ambientAudio.paused) DOM.ambientAudio.pause();
  DOM.ambientAudio.src    = '';
  State.ambient.currentId = null;
  State.ambient.isPlaying = false;
  updateAmbientMini(null);
}

function updateAmbientMini(item) {
  const mini = document.querySelector('.ambient-mini');
  if (!mini) return;
  if (item) {
    mini.classList.add('active');
    mini.querySelector('.ambient-mini-title span:first-child').textContent = `〰 ${item.title}`;
  } else {
    mini.classList.remove('active');
    mini.querySelector('.ambient-mini-title span:first-child').textContent = 'No ambient';
  }
}

function initAmbientVolume() {
  const slider = document.getElementById('ambient-volume');
  if (!slider) return;
  slider.addEventListener('input', () => {
    State.ambient.volume        = slider.value / 100;
    DOM.ambientAudio.volume     = State.ambient.volume;
  });
}

function initAmbientMiniStop() {
  document.querySelector('.ambient-mini-stop')?.addEventListener('click', () => {
    stopAmbient();
    renderAmbient();
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BOOKS — grid → open PDF in new tab + download
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderBooks() {
  const container = document.getElementById('books-grid');
  const books     = State.data.books;

  if (!books.length) {
    container.innerHTML = emptyState('⊟', 'No books yet. Add PDFs to shunya/books/pdfs and run generate_json.py');
    return;
  }

  container.innerHTML = `<div class="content-grid">${
    books.map((b, i) => buildCard(b, { badge: 'PDF', delay: i * 0.06 })).join('')
  }</div>`;

  // Add download buttons below each card
  container.querySelectorAll('.content-card').forEach(card => {
    const item = books.find(b => b.id === card.dataset.id);
    if (!item) return;

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.innerHTML = `
      <button class="btn-read" data-url="${item.url}">Read</button>
      <a href="${item.url}" download class="btn-dl">↓ Save</a>
    `;
    card.appendChild(actions);

    actions.querySelector('.btn-read').addEventListener('click', e => {
      e.stopPropagation();
      window.open(item.url, '_blank');
    });
  });

  attachLazyLoad(container);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UNIFIED BOTTOM PLAYER BAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Show the bottom player bar for a given content item.
 * type: 'audio' | 'video' (videos use the modal, so this is mainly audio)
 */
function showPlayerBar(item, type) {
  DOM.playerBar.classList.add('visible');
  DOM.playerTitle.textContent  = item.title || item.file || '—';
  DOM.playerSub.textContent    = item.speaker || item.author || type || '';
  DOM.playerThumb.src          = item.thumbnailUrl || '';
  DOM.playerThumb.style.display = item.thumbnailUrl ? 'block' : 'none';
  DOM.dlBtn.href               = item.url || '#';
  DOM.dlBtn.download           = item.file || '';
}

/** Update the progress bar + timestamps */
function updateProgressUI(current, duration) {
  if (duration && !isNaN(duration)) {
    DOM.progressFill.style.width = `${(current / duration) * 100}%`;
    DOM.timeElapsed.textContent  = fmtTime(current);
    DOM.timeRemain.textContent   = `-${fmtTime(duration - current)}`;
  }
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function initPlayerBar() {
  // Play / Pause
  DOM.playPauseBtn.addEventListener('click', () => {
    if (DOM.mainAudio.src) toggleAudioPlayback();
  });

  // Previous track
  DOM.prevBtn.addEventListener('click', () => {
    const idx = State.audio.currentIndex;
    if (idx > 0) playAudioById(State.audio.list[idx - 1].id);
  });

  // Next track
  DOM.nextBtn.addEventListener('click', () => {
    const idx = State.audio.currentIndex;
    if (idx < State.audio.list.length - 1) playAudioById(State.audio.list[idx + 1].id);
  });

  // Seek on progress bar click
  DOM.progressTrack.addEventListener('click', e => {
    if (!DOM.mainAudio.duration) return;
    const rect  = DOM.progressTrack.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    DOM.mainAudio.currentTime = ratio * DOM.mainAudio.duration;
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RANDOM WISDOM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function randomWisdom() {
  const pool = [
    ...State.data.audios.map(a  => ({ type: 'audio', id: a.id })),
    ...State.data.images.map(i  => ({ type: 'image', id: i.id })),
    ...State.data.books.map(b   => ({ type: 'book',  id: b.id })),
    ...State.data.echo.all.map(e => ({ type: 'echo',  id: e.id })),
  ];

  if (!pool.length) return showToast('Nothing in the library yet.');

  const pick = pool[Math.floor(Math.random() * pool.length)];
  showToast('Opening something unexpected...');

  setTimeout(() => {
    if      (pick.type === 'audio') { navigateTo('audios'); setTimeout(() => playAudioById(pick.id), 400); }
    else if (pick.type === 'image') { navigateTo('images'); setTimeout(() => openImageById(pick.id),  500); }
    else if (pick.type === 'book')  { navigateTo('books'); }
    else if (pick.type === 'echo')  { navigateTo('echo');  setTimeout(() => openEchoById(pick.id),   400); }
  }, 600);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LIGHTBOX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', () =>
    DOM.lightbox.classList.remove('open')
  );
  DOM.lightbox.addEventListener('click', e => {
    if (e.target === DOM.lightbox) DOM.lightbox.classList.remove('open');
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MOBILE NAV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initMobileNav() {
  document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('open');
  });

  // Recalculate isMobile on resize
  window.addEventListener('resize', () => {
    State.isMobile = window.innerWidth < 900;
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GLOBAL ESC KEY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initEscKey() {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    DOM.txtReader.classList.remove('open');
    DOM.lightbox.classList.remove('open');
    closeVideoModal();
    DOM.sidebar.classList.remove('open');
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOAST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function showToast(msg, ms = 2800) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  setTimeout(() => DOM.toast.classList.remove('show'), ms);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EMPTY STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function emptyState(glyph, msg) {
  return `<div class="empty-state">
    <div class="empty-state-glyph">${glyph}</div>
    <div class="empty-state-text">${msg}</div>
  </div>`;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SITE META
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initSiteMeta() {
  const g = State.data.global;
  if (!g) return;
  document.getElementById('logo-name').textContent = g.site?.name     || 'ShunyaSpace';
  document.getElementById('logo-sub').textContent  = g.site?.subtitle || '';
  document.title = g.site?.name || 'ShunyaSpace';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STARS CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initStars() {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const stars = Array.from({ length: 120 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 0.8 + 0.2,
    o: Math.random() * 0.4 + 0.1,
    speed: Math.random() * 0.0003 + 0.0001,
    phase: Math.random() * Math.PI * 2,
  }));

  let frame = 0;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame += 0.01;
    stars.forEach(s => {
      const opacity = s.o * (0.6 + 0.4 * Math.sin(frame * s.speed * 100 + s.phase));
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192,132,252,${opacity})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BOOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function boot() {
  cacheDom();
  await loadAllData();

  initSiteMeta();
  initNav();
  initPlayerBar();
  bindAudioEvents();
  initVideoModal();
  initTxtReader();
  initLightbox();
  initMobileNav();
  initAmbientMiniStop();
  initAmbientVolume();
  initEscKey();
  initStars();

  document.getElementById('btn-random').addEventListener('click', randomWisdom);

  navigateTo('home');

  // Fade in entire app
  const app = document.getElementById('app');
  if (app) app.style.opacity = '1';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
