/* ═══════════════════════════════════════════════════════════
   ShunyaSpace — script.js  (v8)

   NEW IN v8:
   ① Logo breathing animation synced
   ② Quotes fetched from shunya/data/quotes.json
   ③ Play indicator only on audio / video / ambient cards
   ④ Random wisdom fixed for ambient + books + all sections
   ⑤ Cursor interaction with background orbs (subtle)
   ⑥ FALLBACK_NAV updated with Hindi sidebar labels
   ⑦ Logo path fix, About modal logo
   ⑧ Text contrast improvements via CSS
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─── FALLBACK NAV ─────────────────────────────────────── */
const FALLBACK_NAV = [
  { id:'home',    label:'Pravaah',      icon:'◌',  hint:'The flow' },
  { id:'audios',  label:'Shravan',      icon:'◑',  hint:'What is heard' },
  { id:'ambient', label:'अनुभूति',      icon:'〰', hint:'Surrounding sound' },
  { id:'videos',  label:'दृश्य',        icon:'▷',  hint:'Moving light' },
  { id:'echo',    label:'प्रतिध्वनि',   icon:'∿',  hint:'Words that remain' },
  { id:'images',  label:'Drishya',      icon:'◎',  hint:'What is seen' },
  { id:'books',   label:'पुस्तक',       icon:'⊟',  hint:'Deeper waters' },
];

/* ─── STATE ────────────────────────────────────────────── */
const State = {
  data: {
    global:null, home:null,
    audios:[], ambient:[], videos:[], books:[], images:[],
    echo: { pdfs:[], txts:[], all:[] },
  },
  currentSection: '',
  isMobile: innerWidth < 900,
  rendered: new Set(),

  audio:   { currentId:null, isPlaying:false, list:[], currentIndex:-1, volume:0.85, speed:1 },
  ambient: { currentId:null, isPlaying:false, volume:0.3 },
  pdf:     { currentItem:null, doc:null },

  // Lightbox image nav
  lightboxImages: [],
  lightboxIndex:  0,

  // Video nav
  videoList:  [],
  videoIndex: -1,

  // Quotes
  quoteList:  [],
  quoteIndex: 0,

  // Ambient widget image mode: 'show' | 'blur' | 'hide'
  ambientImgMode: 'show',
};

/* ─── DOM CACHE ────────────────────────────────────────── */
const DOM = {};

function cacheDom() {
  DOM.app            = document.getElementById('app');
  DOM.mainAudio      = document.getElementById('main-audio');
  DOM.ambientAudio   = document.getElementById('ambient-audio');

  DOM.playerBar      = document.getElementById('bottom-player');
  DOM.playerThumb    = document.getElementById('player-thumb');
  DOM.playerTitle    = document.getElementById('player-title');
  DOM.playerSub      = document.getElementById('player-speaker');
  DOM.playPauseBtn   = document.getElementById('btn-play-pause');
  DOM.prevBtn        = document.getElementById('btn-prev');
  DOM.nextBtn        = document.getElementById('btn-next');
  DOM.skipBackBtn    = document.getElementById('btn-skip-back');
  DOM.skipFwdBtn     = document.getElementById('btn-skip-fwd');
  DOM.seekTrack      = document.querySelector('.seek-track');
  DOM.seekFill       = document.querySelector('.seek-fill');
  DOM.seekThumb      = document.querySelector('.seek-thumb');
  DOM.timeElapsed    = document.getElementById('time-elapsed');
  DOM.timeRemain     = document.getElementById('time-remain');
  DOM.volSlider      = document.getElementById('player-volume');
  DOM.dlBtn          = document.getElementById('player-download');
  DOM.speedBtn       = document.getElementById('btn-speed');
  DOM.speedPanel     = document.getElementById('speed-panel');
  DOM.speedSlider    = document.getElementById('speed-slider');
  DOM.speedCurrent   = document.getElementById('speed-current');

  DOM.ambWidget      = document.getElementById('ambient-widget');
  DOM.awTitle        = document.getElementById('aw-title');
  DOM.awThumbWrap    = document.getElementById('aw-thumb-wrap');
  DOM.awPlayBtn      = document.getElementById('aw-play-btn');
  DOM.awVolume       = document.getElementById('aw-volume');
  DOM.awVolBtn       = document.getElementById('aw-vol-btn');
  DOM.awVolPopup     = document.getElementById('aw-vol-popup');
  DOM.awVolPopupSlider = document.getElementById('aw-vol-popup-slider');
  DOM.awVolPopupValue  = document.getElementById('aw-vol-popup-value');
  DOM.awPrevBtn      = document.getElementById('aw-prev');
  DOM.awNextBtn      = document.getElementById('aw-next');

  DOM.volPopup       = document.getElementById('vol-popup');
  DOM.volPopupSlider = document.getElementById('vol-popup-slider');
  DOM.volPopupValue  = document.getElementById('vol-popup-value');

  DOM.loadingToast   = document.getElementById('loading-toast');
  DOM.ltPct          = document.getElementById('lt-pct');
  DOM.toast          = document.getElementById('toast');

  DOM.lightbox       = document.getElementById('lightbox');
  DOM.lightboxImg    = document.getElementById('lightbox-img');
  DOM.lightboxCap    = document.getElementById('lightbox-caption');
  DOM.lightboxDl     = document.getElementById('lightbox-dl');
  DOM.lbPrev         = document.getElementById('lb-prev');
  DOM.lbNext         = document.getElementById('lb-next');
  DOM.lbCounter      = document.getElementById('lb-counter');

  DOM.videoModal     = document.getElementById('video-modal');
  DOM.modalVideo     = document.getElementById('modal-video');
  DOM.vidPrev        = document.getElementById('vid-prev');
  DOM.vidNext        = document.getElementById('vid-next');

  DOM.txtReader      = document.getElementById('txt-reader');
  DOM.readerContent  = document.getElementById('reader-content');
  DOM.readerPFill    = document.querySelector('.reader-progress-fill');
  DOM.sidebar        = document.getElementById('sidebar');
  DOM.sidebarOverlay = document.getElementById('sidebar-overlay');

  DOM.pdfModal       = document.getElementById('pdf-modal');
  DOM.pdfContainer   = document.getElementById('pdf-container');
  DOM.pdfLoader      = document.querySelector('.pdf-loader');
  DOM.pdfProgressFill = document.querySelector('.pdf-progress-fill');

  DOM.aboutModal     = document.getElementById('about-modal');
}

/* ─── LOCAL STORAGE ────────────────────────────────────── */
const Store = {
  get:  k    => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:  (k,v)=> { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },

  saveAudioTime:  (id,t) => Store.set(`audio_${id}`,t),
  getAudioTime:   id     => Store.get(`audio_${id}`) || 0,
  saveAudioDur:   (id,d) => Store.set(`audiodur_${id}`,d),
  getAudioDur:    id     => Store.get(`audiodur_${id}`) || 0,

  saveTxtScroll:  (id,p) => Store.set(`txt_${id}`,p),
  getTxtScroll:   id     => Store.get(`txt_${id}`) || 0,
  saveTxtHeight:  (id,h) => Store.set(`txth_${id}`,h),
  getTxtHeight:   id     => Store.get(`txth_${id}`) || 1,

  savePdfScroll:  (id,s) => Store.set(`pdf_scroll_${id}`,s),
  getPdfScroll:   id     => Store.get(`pdf_scroll_${id}`) || 0,
  savePdfHeight:  (id,h) => Store.set(`pdfh_${id}`,h),
  getPdfHeight:   id     => Store.get(`pdfh_${id}`) || 1,

  saveVideoTime:  (id,t) => Store.set(`video_${id}`,t),
  getVideoTime:   id     => Store.get(`video_${id}`) || 0,
  saveVideoDur:   (id,d) => Store.set(`videodur_${id}`,d),
  getVideoDur:    id     => Store.get(`videodur_${id}`) || 0,

  saveLastAudio:  id     => Store.set('last_audio', id),
  getLastAudio:   ()     => Store.get('last_audio'),
  saveLastEcho:   id     => Store.set('last_echo', id),
  getLastEcho:    ()     => Store.get('last_echo'),
  getRecentImages:()     => Store.get('images_recent') || [],
  addRecentImage: id => {
    let r = Store.getRecentImages();
    r = [id,...r.filter(x=>x!==id)].slice(0,5);
    Store.set('images_recent', r);
  },
};

/* ─── URL BUILDER ──────────────────────────────────────── */
function buildUrl(base, filePath) {
  if (!filePath) return '';
  return base + filePath.split('/').map(s => encodeURIComponent(s)).join('/');
}

/* ─── LOADING TOAST ① ─────────────────────────────────── */
let _loadingTimeout = null;

function showLoadingToast(msg = 'Loading…') {
  if (!DOM.loadingToast) return;
  const textEl = DOM.loadingToast.querySelector('.lt-text');
  if (textEl) {
    // Support HTML in msg (e.g. <em> for restore message)
    textEl.innerHTML = msg + ' <span id="lt-pct"></span>';
  }
  DOM.ltPct = document.getElementById('lt-pct');
  DOM.loadingToast.classList.add('show');
  // Safety: always hide after 15s even if load hangs
  clearTimeout(_loadingTimeout);
  _loadingTimeout = setTimeout(hideLoadingToast, 15000);
}

function updateLoadingPct(pct) {
  if (DOM.ltPct) DOM.ltPct.textContent = pct + '%';
}

function hideLoadingToast() {
  clearTimeout(_loadingTimeout);
  DOM.loadingToast?.classList.remove('show');
}

