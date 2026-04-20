/* ═══════════════════════════════════════════════════════════
   ShunyaSpace — script.js  (v5)

   NEW IN v5:
   ① SoundAura-inspired audio player with SVG icons + skip ±10s
   ② Draggable floating ambient mini-widget
   ③ Video 16:9 aspect ratio enforced
   ④ PDF in-page modal with scroll-progress saving
   ⑤ TXT reader with scroll-progress saving + % complete
   ⑥ Home "Continue where left off" with % progress bars
   ⑦ Tiro Devanagari Hindi font for शून्य (via CSS)
   ⑧ Logo click → About modal
   ⑨ URL encoding for filenames with spaces
   ⑩ Audio resume via loadedmetadata event
═══════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════
   FALLBACK NAV
═══════════════════════════════════════════════════════════ */
const FALLBACK_NAV = [
  { id:'home',    label:'Pravaah', icon:'◌',  hint:'The flow' },
  { id:'audios',  label:'Shravan',  icon:'◑',  hint:'What is heard' },
  { id:'ambient', label:'Ambient',  icon:'〰', hint:'Surrounding sound' },
  { id:'videos',  label:'Videos',   icon:'▷',  hint:'Moving light' },
  { id:'echo',    label:'Echo',     icon:'∿',  hint:'Words that remain' },
  { id:'images',  label:'Drishya',  icon:'◎',  hint:'What is seen' },
  { id:'books',   label:'Books',    icon:'⊟',  hint:'Deeper waters' },
];

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
const State = {
  data: {
    global:null, home:null,
    audios:[], ambient:[], videos:[], books:[], images:[],
    echo: { pdfs:[], txts:[], all:[] },
  },
  currentSection: '',
  isMobile: innerWidth < 900,
  rendered: new Set(),

  audio: {
    currentId:null, isPlaying:false,
    list:[], currentIndex:-1,
    volume:0.85,
  },
  ambient: {
    currentId:null, isPlaying:false,
    volume:0.3,
  },
  pdf: { currentItem:null },
};

/* ═══════════════════════════════════════════════════════════
   DOM CACHE
═══════════════════════════════════════════════════════════ */
const DOM = {};

function cacheDom() {
  DOM.app          = document.getElementById('app');
  DOM.mainAudio    = document.getElementById('main-audio');
  DOM.ambientAudio = document.getElementById('ambient-audio');

  // Player bar
  DOM.playerBar    = document.getElementById('bottom-player');
  DOM.playerThumb  = document.getElementById('player-thumb');
  DOM.playerTitle  = document.getElementById('player-title');
  DOM.playerSub    = document.getElementById('player-speaker');
  DOM.playPauseBtn = document.getElementById('btn-play-pause');
  DOM.prevBtn      = document.getElementById('btn-prev');
  DOM.nextBtn      = document.getElementById('btn-next');
  DOM.skipBackBtn  = document.getElementById('btn-skip-back');
  DOM.skipFwdBtn   = document.getElementById('btn-skip-fwd');
  DOM.seekTrack    = document.querySelector('.seek-track');
  DOM.seekFill     = document.querySelector('.seek-fill');
  DOM.seekThumb    = document.querySelector('.seek-thumb');
  DOM.timeElapsed  = document.getElementById('time-elapsed');
  DOM.timeRemain   = document.getElementById('time-remain');
  DOM.volSlider    = document.getElementById('player-volume');
  DOM.dlBtn        = document.getElementById('player-download');

  // Ambient widget
  DOM.ambWidget    = document.getElementById('ambient-widget');
  DOM.awTitle      = document.getElementById('aw-title');
  DOM.awThumb      = document.getElementById('aw-thumb');
  DOM.awPlayBtn    = document.getElementById('aw-play-btn');
  DOM.awVolume     = document.getElementById('aw-volume');

  // Modals & overlays
  DOM.toast        = document.getElementById('toast');
  DOM.lightbox     = document.getElementById('lightbox');
  DOM.lightboxImg  = document.getElementById('lightbox-img');
  DOM.lightboxCap  = document.getElementById('lightbox-caption');
  DOM.lightboxDl   = document.getElementById('lightbox-dl');
  DOM.videoModal   = document.getElementById('video-modal');
  DOM.modalVideo   = document.getElementById('modal-video');
  DOM.txtReader    = document.getElementById('txt-reader');
  DOM.readerContent= document.getElementById('reader-content');
  DOM.sidebar      = document.getElementById('sidebar');
  DOM.pdfModal     = document.getElementById('pdf-modal');
  DOM.pdfIframe    = document.getElementById('pdf-iframe');
  DOM.aboutModal   = document.getElementById('about-modal');
}

