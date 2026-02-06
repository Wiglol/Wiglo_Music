(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const els = {
    app: $('#app'),
    sidebar: $('#sidebar'),
    sidebarScrim: $('#sidebarScrim'),
    btnSidebar: $('#btnSidebar'),
    btnRescan: $('#btnRescan'),
    fileImport: $('#fileImport'),
    btnHelp: $('#btnHelp'),
    btnTheme: $('#btnTheme'),

    searchInput: $('#searchInput'),
    btnClearSearch: $('#btnClearSearch'),
    sortSelect: $('#sortSelect'),

    loading: $('#loading'),
    loadingText: $('#loadingText'),

    libraryMeta: $('#libraryMeta'),
    resultsMeta: $('#resultsMeta'),
    tagChips: $('#tagChips'),
    btnClearFilters: $('#btnClearFilters'),
    railPrev: $('#railPrev'),
    railNext: $('#railNext'),
    madeRail: $('#madeRail'),

    trackRows: $('#trackRows'),
    emptyResults: $('#emptyResults'),
    btnEmptyClear: $('#btnEmptyClear'),
    emptyLibrary: $('#emptyLibrary'),
    emptyLibraryText: $('#emptyLibraryText'),
    btnEmptyImport: $('#btnEmptyImport'),
    btnEmptyRescan: $('#btnEmptyRescan'),

    playlistList: $('#playlistList'),
    emptyPlaylists: $('#emptyPlaylists'),
    btnNewPlaylist: $('#btnNewPlaylist'),
    btnEmptyNewPlaylist: $('#btnEmptyNewPlaylist'),
    playlistsMeta: $('#playlistsMeta'),

    favoriteRows: $('#favoriteRows'),
    favoritesMeta: $('#favoritesMeta'),
    emptyFavorites: $('#emptyFavorites'),

    recentRows: $('#recentRows'),
    recentMeta: $('#recentMeta'),
    emptyRecent: $('#emptyRecent'),

    btnPanel: $('#btnPanel'),

    miniTitle: $('#miniTitle'),
    miniSub: $('#miniSub'),

    btnShuffle: $('#btnShuffle'),
    btnPrev: $('#btnPrev'),
    btnPlay: $('#btnPlay'),
    playIcon: $('#playIcon'),
    btnNext: $('#btnNext'),
    btnRepeat: $('#btnRepeat'),
    repeatIcon: $('#repeatIcon'),

    timeNow: $('#timeNow'),
    timeDur: $('#timeDur'),
    scrubRange: $('#scrubRange'),

    btnLike: $('#btnLike'),
    btnMute: $('#btnMute'),
    muteIcon: $('#muteIcon'),
    volRange: $('#volRange'),

    panelHost: $('#panelHost'),
    panelBackdrop: $('#panelBackdrop'),
    panel: $('#panel'),
    btnClosePanel: $('#btnClosePanel'),
    panelMeta: $('#panelMeta'),
    npTitle: $('#npTitle'),
    npTags: $('#npTags'),
    npDesc: $('#npDesc'),
    queueList: $('#queueList'),
    emptyQueue: $('#emptyQueue'),
    btnClearQueue: $('#btnClearQueue'),

    modalHost: $('#modalHost'),
    modalBackdrop: $('#modalBackdrop'),
    modal: $('#modal'),
    modalTitle: $('#modalTitle'),
    modalBody: $('#modalBody'),
    modalFoot: $('#modalFoot'),
    btnCloseModal: $('#btnCloseModal'),

    toasts: $('#toasts'),
  };

  // --- Storage keys ---
  const LS = {
    theme: 'lp_theme',
    favorites: 'lp_favorites',
    recent: 'lp_recent',
    playlists: 'lp_playlists',
    ui: 'lp_ui',
    settings: 'lp_settings',
  };

  const defaultSettings = {
    persistImported: false,
  };

  const state = {
    view: 'library',
    tracks: [],
    tracksById: new Map(),

    search: '',
    tagFilters: new Set(),
    sort: 'newest',

    selectedId: null,

    now: {
      id: null,
      playing: false,
      duration: 0,
      currentTime: 0,
    },

    queue: [],
    queueIndex: -1,

    shuffle: false,
    repeat: 'off', // off | all | one

    favorites: new Set(),
    recent: [], // [{id, ts}]
    playlists: [], // [{id, name, trackIds, createdAt}]

    ui: {
      sidebarOpen: true,
      panelOpen: false,
    },

    settings: {...defaultSettings},

    durations: new Map(), // id -> seconds
    durationJobsRunning: 0,
  };

  const audio = new Audio();
  audio.preload = 'metadata';

  // --- Utils ---
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function isTypingTarget(el){
    if(!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); } catch { return fallback; }
  }

  function nowTs(){ return Date.now(); }

  function fmtTime(sec){
    if(!Number.isFinite(sec) || sec < 0) return '0:00';
    sec = Math.floor(sec);
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function uniq(arr){
    return Array.from(new Set(arr));
  }

  function toast(message, sub=''){
    const wrap = document.createElement('div');
    wrap.className = 'toast';
    const left = document.createElement('div');
    const msg = document.createElement('div');
    msg.className = 'toast-msg';
    msg.textContent = message;
    left.appendChild(msg);
    if(sub){
      const s = document.createElement('div');
      s.className = 'toast-sub';
      s.textContent = sub;
      left.appendChild(s);
    }
    const close = document.createElement('button');
    close.className = 'icon-btn';
    close.setAttribute('aria-label','Dismiss');
    close.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-x"/></svg>`;
    close.addEventListener('click', () => wrap.remove());
    wrap.append(left, close);
    els.toasts.appendChild(wrap);
    const t = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 3800 : 5200;
    window.setTimeout(() => { wrap.remove(); }, t);
  }

  function setLoading(on, text=''){
    // Loading UI intentionally removed (requested).
    // Keep the function so existing calls stay safe.
    if(!els.loading || !els.loadingText) return;
    els.loading.hidden = true;
  }

  function persist(){
    localStorage.setItem(LS.favorites, JSON.stringify(Array.from(state.favorites)));
    localStorage.setItem(LS.recent, JSON.stringify(state.recent));
    localStorage.setItem(LS.playlists, JSON.stringify(state.playlists));
    localStorage.setItem(LS.ui, JSON.stringify(state.ui));
    localStorage.setItem(LS.settings, JSON.stringify(state.settings));
    localStorage.setItem(LS.theme, document.documentElement.getAttribute('data-theme') || 'dark');
  }

  function hydrate(){
    const theme = localStorage.getItem(LS.theme) || 'dark';
    applyTheme(theme);

    const fav = safeJsonParse(localStorage.getItem(LS.favorites) || '[]', []);
    state.favorites = new Set(Array.isArray(fav) ? fav : []);

    const rec = safeJsonParse(localStorage.getItem(LS.recent) || '[]', []);
    state.recent = Array.isArray(rec) ? rec : [];

    const makePlId = () => `pl_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

    const plsRaw = safeJsonParse(localStorage.getItem(LS.playlists) || '[]', []);
    const pls = Array.isArray(plsRaw) ? plsRaw : [];
    state.playlists = pls.map(p => {
      if(!p || typeof p !== 'object') return null;
      const id = String(p.id || makePlId());
      const name = String(p.name || 'Untitled').trim() || 'Untitled';
      let trackIds = [];
      if(Array.isArray(p.trackIds)) trackIds = p.trackIds.map(String);
      else if(Array.isArray(p.tracks)) trackIds = p.tracks.map(String);
      else if(Array.isArray(p.items)) trackIds = p.items.map(String);
      trackIds = Array.from(new Set(trackIds)).filter(Boolean);
      return { id, name, trackIds, createdAt: Number(p.createdAt) || Date.now() };
    }).filter(Boolean);

    const uiRaw = safeJsonParse(localStorage.getItem(LS.ui) || '{}', {});
    const ui = (uiRaw && typeof uiRaw === 'object' && !Array.isArray(uiRaw)) ? uiRaw : {};
    state.ui.sidebarOpen = (typeof ui.sidebarOpen === 'boolean') ? ui.sidebarOpen : true;
    state.ui.panelOpen = (typeof ui.panelOpen === 'boolean') ? ui.panelOpen : false;

    const settingsRaw = safeJsonParse(localStorage.getItem(LS.settings) || '{}', {});
    const settings = (settingsRaw && typeof settingsRaw === 'object' && !Array.isArray(settingsRaw)) ? settingsRaw : {};
    state.settings = {...defaultSettings, ...(settings || {})};

    // Track build so updates can show a helpful tip if needed (non-breaking)
    localStorage.setItem('lp_build', '20260206_1');

    els.app.dataset.sidebarOpen = String(!!state.ui.sidebarOpen);
  }

  function applyTheme(theme){
    const t = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    els.btnTheme.setAttribute('aria-pressed', String(t === 'light'));
    els.btnTheme.innerHTML = t === 'light'
      ? `<svg class="icon" aria-hidden="true"><use href="#i-sun"/></svg>Theme`
      : `<svg class="icon" aria-hidden="true"><use href="#i-moon"/></svg>Theme`;
  }

  // --- TXT parsing (mandatory rules) ---
  function parseTxt(raw){
    // Read as UTF-8 already, keep exact lines
    const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");


    // Title: first non-empty line
    const title = (lines.find(l => l.trim().length > 0) || '').trim();

    // Find exact line "Description:" then capture description lines until we reach
    // a blank line followed by a line starting with "Perfect for:"
    let desc = '';
    let tags = null;

    const idxDesc = lines.findIndex(l => l === 'Description:');
    if(idxDesc >= 0){
      const descLines = [];
      let i = idxDesc + 1;
      for(; i < lines.length; i++){
        const line = lines[i];
        if(line.trim() === ''){
          // look ahead for Perfect for:
          const next = (lines[i+1] ?? '');
          if(next.startsWith('Perfect for:')){
            break;
          }
          // If blank line but no Perfect for next, treat as end of description anyway
          break;
        }
        descLines.push(line);
      }
      desc = descLines.join("\n").trim();

      // tags line
      for(let j = i+1; j < lines.length; j++){
        const line = lines[j];
        if(line.startsWith('Perfect for:')){
          const part = line.slice('Perfect for:'.length).trim();
          if(part){
            tags = part.split('•').map(s => s.trim()).filter(Boolean);
          } else {
            tags = [];
          }
          break;
        }
      }
    }

    const out = {
      title: title || '',
      description: desc || '',
      tags: Array.isArray(tags) ? tags : null,
    };
    return out;
  }

  // --- Data loading ---
  async function fetchUtf8Text(url){
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return new TextDecoder('utf-8', { fatal:false }).decode(buf);
  }

  function baseName(file){
    const i = file.lastIndexOf('.');
    return i >= 0 ? file.slice(0,i) : file;
  }

  function extName(file){
    const i = file.lastIndexOf('.');
    return i >= 0 ? file.slice(i+1).toLowerCase() : '';
  }

  function numericKeyFromId(id){
    const m = String(id).match(/^\d+$/);
    return m ? parseInt(id, 10) : -1;
  }

  
  async function scanManifestLibrary(){
    const manifestUrl = new URL('library/manifest.json', window.location.href);

    if(window.location.protocol === 'file:'){
      return { ok:false, reason:'file' };
    }

    let data;
    try{
      const res = await fetch(manifestUrl.toString(), { cache: 'no-store' });
      if(!res.ok) return { ok:false, reason:'no-manifest' };
      data = await res.json();
    } catch {
      return { ok:false, reason:'bad-manifest' };
    }

    const tracksIn = Array.isArray(data?.tracks) ? data.tracks : [];
    const libBase = new URL('library/', window.location.href);

    const tracks = [];
    for(const t of tracksIn){
      const id = String(t?.id ?? '').trim() || baseName(String(t?.mp3 ?? ''));
      const mp3 = String(t?.mp3 ?? '').trim();
      if(!mp3) continue;

      tracks.push({
        id,
        fileKey: id,
        source: 'server',
        src: new URL(mp3, libBase).toString(),
        title: String(t?.title ?? id) || id,
        description: String(t?.description ?? 'No description yet.') || 'No description yet.',
        tags: Array.isArray(t?.tags) ? t.tags : [],
        hasTags: Array.isArray(t?.tags) ? (t.tags.length > 0) : false,
        duration: null,
        addedAt: numericKeyFromId(id),
      });
    }

    return { ok:true, tracks };
  }

async function scanServerLibrary(){
    const libUrl = new URL('library/', window.location.href);

    // If file://, server scan won't work.
    if(window.location.protocol === 'file:'){
      return { ok:false, reason:'file' };
    }

    let html;
    try{
      const res = await fetch(libUrl.toString(), { cache: 'no-store' });
      if(!res.ok) return { ok:false, reason:'no-listing' };
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      html = await res.text();
      if(!html || (!ct.includes('text/html') && !html.includes('<a'))){
        // Some servers might return plain; still attempt DOM parse
      }
    } catch {
      return { ok:false, reason:'fetch-failed' };
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links = $$('a[href]', doc).map(a => a.getAttribute('href') || '').filter(Boolean);

    const mp3ByBase = new Map();
    const txtByBase = new Map();

    for(const href of links){
      if(href.endsWith('/')) continue;
      const url = new URL(href, libUrl);
      const name = decodeURIComponent(url.pathname.split('/').pop() || '');
      const ext = extName(name);
      const b = baseName(name);
      if(ext === 'mp3') mp3ByBase.set(b, href);
      if(ext === 'txt') txtByBase.set(b, href);
    }

    const bases = Array.from(mp3ByBase.keys()).sort((a,b) => numericKeyFromId(b) - numericKeyFromId(a));

    const tracks = [];
    for(const b of bases){
      const mp3Href = mp3ByBase.get(b);
      const mp3Url = new URL(mp3Href, libUrl).toString();
      const txtHref = txtByBase.get(b);
      let title = b;
      let description = 'No description yet.';
      let tags = [];
      let hasTags = false;

      if(txtHref){
        try{
          const txtUrl = new URL(txtHref, libUrl).toString();
          const raw = await fetchUtf8Text(txtUrl);
          const parsed = parseTxt(raw);
          if(parsed.title) title = parsed.title;
          if(parsed.description) description = parsed.description;
          if(parsed.tags){ tags = parsed.tags; hasTags = tags.length > 0; }
        } catch {
          // fall back
        }
      }

      tracks.push({
        id: b,
        fileKey: b,
        source: 'server',
        src: mp3Url,
        title,
        description,
        tags,
        hasTags,
        duration: null,
        addedAt: numericKeyFromId(b),
      });
    }

    return { ok:true, tracks };
  }

  // --- IndexedDB for persisted imports ---
  const DB_NAME = 'LocalPlayerDB';
  const DB_VER = 1;

  function openDb(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains('tracks')){
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  async function idbGetAllTracks(){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readonly');
      const store = tx.objectStore('tracks');
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async function idbPutTrack(rec){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('tracks').put(rec);
    });
  }

  async function idbClear(){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('tracks').clear();
    });
  }

  async function loadPersistedImports(){
    try{
      const rows = await idbGetAllTracks();
      if(!rows.length) return [];
      const out = [];
      for(const r of rows){
        const url = URL.createObjectURL(r.mp3Blob);
        const parsed = r.txtText ? parseTxt(r.txtText) : { title:'', description:'', tags:null };
        const title = parsed.title || r.id;
        const description = parsed.description || 'No description yet.';
        const tags = parsed.tags || [];
        out.push({
          id: r.id,
          fileKey: r.id,
          source: 'idb',
          src: url,
          title,
          description,
          tags,
          hasTags: tags.length > 0,
          duration: null,
          addedAt: r.addedAt || 0,
        });
      }
      return out;
    } catch {
      return [];
    }
  }

  // --- Import folder ---
  function readFileText(file){
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onload = () => resolve(String(fr.result || ''));
      fr.readAsText(file, 'utf-8');
    });
  }

  async function importFolder(files){
    const list = Array.from(files || []);
    const mp3 = new Map();
    const txt = new Map();

    for(const f of list){
      const name = f.name;
      const ext = extName(name);
      const b = baseName(name);
      if(ext === 'mp3') mp3.set(b, f);
      if(ext === 'txt') txt.set(b, f);
    }

    const bases = Array.from(mp3.keys()).sort((a,b) => numericKeyFromId(b) - numericKeyFromId(a));
    const tracks = [];

    setLoading(true, 'Importing folder…');
    for(const b of bases){
      const file = mp3.get(b);
      const url = URL.createObjectURL(file);

      let title = b;
      let description = 'No description yet.';
      let tags = [];
      let hasTags = false;
      let rawTxt = '';

      const tf = txt.get(b);
      if(tf){
        try{
          rawTxt = await readFileText(tf);
          const parsed = parseTxt(rawTxt);
          if(parsed.title) title = parsed.title;
          if(parsed.description) description = parsed.description;
          if(parsed.tags){ tags = parsed.tags; hasTags = tags.length > 0; }
        } catch {
          // ignore
        }
      }

      const rec = {
        id: b,
        fileKey: b,
        source: 'import',
        src: url,
        title,
        description,
        tags,
        hasTags,
        duration: null,
        addedAt: numericKeyFromId(b),
      };

      tracks.push(rec);

      if(state.settings.persistImported){
        try{
          await idbPutTrack({
            id: b,
            mp3Blob: file,
            txtText: rawTxt || '',
            addedAt: numericKeyFromId(b),
          });
        } catch {
          // storage could fail (quota)
        }
      }
    }

    setLoading(false);

    if(state.settings.persistImported){
      toast('Imported folder saved', 'Stored in this browser (IndexedDB).');
    } else {
      toast('Imported folder', 'Tip: enable “Remember imported files” in Help → Storage.');
    }

    loadTracks(tracks);
  }

  // --- Duration measurement (metadata) ---
  function getDurationForUrl(url){
    return new Promise((resolve) => {
      const a = new Audio();
      a.preload = 'metadata';
      a.src = url;
      const done = (val) => {
        a.removeAttribute('src');
        a.load();
        resolve(val);
      };
      a.addEventListener('loadedmetadata', () => {
        const d = Number.isFinite(a.duration) ? a.duration : null;
        done(d);
      }, { once:true });
      a.addEventListener('error', () => done(null), { once:true });
    });
  }

  async function ensureDurations(ids, label){
    const pending = ids.filter(id => !state.durations.has(id));
    if(!pending.length) return;

    const show = typeof label === 'string' && label.length > 0;
    if(show) setLoading(true, label);

    const concurrency = 3;
    let i = 0;

    async function worker(){
      while(i < pending.length){
        const id = pending[i++];
        const t = state.tracksById.get(id);
        if(!t) continue;
        try{
          const dur = await getDurationForUrl(t.src);
          if(dur != null) state.durations.set(id, dur);
        } catch {
          // ignore per-track duration errors
        }
      }
    }

    const jobs = Array.from({length: Math.min(concurrency, pending.length)}, worker);

    try{
      await Promise.all(jobs);
    } finally {
      if(show) setLoading(false);
    }

    renderAll();
  }

  // --- Track loading / derived views ---
  function loadTracks(tracks){
    // Revoke old object URLs from imports/idb to avoid leaks
    for(const t of state.tracks){
      if((t.source === 'import' || t.source === 'idb') && typeof t.src === 'string' && t.src.startsWith('blob:')){
        try{ URL.revokeObjectURL(t.src); } catch {}
      }
    }

    state.tracks = tracks;
    state.tracksById = new Map(tracks.map(t => [t.id, t]));
    state.selectedId = tracks[0]?.id || null;

    // reset queue unless current now playing still exists
    if(state.now.id && state.tracksById.has(state.now.id)){
      // keep
    } else {
      state.now.id = null;
      state.now.playing = false;
      state.queue = [];
      state.queueIndex = -1;
      audio.pause();
      audio.src = '';
    }

    renderAll();
    persist();

    // If we have a hash track, attempt
    handleHashPlay();

    // precompute a handful durations in background for nicer list
    const ids = getFilteredTrackIds().slice(0, 18);
    ensureDurations(ids).catch(() => {});
  }

  function getAllTags(){
    const tags = [];
    for(const t of state.tracks){
      for(const tag of (t.tags || [])) tags.push(tag);
    }
    return tags;
  }

  function getFilteredTrackIds(){
    const q = state.search.trim().toLowerCase();
    const hasQ = q.length > 0;
    const tagSet = state.tagFilters;
    const tagOn = tagSet.size > 0;

    let arr = state.tracks;

    if(hasQ || tagOn){
      arr = arr.filter(t => {
        if(tagOn){
          const ttags = t.tags || [];
          for(const f of tagSet){
            if(!ttags.includes(f)) return false;
          }
        }
        if(hasQ){
          const hay = `${t.title}
${t.description}
${(t.tags||[]).join(' ')}`.toLowerCase();
          if(!hay.includes(q)) return false;
        }
        return true;
      });
    }

    // sort
    const sort = state.sort;
    if(sort === 'az'){
      arr = arr.slice().sort((a,b) => a.title.localeCompare(b.title));
    } else if(sort === 'duration'){
      // unknown durations last
      arr = arr.slice().sort((a,b) => {
        const da = state.durations.get(a.id);
        const db = state.durations.get(b.id);
        const va = (da == null) ? Number.POSITIVE_INFINITY : da;
        const vb = (db == null) ? Number.POSITIVE_INFINITY : db;
        return va - vb;
      });
    } else {
      // newest: numeric filename desc, unknown at bottom
      arr = arr.slice().sort((a,b) => {
        const na = numericKeyFromId(a.id);
        const nb = numericKeyFromId(b.id);
        if(na === -1 && nb === -1) return b.id.localeCompare(a.id);
        if(na === -1) return 1;
        if(nb === -1) return -1;
        return nb - na;
      });
    }

    return arr.map(t => t.id);
  }

  // --- Playback / queue ---
  function buildQueueFromIds(ids, startId){
    state.queue = ids.slice();
    state.queueIndex = Math.max(0, state.queue.indexOf(startId));
  }

  function setNow(id){
    state.now.id = id;
    state.now.currentTime = 0;
    state.now.duration = 0;
    const t = state.tracksById.get(id);
    if(!t) return;

    audio.src = t.src;
    audio.currentTime = 0;
    audio.play().then(() => {
      state.now.playing = true;
      renderPlayer();
      addRecent(id);
    }).catch(() => {
      state.now.playing = false;
      renderPlayer();
      toast('Can’t autoplay', 'Click play to start audio.');
    });

    state.selectedId = id;
    renderAll();
  }

  function playOrPause(){
    if(!state.now.id){
      const ids = getFilteredTrackIds();
      if(ids.length){
        buildQueueFromIds(ids, ids[0]);
        setNow(ids[0]);
      }
      return;
    }
    if(state.now.playing){
      audio.pause();
      state.now.playing = false;
    } else {
      audio.play().then(() => {
        state.now.playing = true;
        addRecent(state.now.id);
      }).catch(() => {
        toast('Playback blocked', 'Try clicking play again.');
      });
    }
    renderPlayer();
  }

  function pickNextIndex(){
    if(!state.queue.length) return -1;
    if(state.repeat === 'one') return state.queueIndex;

    if(state.shuffle){
      if(state.queue.length === 1) return state.queueIndex;
      let n = state.queueIndex;
      let tries = 0;
      while(n === state.queueIndex && tries < 8){
        n = Math.floor(Math.random() * state.queue.length);
        tries++;
      }
      return n;
    }

    const next = state.queueIndex + 1;
    if(next < state.queue.length) return next;
    if(state.repeat === 'all') return 0;
    return -1;
  }

  function pickPrevIndex(){
    if(!state.queue.length) return -1;
    if(state.shuffle){
      return Math.floor(Math.random() * state.queue.length);
    }
    const prev = state.queueIndex - 1;
    if(prev >= 0) return prev;
    if(state.repeat === 'all') return state.queue.length - 1;
    return 0;
  }

  function nextTrack(){
    const ni = pickNextIndex();
    if(ni < 0){
      state.now.playing = false;
      renderPlayer();
      return;
    }
    state.queueIndex = ni;
    const id = state.queue[ni];
    setNow(id);
  }

  function prevTrack(){
    if(audio.currentTime > 3){
      audio.currentTime = 0;
      return;
    }
    const pi = pickPrevIndex();
    state.queueIndex = pi;
    const id = state.queue[pi];
    setNow(id);
  }

  function addToQueue(id){
    if(!state.queue.length){
      state.queue = [id];
      state.queueIndex = 0;
      toast('Added to queue', state.tracksById.get(id)?.title || id);
      renderPanel();
      return;
    }
    state.queue.push(id);
    toast('Added to queue', state.tracksById.get(id)?.title || id);
    renderPanel();
  }

  function playNext(id){
    if(!state.queue.length){
      state.queue = [id];
      state.queueIndex = 0;
      setNow(id);
      return;
    }
    const insertAt = clamp(state.queueIndex + 1, 0, state.queue.length);
    state.queue.splice(insertAt, 0, id);
    toast('Will play next', state.tracksById.get(id)?.title || id);
    renderPanel();
  }

  function removeFromQueue(index){
    if(index < 0 || index >= state.queue.length) return;
    const removed = state.queue.splice(index, 1)[0];
    if(index < state.queueIndex) state.queueIndex -= 1;
    if(index === state.queueIndex){
      // keep current id if still exists; else shift
      if(state.queueIndex >= state.queue.length) state.queueIndex = state.queue.length - 1;
    }
    toast('Removed from queue', state.tracksById.get(removed)?.title || removed);
    renderPanel();
  }

  function moveQueue(index, dir){
    const j = index + dir;
    if(j < 0 || j >= state.queue.length) return;
    const arr = state.queue;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    if(state.queueIndex === index) state.queueIndex = j;
    else if(state.queueIndex === j) state.queueIndex = index;
    renderPanel();
  }

  function clearQueue(){
    state.queue = [];
    state.queueIndex = -1;
    toast('Queue cleared');
    renderPanel();
  }

  function addRecent(id){
    const ts = nowTs();
    // remove existing
    state.recent = state.recent.filter(r => r.id !== id);
    state.recent.unshift({ id, ts });
    state.recent = state.recent.slice(0, 80);
    persist();
    renderRecent();
  }

  // --- Favorites / playlists ---
  function toggleFavorite(id){
    if(!id) return;
    if(state.favorites.has(id)){
      state.favorites.delete(id);
      toast('Removed from favorites');
    } else {
      state.favorites.add(id);
      toast('Added to favorites');
    }
    persist();
    renderAll();
  }

  function ensurePlaylistId(){
    return `pl_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  function createPlaylist(name){
    const trimmed = String(name || '').trim();
    if(!trimmed){ toast('Name required'); return null; }
    const pl = { id: ensurePlaylistId(), name: trimmed, trackIds: [], createdAt: Date.now() };
    state.playlists.unshift(pl);
    persist();
    renderPlaylists();
    toast('Playlist created', trimmed);
    return pl;
  }

  function deletePlaylist(id){
    const pl = state.playlists.find(p => p.id === id);
    state.playlists = state.playlists.filter(p => p.id !== id);
    persist();
    renderPlaylists();
    toast('Playlist deleted', pl?.name || '');
  }

  function addTrackToPlaylist(plId, trackId){
    const pl = state.playlists.find(p => p.id === plId);
    if(!pl) return;
    if(!pl.trackIds.includes(trackId)) pl.trackIds.push(trackId);
    persist();
    renderPlaylists();
    toast('Added to playlist', pl.name);
  }

  function removeTrackFromPlaylist(plId, trackId){
    const pl = state.playlists.find(p => p.id === plId);
    if(!pl) return;
    pl.trackIds = pl.trackIds.filter(x => x !== trackId);
    persist();
    renderPlaylists();
    toast('Removed from playlist', pl.name);
  }

  // --- Views / rendering ---
  function setView(view){
    state.view = view;
    els.app.dataset.view = view;
    $$('.nav-item').forEach(b => {
      const on = b.dataset.view === view;
      b.setAttribute('aria-current', on ? 'page' : 'false');
      if(!on) b.removeAttribute('aria-current');
    });

    $$('.view').forEach(v => {
      v.hidden = v.dataset.view !== view;
    });

    if(window.innerWidth <= 980){
      state.ui.sidebarOpen = false;
      els.app.dataset.sidebarOpen = 'false';
      els.sidebarScrim.hidden = true;
    }

    if(view === 'favorites') renderFavorites();
    if(view === 'recent') renderRecent();
    if(view === 'playlists') renderPlaylists();
  }

  function renderMeta(){
    const total = state.tracks.length;
    const filtered = getFilteredTrackIds().length;
    els.libraryMeta.textContent = total ? `${total} track${total===1?'':'s'}` : '';
    els.resultsMeta.textContent = total ? `${filtered} shown` : '';
  }

  function renderTagChips(){
    const all = getAllTags();
    const counts = new Map();
    for(const t of all){ counts.set(t, (counts.get(t)||0)+1); }
    const tags = Array.from(counts.entries())
      .sort((a,b) => b[1]-a[1])
      .slice(0, 20)
      .map(([t]) => t);

    els.tagChips.innerHTML = '';
    for(const t of tags){
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = t;
      const pressed = state.tagFilters.has(t);
      b.setAttribute('aria-pressed', String(pressed));
      b.addEventListener('click', () => {
        if(state.tagFilters.has(t)) state.tagFilters.delete(t);
        else state.tagFilters.add(t);
        renderLibrary();
      });
      els.tagChips.appendChild(b);
    }

    els.btnClearFilters.hidden = state.tagFilters.size === 0;
  }

  function renderRail(){
    if(!els.madeRail) return;
    const all = getAllTags();
    const counts = new Map();
    for(const t of all){ counts.set(t, (counts.get(t)||0)+1); }

    const top = Array.from(counts.entries())
      .sort((a,b) => b[1]-a[1])
      .slice(0, 10);

    els.madeRail.innerHTML = '';

    if(!top.length){
      const p = document.createElement('div');
      p.className = 'meta';
      p.textContent = state.tracks.length ? 'No tags found in your .txt files yet.' : '';
      els.madeRail.appendChild(p);
      return;
    }

    for(const [tag, count] of top){
      const btn = document.createElement('button');
      btn.className = 'rail-item';
      btn.type = 'button';
      btn.setAttribute('role','listitem');
      btn.innerHTML = `
        <div class="rail-title">${escapeHtml(`Mix: ${tag}`)}</div>
        <div class="rail-sub">${count} track${count===1?'':'s'} · Tap to filter</div>
      `;
      btn.addEventListener('click', () => {
        state.tagFilters = new Set([tag]);
        renderLibrary();
        toast('Filter applied', tag);
      });
      els.madeRail.appendChild(btn);
    }
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  function trackRow(id){
    const t = state.tracksById.get(id);
    if(!t) return document.createElement('div');

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'track-row';
    row.setAttribute('aria-selected', String(state.selectedId === id));
    row.dataset.id = id;

    const dur = state.durations.get(id);

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = t.title;
    titleWrap.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'track-sub';

    // tags chips under title
    if(t.hasTags){
      for(const tag of (t.tags || []).slice(0, 6)){
        const s = document.createElement('span');
        s.className = 'tag';
        s.textContent = tag;
        sub.appendChild(s);
      }
    }

    if(sub.childElementCount) titleWrap.appendChild(sub);

    const durEl = document.createElement('div');
    durEl.className = 'col-duration';
    durEl.textContent = dur == null ? '–:––' : fmtTime(dur);

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'menu-btn';
    menuBtn.setAttribute('aria-label','Track actions');
    menuBtn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-dots"/></svg>`;
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTrackMenu(menuBtn, id);
    });

    row.append(titleWrap, durEl, menuBtn);

    row.addEventListener('click', () => {
      const ids = getFilteredTrackIds();
      buildQueueFromIds(ids, id);
      setNow(id);
    });

    row.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        const ids = getFilteredTrackIds();
        buildQueueFromIds(ids, id);
        setNow(id);
      }
    });

    return row;
  }

  // Track actions menu (popover)
  let menuEl = null;
  let menuAnchor = null;
  function closeTrackMenu(){
    if(menuEl){
      menuEl.remove();
      menuEl = null;
      menuAnchor?.focus?.();
      menuAnchor = null;
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onMenuKeyDown, true);
    }
  }

  function onDocMouseDown(e){
    if(!menuEl) return;
    if(menuEl.contains(e.target)) return;
    if(menuAnchor && menuAnchor.contains(e.target)) return;
    closeTrackMenu();
  }

  function onMenuKeyDown(e){
    if(e.key === 'Escape'){
      e.preventDefault();
      closeTrackMenu();
    }
  }

  function openTrackMenu(anchor, id){
    closeTrackMenu();
    menuAnchor = anchor;

    const t = state.tracksById.get(id);
    if(!t) return;

    const isFav = state.favorites.has(id);

    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.zIndex = '420';
    wrap.style.minWidth = '220px';
    wrap.style.background = 'var(--raised)';
    wrap.style.border = '1px solid var(--stroke)';
    wrap.style.borderRadius = '14px';
    wrap.style.boxShadow = 'var(--shadow)';
    wrap.style.padding = '6px';

    wrap.setAttribute('role','menu');

    const items = [
      { label: 'Play', act: () => {
        const ids = getFilteredTrackIds();
        buildQueueFromIds(ids, id);
        setNow(id);
      }},
      { label: 'Play next', act: () => playNext(id)},
      { label: 'Add to queue', act: () => addToQueue(id)},
      { label: isFav ? 'Unfavorite' : 'Favorite', act: () => toggleFavorite(id)},
      { label: 'Add to playlist…', act: () => openAddToPlaylistModal(id)},
      { label: 'Copy link', act: () => copyLink(id)},
    ];

    for(const it of items){
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role','menuitem');
      b.style.width = '100%';
      b.style.textAlign = 'left';
      b.style.padding = '10px 10px';
      b.style.borderRadius = '10px';
      b.style.fontSize = '13px';
      b.addEventListener('mouseenter', () => b.style.background = 'var(--hover)');
      b.addEventListener('mouseleave', () => b.style.background = 'transparent');
      b.textContent = it.label;
      b.addEventListener('click', () => {
        it.act();
        closeTrackMenu();
      });
      wrap.appendChild(b);
    }

    const r = anchor.getBoundingClientRect();
    const pad = 8;
    const left = clamp(r.right - 220, pad, window.innerWidth - 240);
    const top = clamp(r.bottom + 6, pad, window.innerHeight - 240);
    wrap.style.left = `${left}px`;
    wrap.style.top = `${top}px`;

    document.body.appendChild(wrap);
    menuEl = wrap;

    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onMenuKeyDown, true);

    const firstBtn = wrap.querySelector('button');
    firstBtn?.focus();
  }

  function renderLibrary(){
    renderMeta();
    renderTagChips();
    renderRail();

    const ids = getFilteredTrackIds();

    els.trackRows.innerHTML = '';
    for(const id of ids){
      els.trackRows.appendChild(trackRow(id));
    }

    // empty states
    const hasTracks = state.tracks.length > 0;
    const hasResults = ids.length > 0;

    els.emptyLibrary.hidden = hasTracks;
    els.emptyResults.hidden = !hasTracks || hasResults;

    if(!hasTracks){
      const fileMode = window.location.protocol === 'file:';
      els.emptyLibraryText.textContent = fileMode
        ? 'You opened this as a file, so the browser can’t scan /library. Use “Import folder…” or run a local server.'
        : 'Put paired files in /library (e.g., 1.mp3 + 1.txt) then rescan.';
    }

    if(hasTracks && !hasResults){
      els.emptyResults.hidden = false;
    }

    // if sorting by duration, ensure durations when user picked it
    if(state.sort === 'duration'){
      ensureDurations(ids, 'Sorting by duration…').catch(() => {});
    }

    els.btnClearFilters.hidden = state.tagFilters.size === 0;
    persist();
  }

  function renderFavorites(){
    const favIds = Array.from(state.favorites).filter(id => state.tracksById.has(id));
    const ids = favIds
      .map(id => state.tracksById.get(id))
      .filter(Boolean)
      .sort((a,b) => a.title.localeCompare(b.title))
      .map(t => t.id);

    els.favoritesMeta.textContent = ids.length ? `${ids.length} track${ids.length===1?'':'s'}` : '';
    els.favoriteRows.innerHTML = '';

    for(const id of ids){
      els.favoriteRows.appendChild(trackRow(id));
    }

    els.emptyFavorites.hidden = ids.length > 0;
  }

  function renderRecent(){
    const ids = state.recent
      .filter(r => state.tracksById.has(r.id))
      .slice(0, 50)
      .map(r => r.id);

    els.recentMeta.textContent = ids.length ? `${ids.length} track${ids.length===1?'':'s'}` : '';
    els.recentRows.innerHTML = '';
    for(const id of ids){
      els.recentRows.appendChild(trackRow(id));
    }
    els.emptyRecent.hidden = ids.length > 0;
  }

  function renderPlaylists(){
    els.playlistsMeta.textContent = state.playlists.length ? `${state.playlists.length} playlist${state.playlists.length===1?'':'s'}` : '';

    els.playlistList.innerHTML = '';
    els.emptyPlaylists.hidden = state.playlists.length > 0;

    for(const pl of state.playlists){
      const row = document.createElement('div');
      row.className = 'q-item';
      row.style.borderRadius = '0';
      row.style.padding = '14px 0';
      row.style.borderBottom = '1px solid var(--stroke)';
      row.style.cursor = 'pointer';
      row.setAttribute('role','button');
      row.tabIndex = 0;

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'track-title';
      title.textContent = pl.name;
      const sub = document.createElement('div');
      sub.className = 'meta';
      sub.textContent = `${pl.trackIds.length} track${pl.trackIds.length===1?'':'s'}`;
      left.append(title, sub);

      const actions = document.createElement('div');
      actions.className = 'q-actions';

      const del = document.createElement('button');
      del.className = 'primary danger';
      del.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg>`;
      del.setAttribute('aria-label', `Delete playlist ${pl.name}`);
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        openConfirmModal('Delete playlist?', `“${pl.name}” will be removed from this browser.`, () => deletePlaylist(pl.id));
      });

      actions.append(del);
      row.append(left, actions);

      const open = () => openPlaylistModal(pl.id);
      row.addEventListener('click', open);
      row.addEventListener('keydown', (e) => {
        if(e.key === 'Enter'){
          e.preventDefault();
          open();
        }
      });

      els.playlistList.appendChild(row);
    }
  }

  function renderMini(){
    const id = state.now.id;
    if(!id){
      els.miniTitle.textContent = 'Nothing playing';
      els.miniSub.textContent = 'Pick a track to start.';
      return;
    }
    const t = state.tracksById.get(id);
    els.miniTitle.textContent = t?.title || id;
    const tags = (t?.tags || []).slice(0, 4);
    els.miniSub.textContent = tags.length ? tags.join(' • ') : (t?.description ? t.description.split("\n")[0] : '');
  }

  function renderPlayer(){
    renderMini();

    els.btnPlay.setAttribute('aria-label', state.now.playing ? 'Pause' : 'Play');
    els.playIcon.innerHTML = state.now.playing ? '<use href="#i-pause"/>' : '<use href="#i-play"/>';

    els.btnShuffle.setAttribute('aria-pressed', String(state.shuffle));

    const rep = state.repeat;
    els.btnRepeat.setAttribute('aria-pressed', String(rep !== 'off'));
    els.repeatIcon.innerHTML = rep === 'one' ? '<use href="#i-repeat-one"/>' : '<use href="#i-repeat"/>';

    const id = state.now.id;
    const liked = id ? state.favorites.has(id) : false;
    els.btnLike.setAttribute('aria-pressed', String(liked));

    // time UI
    els.timeNow.textContent = fmtTime(state.now.currentTime);
    els.timeDur.textContent = fmtTime(state.now.duration);

    const max = state.now.duration > 0 ? state.now.duration : 100;
    els.scrubRange.max = String(max);
    els.scrubRange.value = String(clamp(state.now.currentTime, 0, max));

    // volume
    els.volRange.value = String(audio.volume);
    els.btnMute.setAttribute('aria-pressed', String(audio.muted));
    els.muteIcon.innerHTML = audio.muted ? '<use href="#i-mute"/>' : '<use href="#i-volume"/>';

    renderPanel();
  }

  function renderPanel(){
    const open = state.ui.panelOpen;
    els.panelHost.hidden = !open;
    els.panelHost.setAttribute('aria-hidden', String(!open));

    if(!open) return;

    const id = state.now.id;
    const t = id ? state.tracksById.get(id) : null;

    els.panelMeta.textContent = id ? (state.now.playing ? 'Playing' : 'Paused') : '';
    els.npTitle.textContent = t?.title || 'Nothing playing';

    els.npTags.innerHTML = '';
    if(t?.hasTags){
      for(const tag of (t.tags || []).slice(0, 10)){
        const s = document.createElement('span');
        s.className = 'tag';
        s.textContent = tag;
        els.npTags.appendChild(s);
      }
    }

    const desc = t?.description || 'No description yet.';
    els.npDesc.textContent = desc;

    // Queue
    els.queueList.innerHTML = '';
    if(!state.queue.length){
      els.emptyQueue.hidden = false;
      return;
    }
    els.emptyQueue.hidden = true;

    state.queue.forEach((qid, idx) => {
      const qt = state.tracksById.get(qid);
      const item = document.createElement('div');
      item.className = 'q-item';
      item.style.background = idx === state.queueIndex ? 'var(--active)' : 'transparent';
      item.style.borderRadius = '12px';

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'q-title';
      title.textContent = qt?.title || qid;
      const sub = document.createElement('div');
      sub.className = 'q-sub';
      const dur = state.durations.get(qid);
      sub.textContent = dur == null ? '' : fmtTime(dur);
      left.append(title);
      if(sub.textContent) left.append(sub);

      const actions = document.createElement('div');
      actions.className = 'q-actions';

      const up = document.createElement('button');
      up.className = 'small-btn';
      up.setAttribute('aria-label','Move up');
      up.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-up"/></svg>`;
      up.addEventListener('click', () => moveQueue(idx, -1));

      const down = document.createElement('button');
      down.className = 'small-btn';
      down.setAttribute('aria-label','Move down');
      down.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-down"/></svg>`;
      down.addEventListener('click', () => moveQueue(idx, +1));

      const rm = document.createElement('button');
      rm.className = 'small-btn';
      rm.setAttribute('aria-label','Remove');
      rm.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg>`;
      rm.addEventListener('click', () => removeFromQueue(idx));

      const play = document.createElement('button');
      play.className = 'small-btn';
      play.setAttribute('aria-label','Play this');
      play.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-play"/></svg>`;
      play.addEventListener('click', () => {
        state.queueIndex = idx;
        setNow(qid);
      });

      actions.append(play, up, down, rm);
      item.append(left, actions);
      els.queueList.appendChild(item);
    });
  }

  function renderAll(){
    renderLibrary();
    renderPlayer();
    if(state.view === 'favorites') renderFavorites();
    if(state.view === 'recent') renderRecent();
    if(state.view === 'playlists') renderPlaylists();
  }

  // --- Modal system ---
  let lastFocus = null;
  function openModal(title, bodyNode, footNode){
    closeTrackMenu();
    lastFocus = document.activeElement;

    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = '';
    els.modalBody.appendChild(bodyNode);
    els.modalFoot.innerHTML = '';
    if(footNode) els.modalFoot.appendChild(footNode);

    els.modalHost.hidden = false;
    els.modalHost.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';

    els.modal.focus();
  }

  function closeModal(){
    els.modalHost.hidden = true;
    els.modalHost.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    lastFocus?.focus?.();
  }

  function trapFocusInModal(e){
    if(els.modalHost.hidden) return;
    if(e.key !== 'Tab') return;
    const focusables = $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', els.modal)
      .filter(el => !el.disabled && !el.hasAttribute('hidden'));
    if(!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if(e.shiftKey && document.activeElement === first){
      e.preventDefault();
      last.focus();
    } else if(!e.shiftKey && document.activeElement === last){
      e.preventDefault();
      first.focus();
    }
  }

  function openHelpModal(){
    const body = document.createElement('div');

    const p1 = document.createElement('div');
    p1.className = 'meta';
    p1.style.whiteSpace = 'pre-wrap';
    p1.textContent =
`
Keyboard shortcuts

Space / K  → play/pause
J / L      → -10s / +10s
Ctrl/Cmd+K → focus search
Esc        → close panels/menus

`;

    const storage = document.createElement('div');
    storage.className = 'panel-section';
    storage.style.borderTop = '1px solid var(--stroke)';
    storage.style.marginTop = '16px';
    storage.style.paddingTop = '16px';

    const h = document.createElement('div');
    h.className = 'empty-title';
    h.style.margin = '0 0 6px';
    h.textContent = 'Storage';

    const row = document.createElement('div');
    row.className = 'row';

    const left = document.createElement('div');
    const lt = document.createElement('div');
    lt.className = 'label';
    lt.textContent = 'Remember imported files (IndexedDB)';
    const ls = document.createElement('div');
    ls.className = 'meta';
    ls.textContent = 'Lets the app work after refresh when you used Import folder… (uses disk space).';
    left.append(lt, ls);

    const toggle = document.createElement('button');
    toggle.className = 'primary';
    toggle.textContent = state.settings.persistImported ? 'On' : 'Off';
    toggle.setAttribute('aria-pressed', String(state.settings.persistImported));
    toggle.addEventListener('click', () => {
      state.settings.persistImported = !state.settings.persistImported;
      toggle.textContent = state.settings.persistImported ? 'On' : 'Off';
      toggle.setAttribute('aria-pressed', String(state.settings.persistImported));
      persist();
      toast('Setting updated', state.settings.persistImported ? 'Imports will be saved.' : 'Imports won’t be saved.');
    });

    row.append(left, toggle);

    const row2 = document.createElement('div');
    row2.className = 'row';

    const left2 = document.createElement('div');
    const lt2 = document.createElement('div');
    lt2.className = 'label';
    lt2.textContent = 'Clear saved imports';
    const ls2 = document.createElement('div');
    ls2.className = 'meta';
    ls2.textContent = 'Removes saved audio files from this browser.';
    left2.append(lt2, ls2);

    const clear = document.createElement('button');
    clear.className = 'primary danger';
    clear.textContent = 'Clear';
    clear.addEventListener('click', async () => {
      try{
        await idbClear();
        toast('Saved imports cleared');
      } catch {
        toast('Could not clear storage');
      }
    });

    row2.append(left2, clear);

    const row3 = document.createElement('div');
row3.className = 'row';

const left3 = document.createElement('div');
const lt3 = document.createElement('div');
lt3.className = 'label';
lt3.textContent = 'Reset app data';
const ls3 = document.createElement('div');
ls3.className = 'meta';
ls3.textContent = 'Clears theme, favorites, playlists, and UI state for this app (this browser).';
left3.append(lt3, ls3);

const reset = document.createElement('button');
reset.className = 'primary danger';
reset.textContent = 'Reset';
reset.addEventListener('click', async () => {
  const ok = confirm('Reset app data on this browser? This clears favorites, playlists, theme and settings. Saved imports are not cleared here.');
  if(!ok) return;
  try{
    localStorage.removeItem(LS.favorites);
    localStorage.removeItem(LS.recent);
    localStorage.removeItem(LS.playlists);
    localStorage.removeItem(LS.ui);
    localStorage.removeItem(LS.settings);
    localStorage.removeItem(LS.theme);
    localStorage.removeItem('lp_build');
  } catch {}
  toast('App data reset', 'Reloading…');
  window.setTimeout(() => window.location.reload(), 250);
});

row3.append(left3, reset);

storage.append(h, row, row2, row3);

    body.append(p1, storage);

    const foot = document.createElement('div');
    const ok = document.createElement('button');
    ok.className = 'primary';
    ok.textContent = 'Close';
    ok.addEventListener('click', closeModal);
    foot.appendChild(ok);

    openModal('Settings', body, foot);
  }

  function openConfirmModal(title, message, onConfirm){
    const body = document.createElement('div');
    const t = document.createElement('div');
    t.className = 'meta';
    t.style.whiteSpace = 'pre-wrap';
    t.textContent = message;
    body.appendChild(t);

    const foot = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.className = 'ghost';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeModal);

    const del = document.createElement('button');
    del.className = 'primary danger';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      closeModal();
      onConfirm?.();
    });

    foot.append(cancel, del);
    openModal(title, body, foot);
  }

  function openNewPlaylistModal(){
    const body = document.createElement('div');
    const field = document.createElement('div');
    field.className = 'field';
    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = 'Name';
    const inp = document.createElement('input');
    inp.className = 'input';
    inp.type = 'text';
    inp.placeholder = 'e.g., Night walks';
    field.append(lab, inp);

    body.appendChild(field);

    const foot = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.className = 'ghost';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeModal);

    const create = document.createElement('button');
    create.className = 'primary';
    create.textContent = 'Create';
    create.addEventListener('click', () => {
      const pl = createPlaylist(inp.value);
      if(pl) closeModal();
    });

    inp.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') create.click();
    });

    foot.append(cancel, create);
    openModal('New playlist', body, foot);
    inp.focus();
  }

  function openAddToPlaylistModal(trackId){
    const t = state.tracksById.get(trackId);
    const body = document.createElement('div');

    if(!state.playlists.length){
      const p = document.createElement('div');
      p.className = 'empty';
      p.innerHTML = `<div class="empty-title">No playlists yet</div><div class="empty-text">Create one first.</div>`;
      body.appendChild(p);
    } else {
      for(const pl of state.playlists){
        const row = document.createElement('div');
        row.className = 'row';

        const left = document.createElement('div');
        const nm = document.createElement('div');
        nm.className = 'label';
        nm.textContent = pl.name;
        const sub = document.createElement('div');
        sub.className = 'meta';
        sub.textContent = `${pl.trackIds.length} track${pl.trackIds.length===1?'':'s'}`;
        left.append(nm, sub);

        const btn = document.createElement('button');
        const already = pl.trackIds.includes(trackId);
        btn.className = 'primary';
        btn.textContent = already ? 'Remove' : 'Add';
        btn.addEventListener('click', () => {
          if(already) removeTrackFromPlaylist(pl.id, trackId);
          else addTrackToPlaylist(pl.id, trackId);
          closeModal();
        });

        row.append(left, btn);
        body.appendChild(row);
      }
    }

    const foot = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.className = 'ghost';
    cancel.textContent = 'Close';
    cancel.addEventListener('click', closeModal);

    const create = document.createElement('button');
    create.className = 'primary';
    create.textContent = 'New playlist';
    create.addEventListener('click', () => {
      closeModal();
      openNewPlaylistModal();
    });

    foot.append(cancel, create);
    openModal('Add to playlist', body, foot);
  }

  function openAddTracksToPlaylistModal(plId){
    const pl = state.playlists.find(p => p.id === plId);
    if(!pl) return;

    const body = document.createElement('div');

    const field = document.createElement('div');
    field.className = 'field';
    const lbl = document.createElement('div');
    lbl.className = 'label';
    lbl.textContent = 'Search';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'input';
    inp.placeholder = 'Search title or tags…';
    field.append(lbl, inp);

    const list = document.createElement('div');
    list.style.borderTop = '1px solid var(--stroke)';
    list.style.marginTop = '12px';

    function makeRow(id){
      const t = state.tracksById.get(id);
      const r = document.createElement('div');
      r.className = 'row';

      const lt = document.createElement('div');
      const nm = document.createElement('div');
      nm.className = 'label';
      nm.textContent = t?.title || id;

      const sm = document.createElement('div');
      sm.className = 'meta';
      const tags = (t?.tags || []);
      sm.textContent = tags.slice(0, 4).join(' • ');
      lt.append(nm, sm);

      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = 'Add';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        addTrackToPlaylist(plId, id);
        btn.textContent = 'Added';
        btn.disabled = true;
      });

      r.append(lt, btn);
      return r;
    }

    function render(){
      const q = inp.value.trim().toLowerCase();
      list.innerHTML = '';

      const inPl = new Set(pl.trackIds);
      const ids = state.tracks
        .map(t => t.id)
        .filter(id => !inPl.has(id));

      const filtered = q
        ? ids.filter(id => {
            const t = state.tracksById.get(id);
            if(!t) return false;
            const hay = `${t.title} ${(t.tags||[]).join(' ')}`.toLowerCase();
            return hay.includes(q);
          })
        : ids;

      if(!filtered.length){
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.innerHTML = `<div class="empty-title">No tracks found</div><div class="empty-text">Try a different search.</div>`;
        list.appendChild(empty);
        return;
      }

      for(const id of filtered){
        list.appendChild(makeRow(id));
      }
    }

    inp.addEventListener('input', render);

    body.append(field, list);

    const foot = document.createElement('div');
    const back = document.createElement('button');
    back.className = 'ghost';
    back.textContent = 'Back';
    back.addEventListener('click', () => {
      closeModal();
      openPlaylistModal(plId);
    });

    const done = document.createElement('button');
    done.className = 'primary';
    done.textContent = 'Done';
    done.addEventListener('click', closeModal);

    foot.append(back, done);

    openModal(`Add tracks`, body, foot);
    render();
  }