/* ─── JSON LOADING ─────────────────────────────────────── */
async function fetchJSON(path, silent = false) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch(e) {
    if (!silent) console.warn(`[Shunya] fetchJSON ${path}:`, e.message);
    return null;
  }
}

function parseSection(raw) {
  if (!raw || !Array.isArray(raw.items)) return [];
  const b = (raw.base_url||'').replace(/\/$/,'')+'/';
  const sb = b==='/' ? '' : b;
  return raw.items.map(item => ({
    ...item,
    url:          buildUrl(sb, item.file),
    thumbnailUrl: item.thumbnail ? buildUrl(sb, item.thumbnail) : '',
  }));
}

function parseEcho(raw) {
  if (!raw) return {pdfs:[],txts:[],all:[]};
  const b = (raw.base_url||'').replace(/\/$/,'')+'/';
  const sb = b==='/' ? '' : b;
  const map = (arr,type) => (arr||[]).map(item => ({
    ...item, type,
    url:          buildUrl(sb, item.file),
    thumbnailUrl: item.thumbnail ? buildUrl(sb, item.thumbnail) : '',
  }));
  const pdfs = map(raw.pdfs,'pdf');
  const txts = map(raw.txts,'txt');
  return {pdfs, txts, all:[...txts,...pdfs]};
}

function parseImages(raw) {
  if (!raw || !Array.isArray(raw.items)) return [];
  const b = (raw.base_url||'').replace(/\/$/,'')+'/';
  const sb = b==='/' ? '' : b;
  return raw.items.map(item => ({
    ...item, url: buildUrl(sb, item.file), thumbnailUrl: buildUrl(sb, item.file),
  }));
}

async function loadAllData() {
  const [gR,hR,aR,ambR,vR,eR,bR,iR] = await Promise.all([
    fetchJSON('data/global.json', true),
    fetchJSON('data/home.json',   true),
    fetchJSON('data/audios.json'),
    fetchJSON('data/ambient.json'),
    fetchJSON('data/videos.json'),
    fetchJSON('data/echo.json'),
    fetchJSON('data/books.json'),
    fetchJSON('data/images.json'),
  ]);
  State.data.global  = gR;
  State.data.home    = hR;
  State.data.audios  = parseSection(aR);
  State.data.ambient = parseSection(ambR);
  State.data.videos  = parseSection(vR);
  State.data.books   = parseSection(bR);
  State.data.echo    = parseEcho(eR);
  State.data.images  = parseImages(iR);
  State.audio.list   = State.data.audios;
  State.videoList    = State.data.videos;

  // Fetch quotes from shunya/data/quotes.json, fall back to home.json, then hardcoded
  const quotesJson = await fetchJSON('shunya/data/quotes.json', true)
                  || await fetchJSON('data/quotes.json', true);
  const FALLBACK_QUOTES = [
    {text:'The quieter you become, the more you can hear.', author:'Ram Dass'},
    {text:'Emptiness is not a void. It is the ground of being.', author:'Krishnamurti'},
    {text:'You are not a drop in the ocean. You are the entire ocean in a drop.', author:'Rumi'},
    {text:'What you are looking for is what is looking.', author:'Francis of Assisi'},
    {text:'Silence is not the absence of sound but the presence of everything.', author:'Unknown'},
    {text:'The present moment is the only moment available to us.', author:'Thich Nhat Hanh'},
  ];
  if (quotesJson?.length) {
    State.quoteList = quotesJson.map(q => ({text: q.quote || q.text || '', author: q.writer || q.author || ''}));
  } else if (State.data.home?.quotes?.length) {
    State.quoteList = State.data.home.quotes;
  } else {
    State.quoteList = FALLBACK_QUOTES;
  }
  State.quoteIndex = Math.floor(Math.random() * State.quoteList.length);
}

/* ─── NAVIGATION ───────────────────────────────────────── */
function initNav() {
  const items = State.data.global?.nav || FALLBACK_NAV;
  const list  = document.getElementById('nav-list');
  list.innerHTML = items.map(n => `
    <li class="nav-item">
      <a href="#" class="nav-link" data-section="${n.id}" aria-label="${n.label}">
        <span class="nav-icon">${n.icon}</span>
        <span class="nav-label">${n.label}</span>
        <span class="nav-hint">${n.hint}</span>
      </a>
    </li>`).join('');
  list.querySelectorAll('.nav-link').forEach(l =>
    l.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(l.dataset.section);
      closeSidebar();
    })
  );
}

function navigateTo(id) {
  if (State.currentSection === id) return;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('visible','faded-in'));
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.section === id)
  );
  const el = document.getElementById(`section-${id}`);
  if (!el) return;
  el.classList.add('visible');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('faded-in')));
  if (!State.rendered.has(id) || id==='home') {
    renderSection(id);
    State.rendered.add(id);
  }
  State.currentSection = id;
}

function renderSection(id) {
  ({
    home:renderHome, audios:renderAudios, ambient:renderAmbient,
    videos:renderVideos, echo:renderEcho, images:renderImages, books:renderBooks,
  })[id]?.();
}

/* ─── CARD BUILDER (with download overlay + conditional play indicator) ── */
function buildCard(item, {badge='', delay=0, extraClass='', showPlay=false} = {}) {
  const progress = getItemProgress(item);
  const thumb = item.thumbnailUrl
    ? `<img data-src="${item.thumbnailUrl}" alt="" loading="lazy">`
    : `<div class="card-thumb-placeholder">${badge||'◌'}</div>`;
  const progressBar = progress > 0
    ? `<div class="card-progress-bar"><div class="card-progress-fill" style="width:${progress}%"></div></div>`
    : '';
  const dlOverlay = item.url
    ? `<a href="${item.url}" download="${item.file||''}" class="card-dl-overlay" title="Download" onclick="event.stopPropagation()">↓</a>`
    : '';
  // Play indicator only for media types (audio / video / ambient)
  const playIndicator = showPlay ? `
    <div class="card-play-indicator">
      <div class="card-play-circle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,.95)"><polygon points="5,3 19,12 5,21"/></svg>
      </div>
    </div>` : '';
  return `
    <div class="content-card animate-in ${extraClass}" data-id="${item.id}" style="animation-delay:${delay}s">
      <div class="card-thumb">${thumb}${playIndicator}${progressBar}${dlOverlay}</div>
      <div class="card-info">
        ${badge ? `<span class="card-badge">${badge}</span>` : ''}
        <div class="card-title">${item.title||item.file||'—'}</div>
      </div>
    </div>`;
}

function getItemProgress(item) {
  if (!item?.id) return 0;
  if (item.id.startsWith('audio_')) {
    const t = Store.getAudioTime(item.id), d = Store.getAudioDur(item.id);
    return d > 0 ? Math.round((t/d)*100) : 0;
  }
  if (item.type==='txt') {
    const s = Store.getTxtScroll(item.id), h = Store.getTxtHeight(item.id);
    return h > 0 ? Math.min(100, Math.round((s/h)*100)) : 0;
  }
  if (item.type==='pdf') {
    const s = Store.getPdfScroll(item.id), h = Store.getPdfHeight(item.id);
    return h > 0 ? Math.min(100, Math.round((s/h)*100)) : 0;
  }
  if (item.id?.startsWith('vid_')) {
    const t = Store.getVideoTime(item.id), d = Store.getVideoDur(item.id);
    return d > 0 ? Math.round((t/d)*100) : 0;
  }
  // PDFs in books section (no explicit type field)
  const pdfS = Store.getPdfScroll(item.id), pdfH = Store.getPdfHeight(item.id);
  if (pdfH > 0) return Math.min(100, Math.round((pdfS/pdfH)*100));
  return 0;
}

function lazyLoad(container) {
  container.querySelectorAll('img[data-src]').forEach(img => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.src    = el.dataset.src;
      el.onload  = () => el.classList.add('loaded');
      el.onerror = () => {
        const w = el.closest('.card-thumb,.ambient-thumb,.aw-image-wrap,.resume-card-thumb');
        if (w) w.innerHTML = '<div class="card-thumb-placeholder">◌</div>';
      };
      io.disconnect();
    });
    io.observe(img);
  });
}