/* ═══════════════════════════════════════════════════════════
   LOCAL STORAGE — progress tracking
═══════════════════════════════════════════════════════════ */
const Store = {
  get:  k    => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:  (k,v)=> { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },

  // Audio
  saveAudioTime:   (id,t)  => Store.set(`audio_${id}`,t),
  getAudioTime:    id      => Store.get(`audio_${id}`) || 0,
  saveAudioDur:    (id,d)  => Store.set(`audiodur_${id}`,d),
  getAudioDur:     id      => Store.get(`audiodur_${id}`) || 0,

  // TXT
  saveTxtScroll:   (id,p)  => Store.set(`txt_${id}`,p),
  getTxtScroll:    id      => Store.get(`txt_${id}`) || 0,
  saveTxtHeight:   (id,h)  => Store.set(`txth_${id}`,h),
  getTxtHeight:    id      => Store.get(`txth_${id}`) || 1,

  // PDF
  savePdfPage:     (id,p)  => Store.set(`pdf_progress_${id}`,p),
  getPdfPage:      id      => Store.get(`pdf_progress_${id}`) || 1,

  // Last opened
  saveLastAudio:   id      => Store.set('last_audio',id),
  getLastAudio:    ()      => Store.get('last_audio'),
  saveLastEcho:    id      => Store.set('last_echo',id),
  getLastEcho:     ()      => Store.get('last_echo'),
  getRecentImages: ()      => Store.get('images_recent') || [],
  addRecentImage:  id => {
    let r = Store.getRecentImages();
    r = [id,...r.filter(x=>x!==id)].slice(0,5);
    Store.set('images_recent',r);
  },
};

/* ═══════════════════════════════════════════════════════════
   URL BUILDER — ⑨ encodes each path segment
   Handles filenames with spaces, parentheses, Unicode
═══════════════════════════════════════════════════════════ */
function buildUrl(base, filePath) {
  if (!filePath) return '';
  const encoded = filePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
  return base + encoded;
}

/* ═══════════════════════════════════════════════════════════
   JSON LOADING
═══════════════════════════════════════════════════════════ */
async function fetchJSON(path, silent=false) {
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
    ...item,
    url:          buildUrl(sb, item.file),
    thumbnailUrl: buildUrl(sb, item.file),
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
  console.log('[Shunya] Loaded', {
    audios:State.data.audios.length, ambient:State.data.ambient.length,
    videos:State.data.videos.length, books:State.data.books.length,
    echo:State.data.echo.all.length, images:State.data.images.length,
  });
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
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
      DOM.sidebar.classList.remove('open');
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

/* ═══════════════════════════════════════════════════════════
   CARD BUILDER
═══════════════════════════════════════════════════════════ */
function buildCard(item, {badge='',delay=0,extraClass=''} = {}) {
  const progress = getItemProgress(item);
  const thumb = item.thumbnailUrl
    ? `<img data-src="${item.thumbnailUrl}" alt="" loading="lazy">`
    : `<div class="card-thumb-placeholder">${badge||'◌'}</div>`;

  const progressBar = progress > 0 ? `
    <div class="card-progress-bar">
      <div class="card-progress-fill" style="width:${progress}%"></div>
    </div>` : '';

  return `
    <div class="content-card animate-in ${extraClass}" data-id="${item.id}" style="animation-delay:${delay}s">
      <div class="card-thumb">${thumb}${progressBar}</div>
      <div class="card-info">
        ${badge ? `<span class="card-badge">${badge}</span>` : ''}
        <div class="card-title">${item.title||item.file||'—'}</div>
      </div>
    </div>`;
}

/** Returns 0–100 progress for a given item based on localStorage */
function getItemProgress(item) {
  if (!item?.id) return 0;
  if (item.id.startsWith('audio_')) {
    const t = Store.getAudioTime(item.id);
    const d = Store.getAudioDur(item.id);
    return d > 0 ? Math.round((t/d)*100) : 0;
  }
  if (item.type === 'txt') {
    const scroll = Store.getTxtScroll(item.id);
    const height = Store.getTxtHeight(item.id);
    return height > 0 ? Math.min(100, Math.round((scroll/height)*100)) : 0;
  }
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
        const w = el.closest('.card-thumb,.ambient-thumb,.aw-thumb');
        if (w) w.innerHTML = '<div class="card-thumb-placeholder">◌</div>';
      };
      io.disconnect();
    });
    io.observe(img);
  });
}

