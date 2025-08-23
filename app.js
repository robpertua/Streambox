/***********************
 * CONFIG & UTILITIES  *
 ***********************/
const CONFIG = {
  TMDB_KEY: '8b38fdbfc051bcd57c89da7fc2e5bdef', // Using provided working key
  REGION: 'US',
  IMAGE_BASE: 'https://image.tmdb.org/t/p/',
  PROVIDER_NAMES: ['Netflix','Amazon Prime','Amazon Prime Video','Disney','Disney+','HBO Max','Max','Hulu','Apple TV+','Paramount+','Paramount Plus']
};

const state = {
  theme: 'dark',
  route: location.hash || '#/home',
  genres: { movie: [], tv: [] },
  providerIds: [], // discovered at startup
  cache: new Map(),
  watchlist: [],
  history: [],
};

const sleep = (ms) => new Promise(r => setTimeout(r,ms));
const el = (sel, parent=document) => parent.querySelector(sel);
const els = (sel, parent=document) => [...parent.querySelectorAll(sel)];
const clamp = (n,min,max) => Math.min(Math.max(n,min),max);

function toast(msg) {
  const t = el('#toast');
  t.textContent = msg; 
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function setTheme(mode) {
  state.theme = mode;
  if(mode === 'light') document.documentElement.classList.add('light');
  else document.documentElement.classList.remove('light');
}

function setKey(key) {
  CONFIG.TMDB_KEY = key;
}

function setRegion(region) { 
  CONFIG.REGION = region; 
}

function imgUrl(path, size='w342') { 
  return path ? `${CONFIG.IMAGE_BASE}${size}${path}` : '' 
}

function saveLists() {
  // No-op since localStorage is disabled
}

function inWatchlist(item) { 
  return state.watchlist.some(x => x.id === item.id && x.media_type === item.media_type) 
}

function toggleWatchlist(item) {
  const idx = state.watchlist.findIndex(x => x.id === item.id && x.media_type === item.media_type);
  if(idx > -1) { 
    state.watchlist.splice(idx,1); 
    toast('Removed from Watchlist'); 
  } else { 
    state.watchlist.unshift({ 
      id: item.id, 
      media_type: item.media_type, 
      title: titleOf(item), 
      poster: item.poster_path 
    }); 
    toast('Added to Watchlist'); 
  }
  saveLists();
}

function pushHistory(item) {
  const key = item.media_type + ':' + item.id;
  state.history = state.history.filter(x => (x.media_type + ':' + x.id) !== key);
  state.history.unshift({ 
    id: item.id, 
    media_type: item.media_type, 
    title: titleOf(item), 
    poster: item.poster_path, 
    ts: Date.now() 
  });
  state.history = state.history.slice(0, 60);
  saveLists();
}

function titleOf(x) { 
  return x.title || x.name || x.original_title || x.original_name || 'Untitled' 
}

/***********************
 * TMDB API WRAPPER    *
 ***********************/
const API = {
  async get(path, params={}) {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    Object.entries({ language: 'en-US', ...params }).forEach(([k,v]) => url.searchParams.set(k,v));

    let opts = { headers: { Accept: 'application/json' } };
    if (CONFIG.TMDB_KEY.startsWith('eyJ')) {
      opts.headers.Authorization = `Bearer ${CONFIG.TMDB_KEY}`;
    } else {
      url.searchParams.set('api_key', CONFIG.TMDB_KEY);
    }

    const key = url.toString();
    if (state.cache.has(key)) return state.cache.get(key);

    for (let attempt=1; attempt<=2; attempt++) {
      try {
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(`TMDB API error ${res.status}: ${res.statusText}`);
        const data = await res.json();
        state.cache.set(key, data);
        return data;
      } catch(e) {
        console.error(`API request failed (attempt ${attempt}):`, e);
        if (attempt === 2) throw e;
        await sleep(400*attempt);
      }
    }
  },
  genres: {
    movie: () => API.get('/genre/movie/list'),
    tv: () => API.get('/genre/tv/list'),
  },
  trending: () => API.get('/trending/all/week'),
  discover: (type, page=1, extra={}) => API.get(`/discover/${type}`, {
    sort_by: 'popularity.desc',
    page,
    include_adult: 'false',
    with_watch_providers: state.providerIds.join('|'),
    watch_region: CONFIG.REGION,
    ...extra
  }),
  details: (type, id) => API.get(`/${type}/${id}`, { 
    append_to_response: 'videos,credits,similar,watch/providers' 
  }),
  searchMulti: (q, page=1) => API.get('/search/multi', {
    query: q,
    page,
    include_adult: 'false'
  }),
  providerList: () => API.get('/watch/providers/movie', {
    watch_region: CONFIG.REGION
  }),
  providerListTV: () => API.get('/watch/providers/tv', {
    watch_region: CONFIG.REGION
  }),
};

/***********************
 * ROUTER              *
 ***********************/
const routes = {
  '#/home': renderHome,
  '#/movies': (params) => renderCatalog('movie', params),
  '#/tv': (params) => renderCatalog('tv', params),
  '#/watch': renderWatch,
  '#/search': renderSearch,
  '#/watchlist': renderWatchlist,
};

function parseRoute() {
  const [path, query=''] = state.route.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { path, params };
}

function navigate(hash) { 
  location.hash = hash 
}

window.addEventListener('hashchange', () => { 
  state.route = location.hash || '#/home'; 
  tick(); 
});

function setActiveTab() {
  els('[data-tab]').forEach(a => 
    a.classList.toggle('active', location.hash.startsWith(a.getAttribute('href')))
  );
}

async function tick() {
  try {
    setActiveTab();
    const { path, params } = parseRoute();
    const fn = routes[path] || renderHome;
    await ensureProviders();
    await fn(params);
  } catch(e) {
    console.error('Navigation error:', e);
    const app = el('#app');
    app.innerHTML = errorBlock(e);
  }
}

/***********************
 * PAGES               *
 ***********************/
async function renderHome() {
  const app = el('#app');
  app.innerHTML = skeletonHero() + sectionSkeleton('Trending') + 
                 sectionSkeleton('Movies') + sectionSkeleton('TV');
  try {
    const [trend, movies, tv] = await Promise.all([
      API.trending(),
      API.discover('movie', 1),
      API.discover('tv', 1)
    ]);
    const pick = (trend.results||[]).find(x => x.backdrop_path) || 
                (movies.results||[])[0] || (tv.results||[])[0] || {};
    app.innerHTML = [
      hero(pick),
      section('Trending', grid((trend.results||[]))),
      section('Popular Movies', grid((movies.results||[]), 'movie', { showGenres:true })),
      section('Popular TV', grid((tv.results||[]), 'tv', { showGenres:true })),
    ].join('');
    attachInfinite('#home-movies', () => API.discover('movie', ++pages.movie)
      .then(d => (d.results||[])));
    attachInfinite('#home-tv', () => API.discover('tv', ++pages.tv)
      .then(d => (d.results||[])));
  } catch(e) { 
    console.error('Home page error:', e);
    app.innerHTML = errorBlock(e); 
  }
}

const pages = { movie:1, tv:1 };

async function renderCatalog(type, params) {
  const app = el('#app');
  app.innerHTML = sectionSkeleton(`${type === 'movie' ? 'Movies' : 'TV Series'}`);
  try {
    if(!state.genres[type].length) { 
      const genreData = await API.genres[type]();
      state.genres[type] = genreData.genres || []; 
    }
    const filters = filterChips(type);
    const first = await API.discover(type, 1, filterParamsFromUrl(params));
    pages[type] = 1;
    app.innerHTML = [
      headerRow(`${type === 'movie' ? 'Movies' : 'TV Series'}`, filters),
      `<div class="section"><div id="catalog" class="grid">${cards((first.results||[]), type)}</div></div>`
    ].join('');
    attachInfinite('#catalog', async () => {
      const next = await API.discover(type, ++pages[type], filterParamsFromUrl(params));
      return next.results || [];
    }, type);
  } catch(e) { 
    console.error('Catalog error:', e);
    app.innerHTML = errorBlock(e); 
  }
}

function filterParamsFromUrl(params) {
  const withGenres = params.genres || '';
  return withGenres ? { with_genres: withGenres } : {};
}

async function renderWatch(params) {
  const { type='movie', id } = params;
  const app = el('#app');
  if(!id) return navigate('#/home');
  app.innerHTML = sectionSkeleton('Loading…');
  try {
    const data = await API.details(type, id);
    data.media_type = type;
    pushHistory(data);
    const vids = (data.videos?.results||[]).filter(v => v.site === 'YouTube');
    const trailer = vids.find(v => v.type === 'Trailer') || 
                   vids.find(v => v.type === 'Teaser') || vids[0];
    const cast = (data.credits?.cast||[]).slice(0, 12);
    const providers = data['watch/providers']?.results?.[CONFIG.REGION] || {};
    
    // Compose UI
    const player = trailer ? youtubeEmbed(trailer.key) : noTrailer();
    app.innerHTML = [
      `<div class="player-wrap">
         <section class="panel">
           <div class="player" id="player">${player}</div>
           <div class="controls">
             <button class="btn" id="playPauseBtn">Play/Pause</button>
             <button class="btn" id="seekBack">⟲ 10s</button>
             <button class="btn" id="seekFwd">⟳ 10s</button>
             <button class="btn" id="fsBtn">Fullscreen</button>
             <button class="btn" id="watchlistBtn">
               ${inWatchlist(data) ? '★ In Watchlist' : '☆ Add to Watchlist'}
             </button>
             ${(providers.flatrate||[]).length ? 
               `<span class="sub">Available on: ${(providers.flatrate||[])
                 .map(p => p.provider_name).join(', ')}</span>` : ''}
           </div>
         </section>
         <aside class="panel">
           ${detailsBlock(data)}
         </aside>
       </div>
       <div class="section">
         <h2>Cast</h2>
         <div class="cast">${cast.map(actorCard).join('')}</div>
       </div>
       <div class="section">
         <h2>Recommendations</h2>
         <div class="grid">
           ${cards((data.similar?.results||[]).slice(0,18), type)}
         </div>
       </div>`
    ].join('');

    // Controls
    bindPlayerControls(trailer);
    el('#watchlistBtn').addEventListener('click', () => { 
      toggleWatchlist(data); 
      el('#watchlistBtn').textContent = inWatchlist(data) ? 
        '★ In Watchlist' : '☆ Add to Watchlist'; 
    });
  } catch(e) { 
    console.error('Watch page error:', e);
    app.innerHTML = errorBlock(e); 
  }
}

async function renderSearch(params) {
  const q = params.q || '';
  const app = el('#app');
  app.innerHTML = headerRow(`Results for "${q}"`) + sectionSkeleton('');
  try {
    const res = await API.searchMulti(q, 1);
    const items = (res.results||[]).filter(x => 
      x.media_type === 'movie' || x.media_type === 'tv'
    );
    app.innerHTML = headerRow(`Results for "${q}"`, searchTypeChips()) + 
      `<div class="section"><div class="grid">${cards(items)}</div></div>`;
  } catch(e) { 
    console.error('Search error:', e);
    app.innerHTML = errorBlock(e); 
  }
}

function renderWatchlist() {
  const app = el('#app');
  app.innerHTML = headerRow('Your Watchlist') + 
    `<div class="section"><div class="grid">${cards(state.watchlist)}</div></div>` + 
    headerRow('Recently Watched') + 
    `<div class="section"><div class="grid">${cards(state.history)}</div></div>`;
}

/***********************
 * UI HELPERS          *
 ***********************/
function hero(item) {
  if(!item || !item.id) return '';
  const bg = imgUrl(item.backdrop_path, 'w1280');
  return `<section class="hero" style="background-image:linear-gradient(100deg, rgba(0,0,0,.75) 10%, rgba(0,0,0,.1)), url('${bg}')">
    <div class="hero-inner">
      <div class="chips" style="margin-bottom:8px">
        ${badge(item.media_type || (item.title ? 'movie' : 'tv'))}
      </div>
      <h1>${titleOf(item)}</h1>
      <p>${(item.overview||'').slice(0,220)}${(item.overview||'').length>220?'…':''}</p>
      <div style="margin-top:10px; display:flex; gap:8px">
        <a class="btn primary" href="#/watch?type=${item.media_type || (item.title?'movie':'tv')}&id=${item.id}">
          Play trailer
        </a>
        <a class="btn" href="#/${item.media_type || (item.title?'movie':'tv')==='movie'?'movies':'tv'}">
          Browse more
        </a>
      </div>
    </div>
  </section>`
}

function badge(type) { 
  return `<span class="chip">${type === 'movie' ? 'Movie' : 'TV'}</span>` 
}

function card(x) {
  if(!x || !x.id) return '';
  const type = x.media_type || (x.title ? 'movie' : 'tv');
  const poster = imgUrl(x.poster_path || x.profile_path, 'w342');
  return `<a class="card" href="#/watch?type=${type}&id=${x.id}" aria-label="Open ${titleOf(x)}">
    <div class="thumb ${!poster?'skeleton':''}">${poster? 
      `<img loading="lazy" src="${poster}" alt="${titleOf(x)} poster">`:''}
      ${x.vote_average? `<span class='rating'>★ ${(x.vote_average).toFixed(1)}</span>`:''}
      <div class="hover">
        <div class="title">${titleOf(x)}</div>
        <div class="sub">${(x.release_date||x.first_air_date||'').slice(0,4)} • ${type.toUpperCase()}</div>
      </div>
    </div>
    <div class="meta">
      <div class="title">${titleOf(x)}</div>
      <div class="sub">${(x.release_date||x.first_air_date||'').slice(0,4)}</div>
    </div>
  </a>`
}

function cards(items, type, opts={}) { 
  const validItems = Array.isArray(items) ? items.filter(x => x && x.id) : [];
  return validItems.map(x => card({ ...x, media_type: x.media_type||type })).join('');
}

function grid(items, type, opts={}) { 
  return `<div class="grid" id="home-${type||'mix'}">${cards(items, type, opts)}</div>` 
}

function section(title, content) { 
  return `<div class="section"><h2>${title}</h2>${content}</div>` 
}

function headerRow(title, right='') { 
  return `<div class="section" style="display:flex; justify-content:space-between; align-items:center; gap:10px">
    <h2 style="margin:0">${title}</h2><div>${right}</div></div>` 
}

function filterChips(type) {
  const chips = (state.genres[type]||[])
    .map(g => `<button class="chip" data-genre="${g.id}">${g.name}</button>`)
    .join('');
  const wrap = `<div class="chips">${chips}</div>`;
  setTimeout(() => {
    els('[data-genre]').forEach(btn => btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const ids = els('[data-genre].active')
        .map(b => b.getAttribute('data-genre')).join(',');
      const base = `#/${type === 'movie' ? 'movies' : 'tv'}`;
      navigate(`${base}?genres=${ids}`);
    }));
    // Pre-activate from URL
    const { params } = parseRoute();
    const act = (params.genres||'').split(',');
    els('[data-genre]').forEach(b => 
      b.classList.toggle('active', act.includes(b.getAttribute('data-genre')))
    );
  }, 0);
  return wrap;
}