/* ─── HOME ⑧ (Random Wisdom stays, quote ⑫) ─────────── */
function renderHome() {
  const C = document.getElementById('home-inner');
  const {home, global} = State.data;
  const q = State.quoteList[State.quoteIndex] || State.quoteList[0];

  const lastAudio = State.data.audios.find(a => a.id===Store.getLastAudio());
  const lastEcho  = State.data.echo.all.find(e => e.id===Store.getLastEcho());
  const lastImg   = State.data.images.find(i => i.id===Store.getRecentImages()[0]);

  function progressCard(item, action, label) {
    const pct = getItemProgress(item);
    return `
      <div class="resume-card animate-in" data-action="${action}" data-id="${item.id}">
        ${item.thumbnailUrl
          ? `<div class="resume-card-thumb"><img data-src="${item.thumbnailUrl}" alt=""></div>`
          : ''}
        <div class="resume-card-type">${label}</div>
        <div class="resume-card-title">${item.title||item.file||'—'}</div>
        <div class="resume-progress-wrap">
          <div class="resume-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="resume-progress-label">${pct>0 ? pct+'% complete' : 'Start'}</div>
      </div>`;
  }

  const cards = [
    lastAudio ? progressCard(lastAudio,'resume-audio','↺ Continue Listening') : '',
    lastEcho  ? progressCard(lastEcho, 'resume-echo', '↺ Continue Reading')   : '',
    lastImg   ? `<div class="resume-card animate-in" data-action="resume-image" data-id="${lastImg.id}">
      ${lastImg.url ? `<div class="resume-card-thumb"><img data-src="${lastImg.url}" alt=""></div>` : ''}
      <div class="resume-card-type">◎ Recently Viewed</div>
      <div class="resume-card-title">${lastImg.file||'An image'}</div>
    </div>` : '',
  ].filter(Boolean).join('');

  C.innerHTML = `
    <div class="home-hero">
      <div class="home-shunya-glyph" id="shunya-glyph" role="button" title="About ShunyaSpace">शून्य</div>
      <div class="home-welcome">${home?.welcome||'You have arrived. There is nowhere else to be.'}</div>
      <div class="home-tagline">${global?.site?.tagline||'A silence you can enter'}</div>
    </div>

    <div class="home-quote-block animate-in" id="quote-block" role="button" tabindex="0" title="Tap to change">
      <div class="quote-text" id="quote-text">${q.text}</div>
      <div class="quote-author" id="quote-author">— ${q.author}</div>
      <div class="quote-magic-msg" id="quote-magic">Opening something magical…</div>
    </div>

    ${cards ? `<div class="home-resume">
      <div class="resume-title">Where you left off</div>
      <div class="resume-cards">${cards}</div>
    </div>` : ''}
  `;

  // Lazy load resume thumbnails
  lazyLoad(C);

  // Quote rotation with fade + magic message ⑫
  const qBlock  = document.getElementById('quote-block');
  const qText   = document.getElementById('quote-text');
  const qAuth   = document.getElementById('quote-author');
  const qMagic  = document.getElementById('quote-magic');

  qBlock?.addEventListener('click', () => {
    qMagic.classList.add('show');
    qText.classList.add('fading');
    setTimeout(() => {
      State.quoteIndex = (State.quoteIndex + 1) % State.quoteList.length;
      const next = State.quoteList[State.quoteIndex];
      qText.textContent = next.text;
      qAuth.textContent = '— ' + next.author;
      qText.classList.remove('fading');
      setTimeout(() => qMagic.classList.remove('show'), 1200);
    }, 480);
  });

  // Shunya glyph → about modal
  document.getElementById('shunya-glyph')?.addEventListener('click', () => {
    DOM.aboutModal?.classList.add('open');
  });

  // Resume cards navigation
  C.querySelectorAll('[data-action]').forEach(card => {
    card.addEventListener('click', () => {
      const {action, id} = card.dataset;
      if (action==='resume-audio') {
        // ⑧ Stay on home, just start playing
        playAudioById(id);
      } else if (action==='resume-echo') {
        navigateTo('echo');
        setTimeout(() => openEchoById(id), 300);
      } else if (action==='resume-image') {
        // Open lightbox without leaving home
        openImageById(id, true);
      }
    });
  });
}

/* ─── AUDIOS ───────────────────────────────────────────── */
function renderAudios() {
  const C = document.getElementById('audios-list');
  const audios = State.data.audios;
  if (!audios.length) { C.innerHTML = emptyState('◑','No audios. Add .mp3 files to <code>shunya_data/audios/</code> and run <code>generate_json.py</code>'); return; }
  C.innerHTML = `<div class="content-grid">${
    audios.map((a,i) => buildCard(a,{badge:'Audio',delay:i*.05,showPlay:true,extraClass:State.audio.currentId===a.id?'is-active':''})).join('')
  }</div>`;
  lazyLoad(C);
  C.querySelectorAll('.content-card').forEach(card =>
    card.addEventListener('click', () => playAudioById(card.dataset.id))
  );
}

/* ─── AUDIO ENGINE ① loading toast ────────────────────── */
function playAudioById(id) {
  const item = State.data.audios.find(a => a.id===id);
  if (!item) return;
  Store.saveLastAudio(id);

  if (State.isMobile && State.ambient.isPlaying) stopAmbient();

  if (State.audio.currentId===id) { toggleAudioPlayback(); return; }

  if (State.audio.currentId) Store.saveAudioTime(State.audio.currentId, DOM.mainAudio.currentTime);

  State.audio.currentId    = id;
  State.audio.currentIndex = State.data.audios.findIndex(a=>a.id===id);
  DOM.mainAudio.src         = item.url;
  DOM.mainAudio.volume      = State.audio.volume;
  DOM.mainAudio.playbackRate = State.audio.speed;

  const savedTime = Store.getAudioTime(id);
  if (savedTime > 0) {
    DOM.mainAudio.addEventListener('loadedmetadata', () => {
      DOM.mainAudio.currentTime = savedTime;
    }, {once:true});
  }

  showLoadingToast('Loading audio…');

  DOM.mainAudio.play()
    .then(() => {
      hideLoadingToast();
      State.audio.isPlaying = true;
      showPlayerBar(item);
      refreshAudioUI();
    })
    .catch(e => {
      hideLoadingToast();
      console.warn('[Shunya] Audio fail:', item.url, e.message);
      showToast('Could not load audio. Check the URL.');
      showPlayerBar(item);
    });
}

function toggleAudioPlayback() {
  if (DOM.mainAudio.paused) {
    DOM.mainAudio.play().catch(()=>{});
    State.audio.isPlaying = true;
  } else {
    DOM.mainAudio.pause();
    State.audio.isPlaying = false;
  }
  refreshAudioUI();
}

function refreshAudioUI() {
  document.querySelectorAll('#audios-list .content-card').forEach(c =>
    c.classList.toggle('is-active', c.dataset.id===State.audio.currentId)
  );
  updatePlayIcon();
}

function updatePlayIcon() {
  const btn = DOM.playPauseBtn;
  if (!btn) return;
  btn.innerHTML = State.audio.isPlaying
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;
}

function bindAudioEvents() {
  DOM.mainAudio.addEventListener('progress', () => {
    if (DOM.mainAudio.buffered.length > 0 && DOM.mainAudio.duration) {
      const pct = Math.round((DOM.mainAudio.buffered.end(DOM.mainAudio.buffered.length-1) / DOM.mainAudio.duration) * 100);
      updateLoadingPct(pct);
    }
  });
  DOM.mainAudio.addEventListener('canplay', () => hideLoadingToast());
  DOM.mainAudio.addEventListener('timeupdate', () => {
    if (State.audio.currentId) Store.saveAudioTime(State.audio.currentId, DOM.mainAudio.currentTime);
    if (DOM.mainAudio.duration) Store.saveAudioDur(State.audio.currentId, DOM.mainAudio.duration);
    updateSeek(DOM.mainAudio.currentTime, DOM.mainAudio.duration);
  });
  DOM.mainAudio.addEventListener('ended', () => {
    State.audio.isPlaying = false; refreshAudioUI();
    if (State.audio.currentId) Store.saveAudioTime(State.audio.currentId, 0);
  });
  DOM.mainAudio.addEventListener('play',  () => { State.audio.isPlaying=true;  refreshAudioUI(); });
  DOM.mainAudio.addEventListener('pause', () => { State.audio.isPlaying=false; refreshAudioUI(); });
  DOM.mainAudio.addEventListener('error', () => { hideLoadingToast(); showToast('Audio error.'); });
  DOM.mainAudio.addEventListener('waiting', () => showLoadingToast('Buffering…'));
}