function openPlaylistModal(plId){
    const pl = state.playlists.find(p => p.id === plId);
    if(!pl) return;

    const body = document.createElement('div');

    const top = document.createElement('div');
    top.className = 'row';
    top.style.borderTop = '0';

    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'label';
    name.textContent = pl.name;
    const sub = document.createElement('div');
    sub.className = 'meta';
    sub.textContent = `${pl.trackIds.length} track${pl.trackIds.length===1?'':'s'}`;
    left.append(name, sub);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const addTracks = document.createElement('button');
    addTracks.className = 'primary';
    addTracks.textContent = 'Add tracks…';
    addTracks.addEventListener('click', () => {
      closeModal();
      openAddTracksToPlaylistModal(plId);
    });

const playAll = document.createElement('button');
    playAll.className = 'primary';
    playAll.textContent = 'Play';
    playAll.disabled = pl.trackIds.length === 0;
    playAll.addEventListener('click', () => {
      const ids = pl.trackIds.filter(id => state.tracksById.has(id));
      if(!ids.length) return;
      buildQueueFromIds(ids, ids[0]);
      setNow(ids[0]);
      closeModal();
    });

    actions.append(addTracks, playAll);
    top.append(left, actions);

    body.appendChild(top);

    if(!pl.trackIds.length){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = `<div class="empty-title">Empty playlist</div><div class="empty-text">Use “Add tracks…” to add songs.</div>`;
      body.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.style.borderTop = '1px solid var(--stroke)';
      list.style.marginTop = '10px';

      for(const id of pl.trackIds){
        if(!state.tracksById.has(id)) continue;
        const r = document.createElement('div');
        r.className = 'row';

        const lt = document.createElement('div');
        const t = state.tracksById.get(id);
        const nm = document.createElement('div');
        nm.className = 'label';
        nm.textContent = t?.title || id;
        const sm = document.createElement('div');
        sm.className = 'meta';
        sm.textContent = (t?.tags || []).slice(0,3).join(' • ');
        lt.append(nm, sm);

        const rm = document.createElement('button');
        rm.className = 'primary danger';
        rm.textContent = 'Remove';
        rm.addEventListener('click', () => {
          removeTrackFromPlaylist(plId, id);
          closeModal();
        });

        r.append(lt, rm);
        list.appendChild(r);
      }

      body.appendChild(list);
    }

    const foot = document.createElement('div');
    const close = document.createElement('button');
    close.className = 'primary';
    close.textContent = 'Close';
    close.addEventListener('click', closeModal);
    foot.appendChild(close);

    openModal('Playlist', body, foot);
  }

  // --- Copy link ---
  async function copyLink(id){
    const url = `${window.location.href.split('#')[0]}#track=${encodeURIComponent(id)}`;
    try{
      await navigator.clipboard.writeText(url);
      toast('Copied link', id);
    } catch {
      window.prompt('Copy link:', url);
    }
  }

  function handleHashPlay(){
    const h = window.location.hash || '';
    const m = h.match(/track=([^&]+)/);
    if(!m) return;
    const id = decodeURIComponent(m[1]);
    if(!state.tracksById.has(id)) return;

    const ids = getFilteredTrackIds();
    buildQueueFromIds(ids.includes(id) ? ids : [id], id);
    setNow(id);
  }

  // --- Panel / sidebar ---
  function openPanel(){
    state.ui.panelOpen = true;
    persist();
    renderPanel();
    els.panel.focus();
  }

  function closePanel(){
    state.ui.panelOpen = false;
    persist();
    els.panelHost.hidden = true;
    els.panelHost.setAttribute('aria-hidden','true');
    els.btnPanel.focus();
  }

  function setSidebar(open){
    state.ui.sidebarOpen = open;
    els.app.dataset.sidebarOpen = String(open);
    els.sidebarScrim.hidden = !(open && window.innerWidth <= 980);
    persist();
  }

  // --- Events ---
  function bind(){
    // nav
    $$('.nav-item').forEach(b => {
      b.addEventListener('click', () => setView(b.dataset.view));
    });

    // sidebar toggle
    if(els.btnSidebar){
      els.btnSidebar.addEventListener('click', () => setSidebar(!state.ui.sidebarOpen));
    }
    els.sidebarScrim.addEventListener('click', () => setSidebar(false));

    // rescan
    if(els.btnRescan) els.btnRescan.addEventListener('click', () => bootScan());
    if(els.btnEmptyRescan) els.btnEmptyRescan.addEventListener('click', () => bootScan());

    // import
    els.fileImport.addEventListener('change', async () => {
      const files = els.fileImport.files;
      if(!files || !files.length) return;
      await importFolder(files);
      els.fileImport.value = '';
    });
    els.btnEmptyImport.addEventListener('click', () => els.fileImport.click());

    // help + theme
    els.btnHelp.addEventListener('click', openHelpModal);
    els.btnTheme.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
      persist();
    });

    // search
    els.searchInput.addEventListener('input', () => {
      state.search = els.searchInput.value;
      els.btnClearSearch.hidden = state.search.length === 0;
      renderLibrary();
    });
    els.btnClearSearch.addEventListener('click', () => {
      els.searchInput.value = '';
      state.search = '';
      els.btnClearSearch.hidden = true;
      renderLibrary();
      els.searchInput.focus();
    });

    // sort
    els.sortSelect.addEventListener('change', () => {
      state.sort = els.sortSelect.value;
      renderLibrary();
    });

    // clear filters
    els.btnClearFilters.addEventListener('click', () => {
      state.tagFilters.clear();
      renderLibrary();
      toast('Filters cleared');
    });

    els.btnEmptyClear.addEventListener('click', () => {
      state.tagFilters.clear();
      state.search = '';
      els.searchInput.value = '';
      els.btnClearSearch.hidden = true;
      renderLibrary();
    });

    // rail scroll
    if(els.railPrev && els.railNext && els.madeRail){
      els.railPrev.addEventListener('click', () => {
        els.madeRail.scrollBy({ left: -240, behavior: 'smooth' });
      });
      els.railNext.addEventListener('click', () => {
        els.madeRail.scrollBy({ left: 240, behavior: 'smooth' });
      });
    }