function searchTypeChips() {
  const map = [['all','All'],['movie','Movies'],['tv','TV']];
  return `<div class="chips">${map.map(([k,v]) => 
    `<button class="chip" data-type="${k}">${v}</button>`).join('')}</div>`;
}

function detailsBlock(d) {
  const date = (d.release_date||d.first_air_date||'').slice(0,10);
  const rt = d.runtime || (d.episode_run_time||[])[0];
  const seasons = d.number_of_seasons;
  const eps = d.number_of_episodes;
  const providers = d['watch/providers']?.results?.[CONFIG.REGION] || {};
  const poster = imgUrl(d.poster_path, 'w342');
  
  return `<div class="two-col">
    <div>
      ${poster? `<img src="${poster}" alt="${titleOf(d)} poster" 
        style="border-radius:12px; border:1px solid var(--ring)">`:''}
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
        ${(providers.flatrate||[]).map(p => 
          `<a class="btn" target="_blank" rel="noopener" href="${providers.link||'#'}">
            Watch on ${p.provider_name}
          </a>`).join('') || '<span class="sub">No streaming providers available</span>'}
      </div>
    </div>
    <div>
      <h3 style="margin-top:0">${titleOf(d)}</h3>
      <div class="sub" style="margin:6px 0">
        ${date}${rt? ' • '+rt+' min':''}${seasons? ' • '+seasons+' seasons':''}
        ${eps? ' • '+eps+' episodes':''}
      </div>
      <div style="margin:8px 0">
        ${(d.genres||[]).map(g => `<span class="chip">${g.name}</span>`).join(' ')}
      </div>
      <p>${d.overview||'No synopsis.'}</p>
    </div>
  </div>`
}