function updateSeek(current, duration) {
  if (!duration || isNaN(duration)) return;
  const pct = (current/duration)*100;
  if (DOM.seekFill)    DOM.seekFill.style.width   = pct+'%';
  if (DOM.seekThumb)   DOM.seekThumb.style.left   = pct+'%';
  if (DOM.timeElapsed) DOM.timeElapsed.textContent = fmt(current);
  if (DOM.timeRemain)  DOM.timeRemain.textContent  = '-'+fmt(duration-current);
}
function fmt(s) {
  if (!s||isNaN(s)) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

/* ─── PLAYER BAR ────────────────────────────────────────── */
function showPlayerBar(item) {
  DOM.playerBar.classList.add('visible');
  DOM.playerTitle.textContent   = item.title||item.file||'—';
  DOM.playerSub.textContent     = item.speaker||item.author||'';
  DOM.playerThumb.src           = item.thumbnailUrl||'';
  DOM.playerThumb.style.display = item.thumbnailUrl ? 'block' : 'none';
  DOM.dlBtn.href                = item.url||'#';
  DOM.dlBtn.setAttribute('download', item.file||'');
  if (DOM.speedBtn) DOM.speedBtn.textContent = State.audio.speed+'×';
}

function initPlayerBar() {
  DOM.playPauseBtn?.addEventListener('click', () => { if (DOM.mainAudio.src) toggleAudioPlayback(); });
  DOM.prevBtn?.addEventListener('click', () => { const i=State.audio.currentIndex; if(i>0) playAudioById(State.audio.list[i-1].id); });
  DOM.nextBtn?.addEventListener('click', () => { const i=State.audio.currentIndex; if(i<State.audio.list.length-1) playAudioById(State.audio.list[i+1].id); });
  DOM.skipBackBtn?.addEventListener('click', () => { if(DOM.mainAudio.src) DOM.mainAudio.currentTime = Math.max(0, DOM.mainAudio.currentTime-10); });
  DOM.skipFwdBtn?.addEventListener('click',  () => { if(DOM.mainAudio.src) DOM.mainAudio.currentTime = Math.min(DOM.mainAudio.duration||0, DOM.mainAudio.currentTime+10); });

  DOM.seekTrack?.addEventListener('click', e => {
    if (!DOM.mainAudio.duration) return;
    const r = DOM.seekTrack.getBoundingClientRect();
    DOM.mainAudio.currentTime = ((e.clientX-r.left)/r.width)*DOM.mainAudio.duration;
  });

  /* ── Volume: sync desktop slider + popup slider ── */
  const syncVolume = (val) => {
    State.audio.volume = val/100;
    DOM.mainAudio.volume = State.audio.volume;
    if (DOM.volSlider)      DOM.volSlider.value = val;
    if (DOM.volPopupSlider) DOM.volPopupSlider.value = val;
    if (DOM.volPopupValue)  DOM.volPopupValue.textContent = Math.round(val)+'%';
    const volBtn = document.getElementById('btn-vol-mute');
    if (volBtn) volBtn.classList.toggle('muted', val == 0);
  };

  DOM.volSlider?.addEventListener('input', function() { syncVolume(+this.value); });
  if (DOM.volSlider) DOM.volSlider.value = State.audio.volume*100;

  if (DOM.volPopupSlider) {
    DOM.volPopupSlider.value = State.audio.volume*100;
    DOM.volPopupSlider.addEventListener('input', function() { syncVolume(+this.value); });
  }
  if (DOM.volPopupValue) DOM.volPopupValue.textContent = Math.round(State.audio.volume*100)+'%';

  DOM.mainAudio.volume = State.audio.volume;

  /* ── Volume icon → toggle popup (all screens); long-click = mute ── */
  let muteVol = State.audio.volume;
  let pressTimer = null;

  const volIconBtn = document.getElementById('btn-vol-mute');
  if (volIconBtn) {
    volIconBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (DOM.volPopup) {
        const isOpen = DOM.volPopup.classList.contains('open');
        closeAllPopups();
        if (!isOpen) DOM.volPopup.classList.add('open');
      }
    });
  }

  /* Close popup when clicking outside */
  document.addEventListener('click', e => {
    if (!DOM.volPopup?.contains(e.target) && e.target !== volIconBtn) {
      DOM.volPopup?.classList.remove('open');
    }
    if (!DOM.awVolPopup?.contains(e.target) && e.target !== DOM.awVolBtn) {
      DOM.awVolPopup?.classList.remove('open');
    }
  });

  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (['INPUT','TEXTAREA'].includes(tag)) return;
    if (e.code==='Space')   { e.preventDefault(); if(DOM.mainAudio.src) toggleAudioPlayback(); }
    if (e.key==='ArrowRight'&&DOM.mainAudio.src) { e.preventDefault(); DOM.mainAudio.currentTime = Math.min(DOM.mainAudio.duration||0, DOM.mainAudio.currentTime+10); }
    if (e.key==='ArrowLeft' &&DOM.mainAudio.src) { e.preventDefault(); DOM.mainAudio.currentTime = Math.max(0, DOM.mainAudio.currentTime-10); }
  });

  updatePlayIcon();
  initSpeedPanel();
}

function setSpeed(rate) {
  State.audio.speed = rate;
  DOM.mainAudio.playbackRate = rate;
  if (DOM.speedBtn)     DOM.speedBtn.textContent     = rate+'×';
  if (DOM.speedCurrent) DOM.speedCurrent.textContent = rate+'×';
  if (DOM.speedSlider)  DOM.speedSlider.value        = rate;
  document.querySelectorAll('.speed-preset').forEach(b =>
    b.classList.toggle('selected', parseFloat(b.dataset.rate)===rate)
  );
}

function initSpeedPanel() {
  DOM.speedBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const willOpen = !DOM.speedPanel?.classList.contains('open');
    closeAllPopups();
    if (willOpen) {
      DOM.speedPanel?.classList.add('open');
      DOM.speedBtn?.classList.add('active');
    }
  });
  document.addEventListener('click', e => {
    if (!DOM.speedPanel?.contains(e.target) && e.target!==DOM.speedBtn) {
      DOM.speedPanel?.classList.remove('open');
      DOM.speedBtn?.classList.remove('active');
    }
  });
  DOM.speedSlider?.addEventListener('input', () => {
    setSpeed(parseFloat(parseFloat(DOM.speedSlider.value).toFixed(2)));
  });
  document.querySelectorAll('.speed-preset').forEach(btn =>
    btn.addEventListener('click', () => setSpeed(parseFloat(btn.dataset.rate)))
  );
  setSpeed(1);
}

/* ─── VIDEOS ④ nav ─────────────────────────────────────── */
function renderVideos() {
  const C = document.getElementById('videos-grid');
  const videos = State.data.videos;
  if (!videos.length) { C.innerHTML = emptyState('▷','No videos. Add files to <code>shunya_data/videos/</code> and run <code>generate_json.py</code>'); return; }
  C.innerHTML = `<div class="content-grid">${
    videos.map((v,i) => buildCard(v,{badge:'Video',delay:i*.06,showPlay:true})).join('')
  }</div>`;
  lazyLoad(C);
  C.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = State.data.videos.findIndex(v=>v.id===card.dataset.id);
      if (idx >= 0) openVideoModal(idx);
    });
  });
}

function openVideoModal(idx) {
  const item = State.data.videos[idx];
  if (!item) return;
  State.videoIndex = idx;
  DOM.modalVideo.src = item.url;
  DOM.videoModal.classList.add('open');

  const saved = Store.getVideoTime(item.id);
  if (saved > 0) {
    DOM.modalVideo.addEventListener('loadedmetadata', () => {
      DOM.modalVideo.currentTime = saved;
    }, {once:true});
  }

  DOM.modalVideo._item = item;
  DOM.modalVideo._saveInterval = setInterval(() => {
    if (DOM.modalVideo.currentTime > 0) {
      Store.saveVideoTime(item.id, DOM.modalVideo.currentTime);
      Store.saveVideoDur(item.id, DOM.modalVideo.duration||0);
    }
  }, 2000);

  // Update nav buttons
  if (DOM.vidPrev) DOM.vidPrev.disabled = idx <= 0;
  if (DOM.vidNext) DOM.vidNext.disabled = idx >= State.data.videos.length-1;

  showLoadingToast('Loading video…');
  DOM.modalVideo.play()
    .then(() => hideLoadingToast())
    .catch(e => {
      hideLoadingToast();
      console.warn('[Shunya] Video fail:', item.url, e.message);
      showToast('Could not load video.');
    });
}

function closeVideoModal() {
  clearInterval(DOM.modalVideo._saveInterval);
  DOM.videoModal.classList.remove('open');
  DOM.modalVideo.pause();
  DOM.modalVideo.removeAttribute('src');
  hideLoadingToast();
}

function initVideoModal() {
  document.querySelector('.video-modal-close')?.addEventListener('click', closeVideoModal);
  DOM.videoModal?.addEventListener('click', e => { if(e.target===DOM.videoModal) closeVideoModal(); });
  DOM.vidPrev?.addEventListener('click', () => {
    if (State.videoIndex > 0) openVideoModal(State.videoIndex - 1);
  });
  DOM.vidNext?.addEventListener('click', () => {
    if (State.videoIndex < State.data.videos.length - 1) openVideoModal(State.videoIndex + 1);
  });
  DOM.modalVideo?.addEventListener('canplay', hideLoadingToast);
  DOM.modalVideo?.addEventListener('waiting', () => showLoadingToast('Buffering…'));
}

/* ─── ECHO ─────────────────────────────────────────────── */
function renderEcho() {
  const C = document.getElementById('echo-grid');
  const all = State.data.echo.all;
  if (!all.length) { C.innerHTML = emptyState('∿','No writings. Add files to <code>shunya/echo/</code> and run <code>generate_json.py</code>'); return; }
  C.innerHTML = all.map((item,i) => buildCard(item,{badge:item.type==='pdf'?'PDF':'TXT',delay:i*.06,extraClass:`echo-${item.type}`})).join('');
  lazyLoad(C);
  C.querySelectorAll('.content-card').forEach(card =>
    card.addEventListener('click', () => openEchoById(card.dataset.id))
  );
}

function openEchoById(id) {
  const item = State.data.echo.all.find(e=>e.id===id);
  if (!item) return;
  Store.saveLastEcho(id);
  item.type==='pdf' ? openPdfModal(item) : openTxtReader(item);
}

/* ─── TXT READER ────────────────────────────────────────── */
async function openTxtReader(item) {
  document.getElementById('reader-doc-title').textContent = item.title||item.file||'—';
  document.getElementById('reader-eyebrow').textContent   = 'Echo · Writing';
  DOM.readerContent.textContent = '';
  DOM.txtReader.classList.add('open');
  const wrap = document.querySelector('.reader-content-wrap');

  const hasSaved = Store.getTxtScroll(item.id) > 0;
  if (hasSaved) {
    showLoadingToast('<em>Restoring your last position…</em>');
  } else {
    showLoadingToast('Opening…');
  }

  try {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    DOM.readerContent.textContent = await r.text();
    const savedScroll = Store.getTxtScroll(item.id);
    setTimeout(() => {
      if (savedScroll > 0) wrap.scrollTop = savedScroll;
      setTimeout(() => hideLoadingToast(), hasSaved ? 600 : 0);
    }, 80);
  } catch(e) {
    hideLoadingToast();
    console.warn('[Shunya] TXT fail:', item.url, e.message);
    DOM.readerContent.textContent = `${item.title||''}\n\n[Could not load: ${item.url}]\n\nRun from a local web server.`;
  }

  const updateProgress = () => {
    const h = wrap.scrollHeight - wrap.clientHeight;
    Store.saveTxtScroll(item.id, wrap.scrollTop);
    Store.saveTxtHeight(item.id, h);
    if (DOM.readerPFill && h > 0) {
      DOM.readerPFill.style.width = Math.round((wrap.scrollTop/h)*100)+'%';
    }
  };
  wrap.addEventListener('scroll', updateProgress, {passive:true});
}