// panel
    els.btnPanel.addEventListener('click', openPanel);
    els.btnClosePanel.addEventListener('click', closePanel);
    els.panelBackdrop.addEventListener('click', (e) => {
      if(e.target === els.panelBackdrop) closePanel();
    });

    els.btnClearQueue.addEventListener('click', clearQueue);

    // playlists
    els.btnNewPlaylist.addEventListener('click', openNewPlaylistModal);
    els.btnEmptyNewPlaylist.addEventListener('click', openNewPlaylistModal);

    // modal
    els.btnCloseModal.addEventListener('click', closeModal);
    els.modalBackdrop.addEventListener('click', (e) => {
      if(e.target === els.modalBackdrop) closeModal();
    });
    document.addEventListener('keydown', trapFocusInModal, true);

    // player controls
    els.btnPlay.addEventListener('click', playOrPause);
    els.btnPrev.addEventListener('click', prevTrack);
    els.btnNext.addEventListener('click', nextTrack);

    els.btnShuffle.addEventListener('click', () => {
      state.shuffle = !state.shuffle;
      toast(state.shuffle ? 'Shuffle on' : 'Shuffle off');
      renderPlayer();
      persist();
    });

    els.btnRepeat.addEventListener('click', () => {
      state.repeat = (state.repeat === 'off') ? 'all' : (state.repeat === 'all') ? 'one' : 'off';
      toast(`Repeat: ${state.repeat}`);
      renderPlayer();
      persist();
    });

    els.btnLike.addEventListener('click', () => toggleFavorite(state.now.id));

    els.btnMute.addEventListener('click', () => {
      audio.muted = !audio.muted;
      renderPlayer();
      persist();
    });

    els.volRange.addEventListener('input', () => {
      audio.volume = clamp(parseFloat(els.volRange.value), 0, 1);
      audio.muted = false;
      renderPlayer();
      persist();
    });

    let userScrubbing = false;
    els.scrubRange.addEventListener('input', () => {
      userScrubbing = true;
      const v = parseFloat(els.scrubRange.value);
      state.now.currentTime = v;
      els.timeNow.textContent = fmtTime(v);
    });
    els.scrubRange.addEventListener('change', () => {
      const v = parseFloat(els.scrubRange.value);
      if(Number.isFinite(v)) audio.currentTime = v;
      userScrubbing = false;
    });

    // audio events
    audio.addEventListener('timeupdate', () => {
      state.now.currentTime = audio.currentTime || 0;
      if(!userScrubbing) els.scrubRange.value = String(state.now.currentTime);
      els.timeNow.textContent = fmtTime(state.now.currentTime);
    });

    audio.addEventListener('loadedmetadata', () => {
      state.now.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      els.scrubRange.max = String(state.now.duration || 100);
      els.timeDur.textContent = fmtTime(state.now.duration);
      if(state.now.id && state.now.duration){
        state.durations.set(state.now.id, state.now.duration);
        renderLibrary();
      }
    });

    audio.addEventListener('ended', () => {
      if(state.repeat === 'one'){
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      nextTrack();
    });

    audio.addEventListener('pause', () => {
      state.now.playing = false;
      renderPlayer();
    });

    audio.addEventListener('play', () => {
      state.now.playing = true;
      renderPlayer();
    });

    // keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if(els.modalHost.hidden === false) {
        if(e.key === 'Escape'){ e.preventDefault(); closeModal(); }
        return;
      }

      if(menuEl){
        if(e.key === 'Escape'){ e.preventDefault(); closeTrackMenu(); }
        return;
      }

      if(!els.panelHost.hidden){
        if(e.key === 'Escape'){ e.preventDefault(); closePanel(); return; }
      }

      if(e.key === 'Escape'){
        // close sidebar on mobile
        if(window.innerWidth <= 980 && state.ui.sidebarOpen){
          setSidebar(false);
        }
        return;
      }

      const isCmdK = (e.key.toLowerCase() === 'k') && (e.ctrlKey || e.metaKey);
      if(isCmdK){
        e.preventDefault();
        els.searchInput.focus();
        els.searchInput.select();
        return;
      }

      if(isTypingTarget(document.activeElement)) return;

      if(e.key === ' ' || e.key.toLowerCase() === 'k'){
        e.preventDefault();
        playOrPause();
      }
      if(e.key.toLowerCase() === 'j'){
        e.preventDefault();
        audio.currentTime = clamp(audio.currentTime - 10, 0, state.now.duration || Infinity);
      }
      if(e.key.toLowerCase() === 'l'){
        e.preventDefault();
        audio.currentTime = clamp(audio.currentTime + 10, 0, state.now.duration || Infinity);
      }
    });

    window.addEventListener('hashchange', handleHashPlay);

    window.addEventListener('resize', () => {
      if(window.innerWidth > 980){
        els.sidebarScrim.hidden = true;
      } else {
        els.sidebarScrim.hidden = !(state.ui.sidebarOpen);
      }
    });
  }

  // --- Boot scan ---
    // --- Boot scan ---
  async function bootScan(){
    closeTrackMenu();

    // Try manifest scan (GitHub Pages friendly)
    setLoading(true, 'Loading library…');
    const man = await scanManifestLibrary();
    if(man.ok){
      setLoading(false);
      toast('Library loaded', `${man.tracks.length} track${man.tracks.length===1?'':'s'}`);
      loadTracks(man.tracks);
      return;
    }

    // Try server directory listing scan (works on some servers, not GitHub Pages)
    setLoading(true, 'Scanning /library…');
    const res = await scanServerLibrary();
    if(res.ok){
      setLoading(false);
      toast('Library loaded', `${res.tracks.length} track${res.tracks.length===1?'':'s'}`);
      loadTracks(res.tracks);
      return;
    }

// If server scan fails, try persisted imports
    setLoading(true, 'Looking for saved imports…');
    const fromIdb = await loadPersistedImports();
    setLoading(false);
    if(fromIdb.length){
      toast('Loaded saved imports', `${fromIdb.length} track${fromIdb.length===1?'':'s'}`);
      loadTracks(fromIdb);
      return;
    }

    loadTracks([]);
  }

  // --- init ---
  function init(){
    hydrate();
    bind();

    // Set initial view
    setView(state.view);
    els.sortSelect.value = state.sort;

    // initial panel state
    if(state.ui.panelOpen) openPanel();

    // Boot
    bootScan();

    // Friendly first-run hint if file protocol
    if(window.location.protocol === 'file:'){
      toast('Tip', 'Use “Import folder…” to load tracks when opened as a file.');
    }
  }

  init();

})();