function actorCard(a) {
  const img = imgUrl(a.profile_path, 'w185') || '';
  return `<div class="actor">
    <img src="${img}" alt="${a.name}">
    <div>
      <div class="title" style="font-size:.9rem">${a.name}</div>
      <div class="sub">${a.character||''}</div>
    </div>
  </div>`
}

function youtubeEmbed(key) {
  return `<iframe id="yt" 
    src="https://www.youtube-nocookie.com/embed/${key}?autoplay=0&rel=0&modestbranding=1" 
    title="Trailer" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>`
}

function noTrailer() { 
  return `<div class="skeleton" style="width:100%; height:100%; display:grid; place-items:center">
    <span class="sub">No trailer available</span>
  </div>` 
}

function skeletonHero() { 
  return `<section class="hero skeleton" style="min-height:320px"></section>` 
}

function sectionSkeleton(title) { 
  return `<div class="section">
    <h2>${title}</h2>
    <div class="grid">${Array.from({length:12})
      .map(() => `<div class='card'>
        <div class='thumb skeleton'></div>
        <div class='meta'><div class='skeleton'></div></div>
      </div>`).join('')}
    </div>
  </div>` 
}

function errorBlock(e) { 
  return `<div class="panel" role="alert">
    ⚠️ Something went wrong. ${e?.message||e}. Check your API key and network, then retry.
  </div>` 
}