function initTxtReader() {
  const close = () => DOM.txtReader.classList.remove('open');
  document.getElementById('reader-close')?.addEventListener('click', close);
  document.getElementById('reader-close-top')?.addEventListener('click', close);
}

/* ─── PDF READER ② canvas-based, inspired by scriptPDF.js ─ */
async function openPdfModal(item) {
  State.pdf.currentItem = item;
  document.getElementById('pdf-modal-title').textContent = item.title||item.file||'—';
  document.getElementById('pdf-dl-btn').href             = item.url;
  document.getElementById('pdf-dl-btn').setAttribute('download', item.file||'');

  // Reset
  DOM.pdfContainer.innerHTML = '';
  if (DOM.pdfProgressFill) DOM.pdfProgressFill.style.width = '0%';
  DOM.pdfModal.classList.add('open');

  const hasSaved = Store.getPdfScroll(item.id) > 0;
  // Show loader — with resume message if applicable
  if (hasSaved) {
    showLoadingToast('<em>Restoring your last position…</em>');
  } else {
    showLoadingToast('Opening…');
  }
  if (DOM.pdfLoader) DOM.pdfLoader.classList.add('show');

  try {
    const pdfJsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    if (!pdfJsLib) throw new Error('pdf.js not loaded');

    pdfJsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdfDoc = await pdfJsLib.getDocument(item.url).promise;
    State.pdf.doc = pdfDoc;
    document.getElementById('pdf-total-pages').textContent = pdfDoc.numPages;

    if (DOM.pdfLoader) DOM.pdfLoader.classList.remove('show');

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width  = viewport.width;
      canvas.style.width  = '100%';
      canvas.style.maxWidth = '860px';
      canvas.dataset.page = i;
      await page.render({ canvasContext: ctx, viewport }).promise;
      DOM.pdfContainer.appendChild(canvas);
    }

    // Restore scroll — hide toast ONLY after scroll is in place
    const saved = Store.getPdfScroll(item.id);
    if (saved > 0) {
      DOM.pdfContainer.scrollTop = saved;
      // Brief delay so user sees the restore message land, then fade
      setTimeout(() => hideLoadingToast(), 700);
    } else {
      hideLoadingToast();
    }

  } catch(err) {
    if (DOM.pdfLoader) DOM.pdfLoader.classList.remove('show');
    hideLoadingToast();
    console.warn('[Shunya] PDF fail:', item.url, err.message);
    DOM.pdfContainer.innerHTML = `<div style="color:var(--text-muted);padding:40px;text-align:center;font-family:var(--font-serif)">
      <p>Could not render PDF.</p>
      <p style="margin-top:12px;font-size:.85rem;color:var(--text-dim)">${err.message}</p>
      <p style="margin-top:16px"><a href="${item.url}" target="_blank" style="color:var(--orchid)">Open in new tab instead →</a></p>
    </div>`;
  }

  // Track scroll progress + page number
  DOM.pdfContainer.addEventListener('scroll', () => {
    const h = DOM.pdfContainer.scrollHeight - DOM.pdfContainer.clientHeight;
    const s = DOM.pdfContainer.scrollTop;
    Store.savePdfScroll(item.id, s);
    Store.savePdfHeight(item.id, h);
    if (DOM.pdfProgressFill && h > 0)
      DOM.pdfProgressFill.style.width = Math.round((s/h)*100)+'%';
    // Update page number display
    if (State.pdf.doc) {
      const canvases = DOM.pdfContainer.querySelectorAll('canvas[data-page]');
      canvases.forEach(cv => {
        const rect = cv.getBoundingClientRect();
        const containerRect = DOM.pdfContainer.getBoundingClientRect();
        if (rect.top <= containerRect.top + containerRect.height * 0.5 &&
            rect.bottom >= containerRect.top) {
          const pi = document.getElementById('pdf-page-num');
          if (pi) pi.value = cv.dataset.page;
        }
      });
    }
  }, {passive:true});
}

function closePdfModal() {
  DOM.pdfModal.classList.remove('open');
}

function initPdfModal() {
  document.getElementById('pdf-close-btn')?.addEventListener('click', closePdfModal);
  DOM.pdfModal?.addEventListener('click', e => { if(e.target===DOM.pdfModal) closePdfModal(); });

  // Page number jump
  const pi = document.getElementById('pdf-page-num');
  const goToPage = () => {
    const page = parseInt(pi?.value)||1;
    const cv = DOM.pdfContainer?.querySelector(`canvas[data-page="${page}"]`);
    if (cv) cv.scrollIntoView({behavior:'smooth'});
  };
  pi?.addEventListener('change', goToPage);
  pi?.addEventListener('keydown', e => { if(e.key==='Enter') goToPage(); });
  document.getElementById('pdf-prev-page')?.addEventListener('click', () => {
    if (pi) { pi.value = Math.max(1,(parseInt(pi.value)||1)-1); goToPage(); }
  });
  document.getElementById('pdf-next-page')?.addEventListener('click', () => {
    if (pi && State.pdf.doc) { pi.value = Math.min(State.pdf.doc.numPages,(parseInt(pi.value)||1)+1); goToPage(); }
  });
}

/* ─── IMAGES ③ lightbox with navigation ──────────────── */
function renderImages() {
  const C = document.getElementById('images-grid');
  const imgs = State.data.images;
  if (!imgs.length) { C.innerHTML = emptyState('◎','No images. Add files to <code>shunya/images/</code> and run <code>generate_json.py</code>'); return; }
  State.lightboxImages = imgs;
  C.innerHTML = imgs.map((img,i) => `
    <div class="image-card animate-in" data-id="${img.id}" data-idx="${i}" style="animation-delay:${i*.04}s">
      <img data-src="${img.url}" alt="" loading="lazy">
      <div class="image-card-overlay">
        <span class="image-caption">${img.file||''}</span>
        <a href="${img.url}" download="${img.file||''}" class="image-download-btn" onclick="event.stopPropagation()">↓</a>
      </div>
    </div>`).join('');
  lazyLoad(C);
  C.querySelectorAll('.image-card').forEach(card =>
    card.addEventListener('click', e => {
      if (e.target.classList.contains('image-download-btn')) return;
      openImageById(card.dataset.id);
    })
  );
}

function openImageById(id, fromHome = false) {
  const imgs = State.lightboxImages.length ? State.lightboxImages : State.data.images;
  const idx  = imgs.findIndex(i=>i.id===id);
  if (idx < 0 && id) {
    const img = State.data.images.find(i=>i.id===id);
    if (!img) return;
    Store.addRecentImage(id);
    DOM.lightboxImg.src         = img.url;
    DOM.lightboxCap.textContent = img.file||'';
    DOM.lightboxDl.href         = img.url;
    DOM.lightbox.classList.add('open');
    return;
  }
  State.lightboxIndex = idx;
  _showLightboxFrame(imgs, idx);
  DOM.lightbox.classList.add('open');
}

function _showLightboxFrame(imgs, idx) {
  const img = imgs[idx];
  if (!img) return;
  Store.addRecentImage(img.id);
  DOM.lightboxImg.src         = img.url;
  DOM.lightboxCap.textContent = img.file||'';
  DOM.lightboxDl.href         = img.url;
  if (DOM.lbCounter) DOM.lbCounter.textContent = `${idx+1} / ${imgs.length}`;
  if (DOM.lbPrev)    DOM.lbPrev.disabled  = idx <= 0;
  if (DOM.lbNext)    DOM.lbNext.disabled  = idx >= imgs.length-1;
}