/* ═══════════════════════════════════════════════════════════
   HOME — ⑥ Resume cards with % progress
═══════════════════════════════════════════════════════════ */
function renderHome() {
  const C = document.getElementById('home-inner');
  const {home, global} = State.data;
  const quotes = home?.quotes || [];
  const q = quotes[Math.floor(Math.random()*quotes.length)] || {
    text:'The quieter you become, the more you can hear.', author:'Ram Dass',
  };

  const lastAudio = State.data.audios.find(a => a.id===Store.getLastAudio());
  const lastEcho  = State.data.echo.all.find(e => e.id===Store.getLastEcho());
  const lastImg   = State.data.images.find(i => i.id===Store.getRecentImages()[0]);

  function progressCard(item, action, type, label) {
    const pct = getItemProgress(item);
    const pLabel = pct > 0 ? `${pct}% complete` : 'Start';
    return `
      <div class="resume-card animate-in" data-action="${action}" data-id="${item.id}">
        <div class="resume-card-type">${type}</div>
        <div class="resume-card-title">${item.title||item.file||'—'}</div>
        ${item.thumbnailUrl ? '' : ''}
        <div class="resume-progress-wrap">
          <div class="resume-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="resume-progress-label">${pLabel}</div>
      </div>`;
  }

  const cards = [
    lastAudio ? progressCard(lastAudio,'resume-audio','↺ Continue Listening','Audio') : '',
    lastEcho  ? progressCard(lastEcho, 'resume-echo', '↺ Continue Reading',  'Echo')  : '',
    lastImg   ? `<div class="resume-card animate-in" data-action="resume-image" data-id="${lastImg.id}">
      <div class="resume-card-type">◎ Recently Viewed</div>
      <div class="resume-card-title">${lastImg.file||'An image'}</div>
    </div>` : '',
  ].filter(Boolean).join('');

  C.innerHTML = `
    <div class="home-hero">
      <div class="home-shunya-glyph">शून्य</div>
      <div class="home-welcome">${home?.welcome||'You have arrived.'}</div>
      <div class="home-tagline">${global?.site?.tagline||'A silence you can enter'}</div>
    </div>

    <div class="home-quote-block animate-in">
      <div class="quote-text">${q.text}</div>
      <div class="quote-author">— ${q.author}</div>
    </div>

    ${cards ? `<div class="home-resume">
      <div class="resume-title">Where you left off</div>
      <div class="resume-cards">${cards}</div>
    </div>` : ''}
  `;

  C.querySelectorAll('[data-action]').forEach(card => {
    card.addEventListener('click', () => {
      const {action,id} = card.dataset;
      if (action==='resume-audio') { navigateTo('audios'); setTimeout(()=>playAudioById(id),300); }
      if (action==='resume-echo')  { navigateTo('echo');   setTimeout(()=>openEchoById(id),300); }
      if (action==='resume-image') { navigateTo('images'); setTimeout(()=>openImageById(id),400); }
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   AUDIOS
═══════════════════════════════════════════════════════════ */
function renderAudios() {
  const C = document.getElementById('audios-list');
  const audios = State.data.audios;
  if (!audios.length) { C.innerHTML = emptyState('◑','No audios yet. Add .mp3 files to <code>shunya_data/audios/</code> and run <code>generate_json.py</code>'); return; }
  C.innerHTML = `<div class="content-grid">${
    audios.map((a,i) => buildCard(a,{badge:'Audio',delay:i*.05,extraClass:State.audio.currentId===a.id?'is-active':''})).join('')
  }</div>`;
  lazyLoad(C);
  C.querySelectorAll('.content-card').forEach(card =>
    card.addEventListener('click', () => playAudioById(card.dataset.id))
  );
}

/* ═══════════════════════════════════════════════════════════
   AUDIO ENGINE — ① SoundAura-inspired player
═══════════════════════════════════════════════════════════ */
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

  const savedTime = Store.getAudioTime(id);
  if (savedTime > 0) {
    DOM.mainAudio.addEventListener('loadedmetadata', () => {
      DOM.mainAudio.currentTime = savedTime;
    }, {once:true});
  }

  DOM.mainAudio.play()
    .then(() => { State.audio.isPlaying=true; showPlayerBar(item); refreshAudioUI(); })
    .catch(e => { console.warn('[Shunya] Audio play failed:',item.url,e.message); showToast('Could not load audio. Check the URL.'); showPlayerBar(item); });
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
  DOM.mainAudio.addEventListener('timeupdate', () => {
    if (State.audio.currentId) Store.saveAudioTime(State.audio.currentId, DOM.mainAudio.currentTime);
    if (DOM.mainAudio.duration) Store.saveAudioDur(State.audio.currentId, DOM.mainAudio.duration);
    updateSeek(DOM.mainAudio.currentTime, DOM.mainAudio.duration);
  });
  DOM.mainAudio.addEventListener('ended', () => {
    State.audio.isPlaying = false; refreshAudioUI();
    const next = State.audio.currentIndex+1;
    if (next < State.audio.list.length) playAudioById(State.audio.list[next].id);
  });
  DOM.mainAudio.addEventListener('play',  () => { State.audio.isPlaying=true;  refreshAudioUI(); });
  DOM.mainAudio.addEventListener('pause', () => { State.audio.isPlaying=false; refreshAudioUI(); });
  DOM.mainAudio.addEventListener('error', () => showToast('Audio error. Check the URL.'));
}

function updateSeek(current, duration) {
  if (!duration || isNaN(duration)) return;
  const pct = (current/duration)*100;
  if (DOM.seekFill) DOM.seekFill.style.width = pct+'%';
  if (DOM.seekThumb) DOM.seekThumb.style.left = pct+'%';
  if (DOM.timeElapsed) DOM.timeElapsed.textContent = fmt(current);
  if (DOM.timeRemain)  DOM.timeRemain.textContent  = '-'+fmt(duration-current);
}

function fmt(s) {
  if (!s||isNaN(s)) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

/* ═══════════════════════════════════════════════════════════
   PLAYER BAR INIT
═══════════════════════════════════════════════════════════ */
function showPlayerBar(item) {
  DOM.playerBar.classList.add('visible');
  DOM.playerTitle.textContent          = item.title||item.file||'—';
  DOM.playerSub.textContent            = item.speaker || item.author || '';
  DOM.playerThumb.src                  = item.thumbnailUrl||'';
  DOM.playerThumb.style.display        = item.thumbnailUrl ? 'block' : 'none';
  DOM.dlBtn.href                       = item.url||'#';
  DOM.dlBtn.setAttribute('download',   item.file||'');
}

function initPlayerBar() {
  DOM.playPauseBtn?.addEventListener('click', () => { if (DOM.mainAudio.src) toggleAudioPlayback(); });

  DOM.prevBtn?.addEventListener('click', () => {
    const i = State.audio.currentIndex;
    if (i>0) playAudioById(State.audio.list[i-1].id);
  });
  DOM.nextBtn?.addEventListener('click', () => {
    const i = State.audio.currentIndex;
    if (i < State.audio.list.length-1) playAudioById(State.audio.list[i+1].id);
  });

  DOM.skipBackBtn?.addEventListener('click', () => {
    if (DOM.mainAudio.src) DOM.mainAudio.currentTime = Math.max(0, DOM.mainAudio.currentTime-10);
  });
  DOM.skipFwdBtn?.addEventListener('click', () => {
    if (DOM.mainAudio.src) DOM.mainAudio.currentTime = Math.min(DOM.mainAudio.duration||0, DOM.mainAudio.currentTime+10);
  });

  DOM.seekTrack?.addEventListener('click', e => {
    if (!DOM.mainAudio.duration) return;
    const r = DOM.seekTrack.getBoundingClientRect();
    DOM.mainAudio.currentTime = ((e.clientX-r.left)/r.width)*DOM.mainAudio.duration;
  });

  DOM.volSlider?.addEventListener('input', function() {
    State.audio.volume = this.value/100;
    DOM.mainAudio.volume = State.audio.volume;
  });
  if (DOM.volSlider) DOM.volSlider.value = State.audio.volume*100;
  DOM.mainAudio.volume = State.audio.volume;

  // Space bar shortcut
  document.addEventListener('keydown', e => {
    if (e.code==='Space' && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      if (DOM.mainAudio.src) toggleAudioPlayback();
    }
    if (e.key==='ArrowRight' && DOM.mainAudio.src) {
      e.preventDefault();
      DOM.mainAudio.currentTime = Math.min(DOM.mainAudio.duration||0, DOM.mainAudio.currentTime+10);
    }
    if (e.key==='ArrowLeft' && DOM.mainAudio.src) {
      e.preventDefault();
      DOM.mainAudio.currentTime = Math.max(0, DOM.mainAudio.currentTime-10);
    }
  });

  updatePlayIcon();
}

/* ═══════════════════════════════════════════════════════════
   VIDEOS — ③ 16:9 aspect ratio enforced via CSS class
═══════════════════════════════════════════════════════════ */
function renderVideos() {
  const C = document.getElementById('videos-grid');
  const videos = State.data.videos;
  if (!videos.length) { C.innerHTML = emptyState('▷','No videos yet. Add files to <code>shunya_data/videos/</code> and run <code>generate_json.py</code>'); return; }
  C.innerHTML = `<div class="content-grid">${
    videos.map((v,i) => buildCard(v,{badge:'▷',delay:i*.06})).join('')
  }</div>`;
  lazyLoad(C);
  C.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => {
      const item = State.data.videos.find(v=>v.id===card.dataset.id);
      if (item) openVideoModal(item);
    });
  });
}

function openVideoModal(item) {
  DOM.modalVideo.src = item.url;
  DOM.videoModal.classList.add('open');
  DOM.modalVideo.play().catch(e => {
    console.warn('[Shunya] Video play failed:',item.url,e.message);
    showToast('Could not load video. Check the URL.');
  });
}
function closeVideoModal() {
  DOM.videoModal.classList.remove('open');
  DOM.modalVideo.pause();
  DOM.modalVideo.removeAttribute('src');
}
function initVideoModal() {
  document.querySelector('.video-modal-close')?.addEventListener('click', closeVideoModal);
  DOM.videoModal?.addEventListener('click', e => { if(e.target===DOM.videoModal) closeVideoModal(); });
}

/* ═══════════════════════════════════════════════════════════
   ECHO — cards → TXT reader or PDF modal
═══════════════════════════════════════════════════════════ */
function renderEcho() {
  const C = document.getElementById('echo-grid');
  const all = State.data.echo.all;
  if (!all.length) { C.innerHTML = emptyState('∿','No writings yet. Add files to <code>shunya/echo/</code> and run <code>generate_json.py</code>'); return; }
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

/* TXT reader — ⑤ scroll progress saved */
async function openTxtReader(item) {
  document.getElementById('reader-doc-title').textContent = item.title||item.file||'—';
  document.getElementById('reader-eyebrow').textContent   = 'Echo · Writing';
  DOM.readerContent.textContent = 'Loading…';
  DOM.txtReader.classList.add('open');
  const wrap = document.querySelector('.reader-content-wrap');

  try {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    DOM.readerContent.textContent = text;
    // Restore scroll
    setTimeout(() => {
      wrap.scrollTop = Store.getTxtScroll(item.id);
    }, 80);
  } catch(e) {
    console.warn('[Shunya] TXT fetch failed:',item.url,e.message);
    DOM.readerContent.textContent =
      `${item.title||''}\n\n[Could not load: ${item.url}]\n\nRun from a web server, not file://`;
  }

  // Save scroll + height on scroll
  const saveScroll = () => {
    Store.saveTxtScroll(item.id, wrap.scrollTop);
    Store.saveTxtHeight(item.id, wrap.scrollHeight - wrap.clientHeight);
  };
  wrap.addEventListener('scroll', saveScroll, {passive:true});
}

function initTxtReader() {
  const close = () => DOM.txtReader.classList.remove('open');
  document.getElementById('reader-close')?.addEventListener('click', close);
  document.getElementById('reader-close-top')?.addEventListener('click', close);
}

/* ═══════════════════════════════════════════════════════════
   PDF MODAL — ④ in-page reader + progress saving
═══════════════════════════════════════════════════════════ */
function openPdfModal(item) {
  State.pdf.currentItem = item;
  const page = Store.getPdfPage(item.id);
  document.getElementById('pdf-modal-title').textContent = item.title||item.file||'—';
  document.getElementById('pdf-page-num').value          = page;
  document.getElementById('pdf-total-pages').textContent = '?';
  document.getElementById('pdf-dl-btn').href             = item.url;
  document.getElementById('pdf-dl-btn').setAttribute('download', item.file||'');
  DOM.pdfIframe.src = item.url + (page>1 ? `#page=${page}` : '');
  DOM.pdfModal.classList.add('open');
}

function closePdfModal() {
  if (State.pdf.currentItem) {
    const p = parseInt(document.getElementById('pdf-page-num').value)||1;
    Store.savePdfPage(State.pdf.currentItem.id, p);
  }
  DOM.pdfModal.classList.remove('open');
  DOM.pdfIframe.src = '';
  State.pdf.currentItem = null;
}

function goToPdfPage(p) {
  if (!State.pdf.currentItem||!p) return;
  const page = Math.max(1,parseInt(p)||1);
  document.getElementById('pdf-page-num').value = page;
  DOM.pdfIframe.src = State.pdf.currentItem.url + `#page=${page}`;
}

function initPdfModal() {
  document.getElementById('pdf-close-btn')?.addEventListener('click', closePdfModal);
  DOM.pdfModal?.addEventListener('click', e => { if(e.target===DOM.pdfModal) closePdfModal(); });
  const pi = document.getElementById('pdf-page-num');
  pi?.addEventListener('change', () => goToPdfPage(pi.value));
  pi?.addEventListener('keydown', e => { if(e.key==='Enter') goToPdfPage(pi.value); });
  document.getElementById('pdf-prev-page')?.addEventListener('click', () =>
    goToPdfPage((parseInt(pi?.value)||1)-1)
  );
  document.getElementById('pdf-next-page')?.addEventListener('click', () =>
    goToPdfPage((parseInt(pi?.value)||1)+1)
  );
}

/* ═══════════════════════════════════════════════════════════
   IMAGES — lightbox
═══════════════════════════════════════════════════════════ */
function renderImages() {
  const C = document.getElementById('images-grid');
  const imgs = State.data.images;
  if (!imgs.length) { C.innerHTML = emptyState('◎','No images yet. Add files to <code>shunya/images/</code> and run <code>generate_json.py</code>'); return; }
  C.innerHTML = imgs.map((img,i) => `
    <div class="image-card animate-in" data-id="${img.id}" style="animation-delay:${i*.04}s">
      <img data-src="${img.url}" alt="" loading="lazy">
      <div class="image-card-overlay">
        <span class="image-caption">${img.file||''}</span>
        <a href="${img.url}" download class="image-download-btn">↓</a>
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

function openImageById(id) {
  const img = State.data.images.find(i=>i.id===id);
  if (!img) return;
  Store.addRecentImage(id);
  DOM.lightboxImg.src         = img.url;
  DOM.lightboxCap.textContent = img.file||'';
  DOM.lightboxDl.href         = img.url;
  DOM.lightbox.classList.add('open');
}

function initLightbox() {
  document.getElementById('lightbox-close')?.addEventListener('click', () => DOM.lightbox.classList.remove('open'));
  DOM.lightbox?.addEventListener('click', e => { if(e.target===DOM.lightbox) DOM.lightbox.classList.remove('open'); });
}

/* ═══════════════════════════════════════════════════════════
   BOOKS
═══════════════════════════════════════════════════════════ */
function renderBooks() {
  const C = document.getElementById('books-grid');
  const books = State.data.books;
  if (!books.length) { C.innerHTML = emptyState('⊟','No books yet. Add PDFs to <code>shunya/books/pdfs/</code> and run <code>generate_json.py</code>'); return; }
  C.innerHTML = `<div class="content-grid">${books.map((b,i) => buildCard(b,{badge:'PDF',delay:i*.06})).join('')}</div>`;
  lazyLoad(C);
  C.querySelectorAll('.content-card').forEach(card => {
    const item = books.find(b=>b.id===card.dataset.id);
    if (!item) return;
    const act = document.createElement('div');
    act.className = 'card-actions';
    act.innerHTML = `<button class="btn-read">Read</button><a href="${item.url}" download class="btn-dl">↓ Save</a>`;
    card.appendChild(act);
    card.addEventListener('click', e => { if(e.target.classList.contains('btn-dl')) return; openPdfModal(item); });
    act.querySelector('.btn-read').addEventListener('click', e => { e.stopPropagation(); openPdfModal(item); });
  });
}

/* ═══════════════════════════════════════════════════════════
   AMBIENT — grid + draggable widget  ② 
═══════════════════════════════════════════════════════════ */
function renderAmbient() {
  const grid  = document.getElementById('ambient-grid');
  const items = State.data.ambient;

  if (!items.length) {
    grid.innerHTML = emptyState('〰','No ambient sounds found. Add .mp3 or .mp4 files to <code>shunya_data/ambient/</code> and run <code>generate_json.py</code>');
    return;
  }

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
        </div>
        <div class="ambient-np-controls">
          <input type="range" class="ambient-vol-slider" min="0" max="100"
            value="${Math.round(State.ambient.volume*100)}">
          <button class="ambient-stop-btn">■ Stop</button>
        </div>
      </div>` : ''}

    <div class="ambient-cards-grid">
      ${items.map((a,i) => {
        const on = State.ambient.currentId===a.id && State.ambient.isPlaying;
        return `
          <div class="ambient-card animate-in ${on?'playing':''}" data-id="${a.id}" style="animation-delay:${i*.06}s">
            ${a.thumbnailUrl
              ? `<div class="ambient-thumb"><img data-src="${a.thumbnailUrl}" alt="${a.title}" loading="lazy"></div>`
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
  grid.querySelector('.ambient-vol-slider')?.addEventListener('input', function() {
    State.ambient.volume = this.value/100;
    DOM.ambientAudio.volume = State.ambient.volume;
    if (DOM.awVolume) DOM.awVolume.value = this.value;
  });
}

function toggleAmbient(id) {
  const item = State.data.ambient.find(a=>a.id===id);
  if (!item) return;
  if (State.ambient.currentId===id && State.ambient.isPlaying) { stopAmbient(); State.rendered.delete('ambient'); renderAmbient(); return; }
  if (State.isMobile && State.audio.isPlaying) { DOM.mainAudio.pause(); State.audio.isPlaying=false; refreshAudioUI(); }
  stopAmbient();
  DOM.ambientAudio.src    = item.url;
  DOM.ambientAudio.loop   = true;
  DOM.ambientAudio.volume = State.ambient.volume;
  DOM.ambientAudio.play()
    .then(() => {
      State.ambient.currentId = id;
      State.ambient.isPlaying = true;
      updateAmbientMiniSidebar(item);
      showAmbientWidget(item);
      State.rendered.delete('ambient');
      renderAmbient();
    })
    .catch(e => { console.warn('[Shunya] Ambient failed:',item.url,e.message); showToast('Could not load ambient sound.'); });
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

function initAmbientControls() {
  document.getElementById('ambient-volume')?.addEventListener('input', function() {
    State.ambient.volume = this.value/100;
    DOM.ambientAudio.volume = State.ambient.volume;
  });
  document.querySelector('.ambient-mini-stop')?.addEventListener('click', () => {
    stopAmbient(); State.rendered.delete('ambient'); renderAmbient();
  });
}

/* ── Draggable ambient widget ── */
function showAmbientWidget(item) {
  if (!DOM.ambWidget) return;
  DOM.ambWidget.classList.add('visible');
  if (DOM.awTitle) DOM.awTitle.textContent = item.title||'—';
  if (DOM.awThumb) {
    if (item.thumbnailUrl) {
      DOM.awThumb.innerHTML = `<img src="${item.thumbnailUrl}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      DOM.awThumb.innerHTML = '<div class="aw-thumb-empty">〰</div>';
    }
  }
  updateWidgetPlayIcon();
}
function hideAmbientWidget() {
  DOM.ambWidget?.classList.remove('visible');
}

function updateWidgetPlayIcon() {
  if (!DOM.awPlayBtn) return;
  DOM.awPlayBtn.innerHTML = State.ambient.isPlaying
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>`;
}

function initAmbientWidget() {
  if (!DOM.ambWidget) return;

  // Play/pause
  DOM.awPlayBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (!State.ambient.currentId) return;
    if (State.ambient.isPlaying) {
      DOM.ambientAudio.pause();
      State.ambient.isPlaying = false;
    } else {
      DOM.ambientAudio.play().catch(()=>{});
      State.ambient.isPlaying = true;
    }
    updateWidgetPlayIcon();
    State.rendered.delete('ambient');
    renderAmbient();
  });

  // Volume
  DOM.awVolume?.addEventListener('input', function() {
    State.ambient.volume = this.value/100;
    DOM.ambientAudio.volume = State.ambient.volume;
  });
  if (DOM.awVolume) DOM.awVolume.value = State.ambient.volume*100;

  // Stop
  document.getElementById('aw-stop')?.addEventListener('click', e => {
    e.stopPropagation();
    stopAmbient();
    State.rendered.delete('ambient');
    renderAmbient();
  });

  // Close
  document.getElementById('aw-close')?.addEventListener('click', e => {
    e.stopPropagation();
    hideAmbientWidget();
  });

  // Draggable
  let dragging = false, ox=0, oy=0;
  const handle = DOM.ambWidget.querySelector('.aw-header') || DOM.ambWidget;

  handle.addEventListener('mousedown', e => {
    if (e.target.closest('button,input')) return;
    dragging = true;
    DOM.ambWidget.classList.add('grabbing');
    const r = DOM.ambWidget.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let x = e.clientX - ox;
    let y = e.clientY - oy;
    x = Math.max(0, Math.min(innerWidth  - DOM.ambWidget.offsetWidth,  x));
    y = Math.max(0, Math.min(innerHeight - DOM.ambWidget.offsetHeight, y));
    DOM.ambWidget.style.left   = x+'px';
    DOM.ambWidget.style.top    = y+'px';
    DOM.ambWidget.style.right  = 'auto';
    DOM.ambWidget.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => {
    dragging = false;
    DOM.ambWidget.classList.remove('grabbing');
  });

  // Touch drag
  handle.addEventListener('touchstart', e => {
    if (e.target.closest('button,input')) return;
    const t = e.touches[0];
    dragging = true;
    const r = DOM.ambWidget.getBoundingClientRect();
    ox = t.clientX - r.left; oy = t.clientY - r.top;
  }, {passive:true});
  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    const t = e.touches[0];
    let x = t.clientX - ox;
    let y = t.clientY - oy;
    x = Math.max(0, Math.min(innerWidth  - DOM.ambWidget.offsetWidth,  x));
    y = Math.max(0, Math.min(innerHeight - DOM.ambWidget.offsetHeight, y));
    DOM.ambWidget.style.left = x+'px'; DOM.ambWidget.style.top = y+'px';
    DOM.ambWidget.style.right = 'auto'; DOM.ambWidget.style.bottom = 'auto';
  }, {passive:true});
  document.addEventListener('touchend', () => { dragging = false; });
}

/* ═══════════════════════════════════════════════════════════
   RANDOM WISDOM
═══════════════════════════════════════════════════════════ */
function randomWisdom() {
  const pool = [
    ...State.data.audios.map(a  => ({type:'audio',id:a.id})),
    ...State.data.echo.all.map(e => ({type:'echo', id:e.id})),
    ...State.data.images.map(i  => ({type:'image',id:i.id})),
    ...State.data.books.map(b   => ({type:'book', id:b.id})),
  ];
  if (!pool.length) return showToast('Nothing in the library yet.');
  const pick = pool[Math.floor(Math.random()*pool.length)];
  showToast('Opening something unexpected…');
  setTimeout(() => {
    if (pick.type==='audio') { navigateTo('audios'); setTimeout(()=>playAudioById(pick.id),400); }
    if (pick.type==='echo')  { navigateTo('echo');   setTimeout(()=>openEchoById(pick.id),400);  }
    if (pick.type==='image') { navigateTo('images'); setTimeout(()=>openImageById(pick.id),500); }
    if (pick.type==='book')  { navigateTo('books'); }
  }, 600);
}

/* ═══════════════════════════════════════════════════════════
   ABOUT MODAL — ⑧ logo click
═══════════════════════════════════════════════════════════ */
function initAboutModal() {
  document.querySelector('.sidebar-logo')?.addEventListener('click', () => {
    DOM.aboutModal?.classList.add('open');
  });
  document.getElementById('about-close')?.addEventListener('click', () => {
    DOM.aboutModal?.classList.remove('open');
  });
  DOM.aboutModal?.addEventListener('click', e => {
    if (e.target===DOM.aboutModal) DOM.aboutModal.classList.remove('open');
  });
}

/* ═══════════════════════════════════════════════════════════
   MOBILE NAV
═══════════════════════════════════════════════════════════ */
function initMobileNav() {
  document.getElementById('mobile-menu-toggle')?.addEventListener('click', () =>
    DOM.sidebar.classList.toggle('open')
  );
  window.addEventListener('resize', () => { State.isMobile = innerWidth < 900; });
}

/* ═══════════════════════════════════════════════════════════
   ESC KEY
═══════════════════════════════════════════════════════════ */
function initEscKey() {
  document.addEventListener('keydown', e => {
    if (e.key!=='Escape') return;
    DOM.txtReader?.classList.remove('open');
    DOM.lightbox?.classList.remove('open');
    DOM.pdfModal?.classList.remove('open');
    DOM.aboutModal?.classList.remove('open');
    closeVideoModal();
    DOM.sidebar?.classList.remove('open');
  });
}

/* ═══════════════════════════════════════════════════════════
   SITE META
═══════════════════════════════════════════════════════════ */
function initSiteMeta() {
  const g = State.data.global;
  const name = g?.site?.name||'ShunyaSpace';
  const sub  = g?.site?.subtitle||'शून्य';
  const ne = document.getElementById('logo-name');
  const se = document.getElementById('logo-sub');
  if (ne) ne.textContent = name;
  if (se) se.textContent = sub;
  document.title = name;
}

/* ═══════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════
   STARS CANVAS
═══════════════════════════════════════════════════════════ */
function initStars() {
  const cv = document.getElementById('stars-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const r = () => { cv.width=innerWidth; cv.height=innerHeight; };
  r(); window.addEventListener('resize',r);
  const stars = Array.from({length:120}, () => ({
    x:Math.random(), y:Math.random(),
    r:Math.random()*.8+.2, o:Math.random()*.4+.1,
    s:Math.random()*.0003+.0001, p:Math.random()*Math.PI*2,
  }));
  let t=0;
  (function draw() {
    ctx.clearRect(0,0,cv.width,cv.height);
    t+=.01;
    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x*cv.width, s.y*cv.height, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(192,132,252,${s.o*(0.6+0.4*Math.sin(t*s.s*100+s.p))})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
}

/* ═══════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════ */
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

  document.getElementById('btn-random')?.addEventListener('click', randomWisdom);

  navigateTo('home');
  if (DOM.app) DOM.app.style.opacity = '1';
}

if (document.readyState==='loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