/***********************
 * INFINITE SCROLL     *
 ***********************/
function attachInfinite(gridSel, fetchMore, type) {
  const grid = el(gridSel);
  if(!grid) return;
  
  const sentinel = document.createElement('div');
  sentinel.className = 'sub'; 
  sentinel.textContent = 'Loading more…';
  grid.after(sentinel);
  
  let busy = false;
  const io = new IntersectionObserver(async entries => {
    if(entries.some(e => e.isIntersecting) && !busy) {
      busy = true;
      try { 
        const next = await fetchMore(); 
        if(next && next.length) { 
          grid.insertAdjacentHTML('beforeend', cards(next, type)); 
        } else { 
          sentinel.textContent = 'End of results.'; 
          io.disconnect(); 
        } 
      } catch(e) { 
        console.error('Infinite scroll error:', e);
      }
      busy = false;
    }
  }, { rootMargin: '1200px 0px' });
  
  io.observe(sentinel);
}

/***********************
 * SEARCH SUGGESTIONS  *
 ***********************/
const qInput = el('#q');
const suggest = el('#suggest');
let suggestCtrl = { timer: null };

qInput.addEventListener('input', () => debounceSuggest());
qInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') {
    navigate(`#/search?q=${encodeURIComponent(qInput.value.trim())}`);
    suggest.classList.remove('show');
  }
});