function initLightbox() {
  let lbZoom = 1;
  const ZOOM_STEP = 0.5, ZOOM_MIN = 0.5, ZOOM_MAX = 4;

  const applyZoom = () => {
    if (DOM.lightboxImg) {
      DOM.lightboxImg.style.transform = `scale(${lbZoom})`;
      DOM.lightboxImg.style.cursor = lbZoom > 1 ? 'zoom-out' : 'default';
    }
  };
  const resetZoom = () => { lbZoom = 1; applyZoom(); };

  document.getElementById('lb-zoom-in')?.addEventListener('click', e => {
    e.stopPropagation(); lbZoom = Math.min(ZOOM_MAX, lbZoom + ZOOM_STEP); applyZoom();
  });
  document.getElementById('lb-zoom-out')?.addEventListener('click', e => {
    e.stopPropagation(); lbZoom = Math.max(ZOOM_MIN, lbZoom - ZOOM_STEP); applyZoom();
  });
  document.getElementById('lb-zoom-reset')?.addEventListener('click', e => {
    e.stopPropagation(); resetZoom();
  });

  document.getElementById('lightbox-close')?.addEventListener('click', () => {
    DOM.lightbox.classList.remove('open'); resetZoom();
  });
  DOM.lightbox?.addEventListener('click', e => {
    if(e.target===DOM.lightbox) { DOM.lightbox.classList.remove('open'); resetZoom(); }
  });
  DOM.lbPrev?.addEventListener('click', e => {
    e.stopPropagation(); resetZoom();
    const imgs = State.lightboxImages.length ? State.lightboxImages : State.data.images;
    if (State.lightboxIndex > 0) { State.lightboxIndex--; _showLightboxFrame(imgs, State.lightboxIndex); }
  });
  DOM.lbNext?.addEventListener('click', e => {
    e.stopPropagation(); resetZoom();
    const imgs = State.lightboxImages.length ? State.lightboxImages : State.data.images;
    if (State.lightboxIndex < imgs.length-1) { State.lightboxIndex++; _showLightboxFrame(imgs, State.lightboxIndex); }
  });
  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (!DOM.lightbox?.classList.contains('open')) return;
    const imgs = State.lightboxImages.length ? State.lightboxImages : State.data.images;
    if (e.key==='ArrowRight' && State.lightboxIndex < imgs.length-1) { resetZoom(); State.lightboxIndex++; _showLightboxFrame(imgs, State.lightboxIndex); }
    if (e.key==='ArrowLeft'  && State.lightboxIndex > 0) { resetZoom(); State.lightboxIndex--; _showLightboxFrame(imgs, State.lightboxIndex); }
    if (e.key==='+' || e.key==='=') { lbZoom = Math.min(ZOOM_MAX, lbZoom+ZOOM_STEP); applyZoom(); }
    if (e.key==='-') { lbZoom = Math.max(ZOOM_MIN, lbZoom-ZOOM_STEP); applyZoom(); }
    if (e.key==='0') { resetZoom(); }
  });
  // Mouse wheel zoom
  DOM.lightbox?.addEventListener('wheel', e => {
    if (!DOM.lightbox?.classList.contains('open')) return;
    e.preventDefault();
    lbZoom = e.deltaY < 0
      ? Math.min(ZOOM_MAX, lbZoom + 0.25)
      : Math.max(ZOOM_MIN, lbZoom - 0.25);
    applyZoom();
  }, {passive:false});
}

/* ─── BOOKS ─────────────────────────────────────────────── */
function renderBooks() {
  const C = document.getElementById('books-grid');
  const books = State.data.books;
  if (!books.length) { C.innerHTML = emptyState('⊟','No books. Add PDFs to <code>shunya/books/pdfs/</code> and run <code>generate_json.py</code>'); return; }
  C.innerHTML = `<div class="content-grid">${books.map((b,i) => buildCard(b,{badge:'PDF',delay:i*.06})).join('')}</div>`;
  lazyLoad(C);
  C.querySelectorAll('.content-card').forEach(card => {
    const item = books.find(b=>b.id===card.dataset.id);
    if (!item) return;
    const act = document.createElement('div');
    act.className = 'card-actions';
    act.innerHTML = `<button class="btn-read">Read</button><a href="${item.url}" download="${item.file||''}" class="btn-dl">↓ Save</a>`;
    card.appendChild(act);
    card.addEventListener('click', e => { if(e.target.classList.contains('btn-dl')) return; openPdfModal(item); });
    act.querySelector('.btn-read').addEventListener('click', e => { e.stopPropagation(); openPdfModal(item); });
  });
}

/* ─── POPUP HELPERS ─────────────────────────────────────── */
function closeAllPopups() {
  DOM.volPopup?.classList.remove('open');
  DOM.awVolPopup?.classList.remove('open');
  DOM.speedPanel?.classList.remove('open');
  DOM.speedBtn?.classList.remove('active');
}

/* ─── AMBIENT ① loading toast ⑤⑥ ─────────────────────── */
function renderAmbient() {
  const grid  = document.getElementById('ambient-grid');
  const items = State.data.ambient;
  if (!items.length) { grid.innerHTML = emptyState('〰','No ambient sounds. Add files to <code>shunya_data/ambient/</code> and run <code>generate_json.py</code>'); return; }

  const active = items.find(a=>a.id===State.ambient.currentId);
  grid.innerHTML = `
    ${active ? `
      <div class="ambient-now-playing animate-in">
        ${active.thumbnailUrl
          ? `<div class="ambient-np-thumb" style="background-image:url('${active.thumbnailUrl}')"></div>`
          : `<div class="ambient-np-thumb ambient-np-thumb--empty">〰</div>`}
        <div class="ambient-np-info">
          <div class="ambient-np-label">Now playing</div>
          <div class="ambient-np-title">${active.title}</div>
          <!-- Full seek bar synced with widget -->
          <div class="ambient-np-seek-row">
            <span class="ambient-np-time" id="anp-elapsed">0:00</span>
            <div class="ambient-np-seek-track" id="anp-seek-track">
              <div class="ambient-np-seek-fill" id="anp-seek-fill"></div>
            </div>
            <span class="ambient-np-time" id="anp-remain">0:00</span>
          </div>
        </div>
        <div class="ambient-np-controls">
          <button class="ambient-vol-icon-btn" id="ambient-np-vol-btn" title="Volume" aria-label="Volume">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
          <button class="ambient-play-pause-btn" id="anp-play-btn" title="${State.ambient.isPlaying?'Pause':'Play'}">
            ${State.ambient.isPlaying
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
              : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`}
          </button>
          <button class="ambient-stop-btn">■ Stop</button>
        </div>
      </div>` : ''}
    <div class="ambient-cards-grid">
      ${items.map((a,i) => {
        const on = State.ambient.currentId===a.id && State.ambient.isPlaying;
        return `
          <div class="ambient-card animate-in ${on?'playing':''}" data-id="${a.id}" style="animation-delay:${i*.06}s">
            ${a.thumbnailUrl
              ? `<div class="ambient-thumb"><img data-src="${a.thumbnailUrl}" alt="${a.title}" loading="lazy"><div class="ambient-play-indicator"><div class="card-play-circle"><svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,.95)"><polygon points="5,3 19,12 5,21"/></svg></div></div></div>`
              : `<div class="ambient-thumb ambient-thumb--empty">〰</div>`}
            <div class="ambient-card-info">
              <div class="ambient-title">${a.title}</div>
              <div class="ambient-status">${on?'● Playing':'○ Play'}</div>
            </div>
          </div>`;
      }).join('')}
    </div>`;

  lazyLoad(grid);
  grid.querySelectorAll('.ambient-card').forEach(c => c.addEventListener('click', () => toggleAmbient(c.dataset.id)));
  grid.querySelector('.ambient-stop-btn')?.addEventListener('click', () => { stopAmbient(); State.rendered.delete('ambient'); renderAmbient(); });

  // Full player play/pause in ambient section — synced with widget
  const anpPlay = document.getElementById('anp-play-btn');
  anpPlay?.addEventListener('click', () => {
    if (!State.ambient.currentId) return;
    if (State.ambient.isPlaying) {
      DOM.ambientAudio.pause(); State.ambient.isPlaying = false;
    } else {
      DOM.ambientAudio.play().catch(()=>{}); State.ambient.isPlaying = true;
    }
    updateWidgetPlayIcon();
    State.rendered.delete('ambient'); renderAmbient();
  });

  // Seek click in ambient section
  const anpSeek = document.getElementById('anp-seek-track');
  anpSeek?.addEventListener('click', e => {
    if (!DOM.ambientAudio.duration) return;
    const r = anpSeek.getBoundingClientRect();
    DOM.ambientAudio.currentTime = ((e.clientX-r.left)/r.width)*DOM.ambientAudio.duration;
  });

  // Sync current seek position immediately on render
  syncAmbientSectionSeek();

  /* Volume icon in now-playing → open aw-vol-popup */
  grid.querySelector('#ambient-np-vol-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    if (!DOM.awVolPopup) return;
    const isOpen = DOM.awVolPopup.classList.contains('open');
    closeAllPopups();
    if (!isOpen) {
      const btn = e.currentTarget;
      const r = btn.getBoundingClientRect();
      DOM.awVolPopup.style.left   = r.left + 'px';
      DOM.awVolPopup.style.bottom = (window.innerHeight - r.top + 8) + 'px';
      DOM.awVolPopup.style.top    = 'auto';
      DOM.awVolPopup.style.right  = 'auto';
      DOM.awVolPopup.classList.add('open');
    }
  });
}

/* Sync the ambient-section seek bar (updated by timeupdate) */
function syncAmbientSectionSeek() {
  const dur = DOM.ambientAudio?.duration;
  const cur = DOM.ambientAudio?.currentTime;
  if (!dur || isNaN(dur)) return;
  const fill    = document.getElementById('anp-seek-fill');
  const elapsed = document.getElementById('anp-elapsed');
  const remain  = document.getElementById('anp-remain');
  if (fill)    fill.style.width    = ((cur/dur)*100)+'%';
  if (elapsed) elapsed.textContent = fmt(cur);
  if (remain)  remain.textContent  = '-'+fmt(dur-cur);
}

function toggleAmbient(id) {
  const item = State.data.ambient.find(a=>a.id===id);
  if (!item) return;
  if (State.ambient.currentId===id && State.ambient.isPlaying) { stopAmbient(); State.rendered.delete('ambient'); renderAmbient(); return; }
  if (State.isMobile && State.audio.isPlaying) { DOM.mainAudio.pause(); State.audio.isPlaying=false; refreshAudioUI(); }
  stopAmbient();

  DOM.ambientAudio.src    = item.url;
  DOM.ambientAudio.loop   = false;
  DOM.ambientAudio.volume = State.ambient.volume;

  showLoadingToast('Loading ambient…');

  DOM.ambientAudio.play()
    .then(() => {
      hideLoadingToast();
      State.ambient.currentId = id;
      State.ambient.isPlaying = true;
      updateAmbientMiniSidebar(item);
      showAmbientWidget(item);
      State.rendered.delete('ambient');
      renderAmbient();
    })
    .catch(e => {
      hideLoadingToast();
      console.warn('[Shunya] Ambient fail:', item.url, e.message);
      showToast('Could not load ambient sound.');
    });
}