document.addEventListener('keydown', (e) => {
  if(e.key === '/' && document.activeElement !== qInput) {
    e.preventDefault();
    qInput.focus();
  }
});

function debounceSuggest() {
  clearTimeout(suggestCtrl.timer);
  const q = qInput.value.trim();
  if(!q) {
    suggest.classList.remove('show');
    suggest.innerHTML = '';
    return;
  }
  
  suggestCtrl.timer = setTimeout(async () => {
    try {
      const res = await API.searchMulti(q, 1);
      const list = (res.results||[])
        .filter(x => x.media_type === 'movie' || x.media_type === 'tv')
        .slice(0,7);
        
      if(!list.length) {
        suggest.innerHTML = `<div class='suggest-empty'>No matches</div>`;
        suggest.classList.add('show');
        return;
      }
      
      suggest.innerHTML = list.map(x => {
        const poster = imgUrl(x.poster_path, 'w92');
        return `<div class='suggest-item' data-link="#/watch?type=${x.media_type}&id=${x.id}">
          <img src='${poster}' alt=''>
          <div>
            <div class='title'>${titleOf(x)}</div>
            <div class='sub'>
              ${x.media_type.toUpperCase()} • 
              ${(x.release_date||x.first_air_date||'').slice(0,4)}
            </div>
          </div>
        </div>`
      }).join('');
      
      suggest.classList.add('show');
      els('.suggest-item', suggest).forEach(item => 
        item.addEventListener('click', () => {
          navigate(item.getAttribute('data-link'));
          suggest.classList.remove('show');
          qInput.value = '';
        })
      );
    } catch(e) { 
      console.error('Search suggestions error:', e);
    }
  }, 200);
}

document.addEventListener('click', (e) => {
  if(!suggest.contains(e.target) && e.target !== qInput) {
    suggest.classList.remove('show');
  }
});

/***********************
 * PLAYER CONTROLS     *
 ***********************/
function bindPlayerControls(trailer) {
  const iframe = el('#yt');
  const asVideo = null; // reserved for native video element in future

  function requestFS() { 
    const p = el('#player'); 
    if(p.requestFullscreen) p.requestFullscreen(); 
    else if(p.webkitRequestFullscreen) p.webkitRequestFullscreen(); 
  }

  function post(cmd) { 
    if(iframe) {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event:'command', func: cmd }), '*'
      ); 
    }
  }

  el('#fsBtn')?.addEventListener('click', requestFS);
  el('#playPauseBtn')?.addEventListener('click', () => post('playVideo'));
  el('#seekBack')?.addEventListener('click', () => post('seekTo'));
  el('#seekFwd')?.addEventListener('click', () => post('seekTo'));

  document.addEventListener('keydown', (e) => {
    if(!el('#player')) return;
    if(e.code === 'Space') { e.preventDefault(); post('playVideo'); }
    if(e.code === 'ArrowLeft') { post('seekTo'); }
    if(e.code === 'ArrowRight') { post('seekTo'); }
    if(e.key === 'f' || e.key === 'F') { requestFS(); }
  });
}

/***********************
 * FIRST RUN HELPER    *
 ***********************/
(function firstRun() {
  document.addEventListener('keydown', (e) => {
    if(e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const k = prompt('Enter your TMDB API v4 Bearer token (or v3 key):', CONFIG.TMDB_KEY);
      if(k) { setKey(k); toast('API key saved'); tick(); }
    }
    if(e.key === 'r' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const r = prompt('Enter your region code (e.g., US, GB, PH):', CONFIG.REGION);
      if(r) { setRegion(r.toUpperCase()); toast('Region updated'); tick(); }
    }
  });
})();

// Initialize app
async function ensureProviders() {
  if(state.providerIds.length) return state.providerIds;
  try {
    const [m, t] = await Promise.all([API.providerList(), API.providerListTV()]);
    const all = [...(m.results||[]), ...(t.results||[])];
    const picked = new Map();
    for(const p of all) {
      const name = (p.provider_name||'').toLowerCase();
      if(CONFIG.PROVIDER_NAMES.some(n => name.includes(n.toLowerCase()))) {
        picked.set(p.provider_id, p.provider_name);
      }
    }
    state.providerIds = [...picked.keys()];
    return state.providerIds;
  } catch(e) {
    console.warn('Provider resolve failed', e);
    state.providerIds = [];
    return [];
  }
}

// Set theme and start app
setTheme(state.theme);
tick();