function stopAmbient() {
  if (!DOM.ambientAudio.paused) DOM.ambientAudio.pause();
  DOM.ambientAudio.removeAttribute('src');
  State.ambient.currentId = null;
  State.ambient.isPlaying = false;
  updateAmbientMiniSidebar(null);
  hideAmbientWidget();
}

function updateAmbientMiniSidebar(item) {
  const mini = document.querySelector('.ambient-mini');
  const el   = mini?.querySelector('.ambient-mini-title span:first-child');
  if (!mini||!el) return;
  if (item) { mini.classList.add('active'); el.textContent = `〰 ${item.title}`; }
  else       { mini.classList.remove('active'); el.textContent = 'No ambient'; }
}

/* ─── AMBIENT WIDGET ⑤⑥ ───────────────────────────────── */
function showAmbientWidget(item) {
  if (!DOM.ambWidget) return;
  DOM.ambWidget.classList.add('visible');
  if (DOM.awTitle) DOM.awTitle.textContent = item.title||'—';

  // Update thumbnail
  const thumbWrap = document.getElementById('aw-thumb-wrap');
  if (thumbWrap) {
    if (item.thumbnailUrl) {
      thumbWrap.innerHTML = `<img src="${item.thumbnailUrl}" alt="${item.title||''}">`;
    } else {
      thumbWrap.innerHTML = '<div class="aw-img-empty">〰</div>';
    }
  }

  // Update download link
  const awDl = document.getElementById('aw-download');
  if (awDl) { awDl.href = item.url||'#'; awDl.setAttribute('download', item.file||''); }

  // Update nav buttons
  const items = State.data.ambient;
  const idx   = items.findIndex(a=>a.id===item.id);
  if (DOM.awPrevBtn) DOM.awPrevBtn.disabled = idx <= 0;
  if (DOM.awNextBtn) DOM.awNextBtn.disabled = idx >= items.length-1;

  // Reset seek display
  const elapsed = document.getElementById('aw-time-elapsed');
  const remain  = document.getElementById('aw-time-remain');
  const fill    = document.getElementById('aw-seek-fill');
  if (elapsed) elapsed.textContent = '0:00';
  if (remain)  remain.textContent  = '0:00';
  if (fill)    fill.style.width    = '0%';

  updateWidgetPlayIcon();
}

function hideAmbientWidget() {
  // ⑤ Only hides the UI — does NOT stop audio
  DOM.ambWidget?.classList.remove('visible');
}

function updateWidgetPlayIcon() {
  if (!DOM.awPlayBtn) return;
  DOM.awPlayBtn.innerHTML = State.ambient.isPlaying
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>`;
}

function initAmbientControls() {
  document.querySelector('.ambient-mini-stop')?.addEventListener('click', () => {
    stopAmbient(); State.rendered.delete('ambient'); renderAmbient();
  });
  DOM.ambientAudio?.addEventListener('canplay', hideLoadingToast);
  DOM.ambientAudio?.addEventListener('error', () => { hideLoadingToast(); showToast('Ambient error.'); });

  // Play once → stop (no loop)
  DOM.ambientAudio?.addEventListener('ended', () => {
    State.ambient.isPlaying = false;
    updateWidgetPlayIcon();
    const fill = document.getElementById('aw-seek-fill');
    if (fill) fill.style.width = '0%';
    State.rendered.delete('ambient'); renderAmbient();
  });

  // Seek slider: timeupdate → update fill + time display (widget AND section)
  DOM.ambientAudio?.addEventListener('timeupdate', () => {
    const dur = DOM.ambientAudio.duration;
    const cur = DOM.ambientAudio.currentTime;
    if (!dur || isNaN(dur)) return;
    const fill    = document.getElementById('aw-seek-fill');
    const elapsed = document.getElementById('aw-time-elapsed');
    const remain  = document.getElementById('aw-time-remain');
    if (fill)    fill.style.width    = ((cur/dur)*100)+'%';
    if (elapsed) elapsed.textContent = fmt(cur);
    if (remain)  remain.textContent  = '-'+fmt(dur-cur);
    // Also sync the ambient section player
    syncAmbientSectionSeek();
  });

  // Seek track click
  const awSeekTrack = document.getElementById('aw-seek-track');
  awSeekTrack?.addEventListener('click', e => {
    if (!DOM.ambientAudio.duration) return;
    const r = awSeekTrack.getBoundingClientRect();
    DOM.ambientAudio.currentTime = ((e.clientX-r.left)/r.width)*DOM.ambientAudio.duration;
  });
}

function initAmbientWidget() {
  if (!DOM.ambWidget) return;

  DOM.awPlayBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (!State.ambient.currentId) return;
    if (State.ambient.isPlaying) {
      DOM.ambientAudio.pause(); State.ambient.isPlaying=false;
    } else {
      DOM.ambientAudio.play().catch(()=>{}); State.ambient.isPlaying=true;
    }
    updateWidgetPlayIcon();
    State.rendered.delete('ambient'); renderAmbient();
  });

  /* ── Ambient volume popup ── */
  const syncAmbVol = (val) => {
    State.ambient.volume = val/100;
    DOM.ambientAudio.volume = State.ambient.volume;
    if (DOM.awVolume) DOM.awVolume.value = val;
    if (DOM.awVolPopupSlider) DOM.awVolPopupSlider.value = val;
    if (DOM.awVolPopupValue)  DOM.awVolPopupValue.textContent = Math.round(val)+'%';
  };

  if (DOM.awVolume) DOM.awVolume.value = State.ambient.volume*100;
  if (DOM.awVolPopupSlider) {
    DOM.awVolPopupSlider.value = State.ambient.volume*100;
    DOM.awVolPopupSlider.addEventListener('input', function() { syncAmbVol(+this.value); });
  }
  if (DOM.awVolPopupValue) DOM.awVolPopupValue.textContent = Math.round(State.ambient.volume*100)+'%';

  /* Volume icon → toggle popup, positioned near widget */
  DOM.awVolBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (!DOM.awVolPopup) return;
    const isOpen = DOM.awVolPopup.classList.contains('open');
    closeAllPopups();
    if (!isOpen) {
      const wr = DOM.ambWidget.getBoundingClientRect();
      DOM.awVolPopup.style.bottom = (window.innerHeight - wr.top + 8) + 'px';
      DOM.awVolPopup.style.right  = (window.innerWidth - wr.right) + 'px';
      DOM.awVolPopup.style.top    = 'auto';
      DOM.awVolPopup.style.left   = 'auto';
      DOM.awVolPopup.classList.add('open');
    }
  });

  // Prev / Next
  DOM.awPrevBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const items = State.data.ambient;
    const idx = items.findIndex(a=>a.id===State.ambient.currentId);
    if (idx > 0) toggleAmbient(items[idx-1].id);
  });
  DOM.awNextBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const items = State.data.ambient;
    const idx = items.findIndex(a=>a.id===State.ambient.currentId);
    if (idx < items.length-1) toggleAmbient(items[idx+1].id);
  });

  // Stop button — this DOES stop audio
  document.getElementById('aw-stop')?.addEventListener('click', e => {
    e.stopPropagation(); closeAllPopups(); stopAmbient(); State.rendered.delete('ambient'); renderAmbient();
  });

  // Close = hide only, not stop
  document.getElementById('aw-close')?.addEventListener('click', e => {
    e.stopPropagation(); closeAllPopups(); hideAmbientWidget();
  });

  /* ── Draggable ──
     Desktop: drag from anywhere in .aw-header
     Mobile:  drag ONLY via .aw-drag-dots handle
  */
  let dragging=false, ox=0, oy=0;
  const mouseHandle = DOM.ambWidget.querySelector('.aw-header') || DOM.ambWidget;
  const touchHandle = DOM.ambWidget.querySelector('.aw-drag-dots') || DOM.ambWidget;

  mouseHandle.addEventListener('mousedown', e => {
    if (e.target.closest('button,input,a')) return;
    dragging=true; DOM.ambWidget.classList.add('grabbing');
    const r = DOM.ambWidget.getBoundingClientRect();
    ox=e.clientX-r.left; oy=e.clientY-r.top; e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let x=Math.max(0,Math.min(innerWidth-DOM.ambWidget.offsetWidth, e.clientX-ox));
    let y=Math.max(0,Math.min(innerHeight-DOM.ambWidget.offsetHeight, e.clientY-oy));
    DOM.ambWidget.style.left=x+'px'; DOM.ambWidget.style.top=y+'px';
    DOM.ambWidget.style.right='auto'; DOM.ambWidget.style.bottom='auto';
  });
  document.addEventListener('mouseup', () => { dragging=false; DOM.ambWidget.classList.remove('grabbing'); });

  // Mobile: touch drag ONLY from .aw-drag-dots
  touchHandle.addEventListener('touchstart', e => {
    const t=e.touches[0]; dragging=true;
    const r=DOM.ambWidget.getBoundingClientRect();
    ox=t.clientX-r.left; oy=t.clientY-r.top;
  }, {passive:true});
  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    const t=e.touches[0];
    let x=Math.max(0,Math.min(innerWidth-DOM.ambWidget.offsetWidth, t.clientX-ox));
    let y=Math.max(0,Math.min(innerHeight-DOM.ambWidget.offsetHeight, t.clientY-oy));
    DOM.ambWidget.style.left=x+'px'; DOM.ambWidget.style.top=y+'px';
    DOM.ambWidget.style.right='auto'; DOM.ambWidget.style.bottom='auto';
  }, {passive:true});
  document.addEventListener('touchend', () => { dragging=false; });
}

/* ─── RANDOM WISDOM ⑧ ─────────────────────────────────── */
function randomWisdom() {
  const current = State.currentSection;

  let pool = [];

  if (current === 'audios') {
    pool = State.data.audios.map(a => ({type:'audio', id:a.id}));
  } else if (current === 'ambient') {
    pool = State.data.ambient.map(a => ({type:'ambient', id:a.id}));
  } else if (current === 'videos') {
    pool = State.data.videos.map(v => ({type:'video', id:v.id}));
  } else if (current === 'echo') {
    pool = State.data.echo.all.map(e => ({type:'echo', id:e.id}));
  } else if (current === 'books') {
    pool = State.data.books.map(b => ({type:'book', id:b.id}));
  } else if (current === 'images') {
    pool = State.data.images.map(i => ({type:'image', id:i.id}));
  } else {
    // Home (or any other) — pick from everything
    pool = [
      ...State.data.audios.map(a  => ({type:'audio',   id:a.id})),
      ...State.data.ambient.map(a => ({type:'ambient',  id:a.id})),
      ...State.data.echo.all.map(e => ({type:'echo',   id:e.id})),
      ...State.data.images.map(i  => ({type:'image',   id:i.id})),
      ...State.data.books.map(b   => ({type:'book',    id:b.id})),
      ...State.data.videos.map(v  => ({type:'video',   id:v.id})),
    ];
  }

  if (!pool.length) return showToast('Nothing in the library yet.');

  const pick = pool[Math.floor(Math.random() * pool.length)];
  showToast('Opening something magical…');

  setTimeout(() => {
    if (pick.type === 'audio') {
      if (current === 'home') { playAudioById(pick.id); }
      else { navigateTo('audios'); setTimeout(() => playAudioById(pick.id), 400); }
    }
    else if (pick.type === 'ambient') {
      toggleAmbient(pick.id);
      if (current !== 'ambient') navigateTo('ambient');
    }
    else if (pick.type === 'echo') {
      if (current === 'home') { openEchoById(pick.id); }
      else { navigateTo('echo'); setTimeout(() => openEchoById(pick.id), 400); }
    }
    else if (pick.type === 'image') {
      openImageById(pick.id, true);
    }
    else if (pick.type === 'book') {
      const item = State.data.books.find(b => b.id === pick.id);
      if (!item) return;
      if (current === 'home' || current === 'books') { openPdfModal(item); }
      else { navigateTo('books'); setTimeout(() => openPdfModal(item), 400); }
    }
    else if (pick.type === 'video') {
      const idx = State.data.videos.findIndex(v => v.id === pick.id);
      if (idx >= 0) openVideoModal(idx);
    }
  }, 400);
}

/* ─── ABOUT MODAL ──────────────────────────────────────── */
function initAboutModal() {
  document.querySelector('.sidebar-logo')?.addEventListener('click', () =>
    DOM.aboutModal?.classList.add('open')
  );
  document.getElementById('about-close')?.addEventListener('click', () =>
    DOM.aboutModal?.classList.remove('open')
  );
  DOM.aboutModal?.addEventListener('click', e => {
    if (e.target===DOM.aboutModal) DOM.aboutModal.classList.remove('open');
  });
}

/* ─── MOBILE NAV ⑩ overlay close ──────────────────────── */
function openSidebar() {
  DOM.sidebar.classList.add('open');
  if (DOM.sidebarOverlay) {
    DOM.sidebarOverlay.classList.add('visible');
    requestAnimationFrame(() => requestAnimationFrame(() =>
      DOM.sidebarOverlay.classList.add('faded-in')
    ));
  }
}

function closeSidebar() {
  DOM.sidebar.classList.remove('open');
  if (DOM.sidebarOverlay) {
    DOM.sidebarOverlay.classList.remove('faded-in');
    setTimeout(() => DOM.sidebarOverlay.classList.remove('visible'), 350);
  }
}

function initMobileNav() {
  document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
    DOM.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  DOM.sidebarOverlay?.addEventListener('click', closeSidebar);
  window.addEventListener('resize', () => { State.isMobile = innerWidth < 900; });
}

/* ─── CONTENT PROTECTION ───────────────────────────────── */
function initContentProtection() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => { if(e.target.tagName==='IMG') e.preventDefault(); });
}

/* ─── ESC KEY ──────────────────────────────────────────── */
function initEscKey() {
  document.addEventListener('keydown', e => {
    if (e.key!=='Escape') return;
    DOM.txtReader?.classList.remove('open');
    DOM.lightbox?.classList.remove('open');
    closePdfModal();
    DOM.aboutModal?.classList.remove('open');
    closeVideoModal();
    closeSidebar();
    closeAllPopups();
  });
}

/* ─── SITE META ────────────────────────────────────────── */
function initSiteMeta() {
  const g    = State.data.global;
  const name = g?.site?.name    || 'ShunyaSpace';
  const sub  = g?.site?.subtitle || 'शून्य — the void that holds everything';
  const ne = document.getElementById('logo-name');
  const se = document.getElementById('logo-sub');
  if (ne) ne.textContent = name;
  if (se) se.textContent = sub;
  const mtn = document.getElementById('mobile-topbar-name');
  if (mtn) mtn.textContent = name;
  document.title = name;
}

/* ─── TOAST ─────────────────────────────────────────────── */
function showToast(msg, ms=3000) {
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

/* ─── STARS ─────────────────────────────────────────────── */
function initStars() {
  const cv = document.getElementById('stars-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const resize = () => { cv.width=innerWidth; cv.height=innerHeight; };
  resize(); window.addEventListener('resize', resize);

  const stars = Array.from({length:140}, () => ({
    x:Math.random(), y:Math.random(),
    r:Math.random()*.9+.15, o:Math.random()*.45+.08,
    s:Math.random()*.0003+.0001, p:Math.random()*Math.PI*2,
    drift:(Math.random()-.5)*.00006, dx:0, dy:0,
  }));

  let t=0;
  (function draw() {
    ctx.clearRect(0,0,cv.width,cv.height);
    t+=.008;
    stars.forEach(s => {
      s.dx += s.drift; s.dy += s.drift*.4;
      const x = (s.x+s.dx)%1; const y = (s.y+s.dy)%1;
      const op = s.o*(0.55+0.45*Math.sin(t*s.s*120+s.p));
      ctx.beginPath();
      ctx.arc((x<0?x+1:x)*cv.width, (y<0?y+1:y)*cv.height, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(192,132,252,${op})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
}

/* ─── FLOATING ORBS — right-side breathing presence + cursor ─ */
function initOrbs() {
  const cv = document.getElementById('orbs-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const resize = () => { cv.width=innerWidth; cv.height=innerHeight; };
  resize(); window.addEventListener('resize', resize);

  // Cursor position, normalized 0-1 (starts at center)
  let mouseX = 0.5, mouseY = 0.5;
  let targetX = 0.5, targetY = 0.5;
  document.addEventListener('mousemove', e => {
    targetX = e.clientX / innerWidth;
    targetY = e.clientY / innerHeight;
  }, {passive: true});

  // 4 very large, very faint orbs that drift slowly
  const orbs = [
    { cx:.75, cy:.25, r:.22, color:'124,58,237',   speed:.00008, phase:0,   pull:0.025 },
    { cx:.85, cy:.60, r:.18, color:'192,132,252',  speed:.00006, phase:2.1, pull:0.018 },
    { cx:.65, cy:.75, r:.15, color:'244,114,182',  speed:.00007, phase:4.4, pull:0.020 },
    { cx:.90, cy:.40, r:.12, color:'129,140,248',  speed:.00009, phase:1.3, pull:0.015 },
  ];

  let t = 0;
  (function draw() {
    ctx.clearRect(0,0,cv.width,cv.height);
    t += 1;

    // Smoothly interpolate mouse position (very slow follow)
    mouseX += (targetX - mouseX) * 0.04;
    mouseY += (targetY - mouseY) * 0.04;

    orbs.forEach(orb => {
      const driftX = Math.sin(t * orb.speed * 73 + orb.phase) * 0.04;
      const driftY = Math.cos(t * orb.speed * 59 + orb.phase * 1.3) * 0.03;
      // Subtle pull toward cursor position (each orb with different weight)
      const cursorPullX = (mouseX - 0.5) * orb.pull;
      const cursorPullY = (mouseY - 0.5) * orb.pull;
      const cx = (orb.cx + driftX + cursorPullX) * cv.width;
      const cy = (orb.cy + driftY + cursorPullY) * cv.height;
      const radius = orb.r * Math.min(cv.width, cv.height);
      const opacity = 0.03 + 0.05 * (0.5 + 0.5 * Math.sin(t * orb.speed * 120 + orb.phase));

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0,   `rgba(${orb.color},${(opacity * 2).toFixed(3)})`);
      grad.addColorStop(0.5, `rgba(${orb.color},${opacity.toFixed(3)})`);
      grad.addColorStop(1,   `rgba(${orb.color},0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
}

/* ─── BOOT ──────────────────────────────────────────────── */
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
  initAmbientWidget();
  initAboutModal();
  initEscKey();
  initStars();
  initOrbs();
  initContentProtection();

  document.getElementById('btn-random')?.addEventListener('click', randomWisdom);

  navigateTo('home');
  if (DOM.app) DOM.app.style.opacity = '1';
}

if (document.readyState==='loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
