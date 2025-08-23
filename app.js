/***********************
 * CONFIG & CONSTANTS  *
 ***********************/
const CONFIG = {
  TMDB_KEY: '8b38fdbfc051bcd57c89da7fc2e5bdef',
  REGION: 'US',
  IMAGE_BASE: 'https://image.tmdb.org/t/p/',
  PROVIDER_NAMES: ['Netflix','Amazon Prime','Amazon Prime Video','Disney','Disney+','HBO Max','Max','Hulu','Apple TV+','Paramount+','Paramount Plus']
};

const MOVIE_ENDPOINTS = [
  'https://vidlink.pro/movie/',
  'https://vidsrc.dev/embed/movie/',
  'https://111movies.com/movie/',
  'https://vidjoy.pro/embed/movie/',
  'https://vidsrc.io/embed/movie/',
  'https://vidsrc.cc/v2/embed/movie/',
  'https://vidsrc.xyz/embed/movie/',
  'https://www.2embed.cc/embed/',
  'https://moviesapi.club/movie/'
];

const SERIES_ENDPOINTS = [
  'https://vidsrc.vip/embed/tv/',
  'https://111movies.com/tv/',
  'https://vidlink.pro/tv/',
  'https://vidsrc.dev/embed/tv/',
  'https://vidjoy.pro/embed/tv/',
  'https://vidsrc.me/embed/tv/',
  'https://vidsrc.cc/v2/embed/tv/',
  'https://vidsrc.xyz/embed/tv/',
  'https://www.2embed.cc/embedtvfull/'
];

/***********************
 * STATE MANAGEMENT    *
 ***********************/
const state = {
  theme: 'dark',
  route: location.hash || '#/home',
  genres: { movie: [], tv: [] },
  providerIds: [],
  cache: new Map(),
  watchlist: [],
  history: [],
  currentServer: 0,
  currentSeason: 1,
  currentEpisode: 1,
  loadingVideo: false
};

/***********************
 * ROUTING & NAVIGATION*
 ***********************/
function parseHash() {
  const [path, qs] = (location.hash || '#/home').slice(1).split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path, params };
}

function navigate(to) {
  location.hash = to;
}

async function tick() {
  const { path, params } = parseHash();
  
  // Update active tab
  els('[data-tab]').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('href') === location.hash);
  });
  
  // Route to page
  switch(path) {
    case '/home':
      await renderHome();
      break;
    case '/movies':
      await renderDiscover('movie');
      break;
    case '/tv':
      await renderDiscover('tv');
      break;
    case '/watch':
      await renderWatch(params);
      break;
    case '/watchlist':
      await renderWatchlist();
      break;
    default:
      navigate('#/home');
  }
}

/***********************
 * LOADING STATES     *
 ***********************/
function skeletonHero() {
  return `<div class="hero skeleton"></div>`;
}

function sectionSkeleton(title) {
  return `
    <div class="section">
      <h2>${title}</h2>
      <div class="grid">
        ${Array(6).fill('<div class="card"><div class="thumb skeleton"></div></div>').join('')}
      </div>
    </div>
  `;
}

function errorBlock(error) {
  return `
    <div style="text-align:center; padding:40px;">
      <h2>Error</h2>
      <p style="color:var(--muted)">${error.message}</p>
    </div>
  `;
}

/***********************
 * DETAILS BLOCK      *
 ***********************/
function detailsBlock(data) {
  const providers = data['watch/providers']?.results?.[CONFIG.REGION]?.flatrate || [];
  const genres = data.genres || [];
  
  return `
    <h2>${titleOf(data)}</h2>
    <div class="meta-row" style="margin:8px 0">
      ${data.release_date || data.first_air_date ? 
        `<span>${(data.release_date || data.first_air_date).slice(0,4)}</span> • ` : ''}
      ${data.runtime ? `<span>${data.runtime} min</span> • ` : ''}
      ${data.number_of_seasons ? 
        `<span>${data.number_of_seasons} Season${data.number_of_seasons>1?'s':''}</span> • ` : ''}
      ${data.vote_average ? 
        `<span>★ ${data.vote_average.toFixed(1)}</span>` : ''}
    </div>
    
    ${genres.length ? `
      <div class="chips" style="margin:12px 0">
        ${genres.map(g => `<span class="chip">${g.name}</span>`).join('')}
      </div>
    ` : ''}
    
    <p style="margin:12px 0; color:var(--muted)">${data.overview || ''}</p>
    
    ${providers.length ? `
      <div style="margin:12px 0">
        <h3 style="font-size:0.9rem; margin-bottom:8px">Available on</h3>
        <div class="chips">
          ${providers.map(p => `
            <span class="chip">
              <img src="${imgUrl(p.logo_path,'w45')}" 
                   alt="${p.provider_name}" 
                   style="width:20px;height:20px;border-radius:4px;vertical-align:middle"> 
              ${p.provider_name}
            </span>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

/***********************
 * DISCOVER PAGE      *
 ***********************/
async function renderDiscover(type) {
  const app = el('#app');
  app.innerHTML = sectionSkeleton(`Popular ${type === 'movie' ? 'Movies' : 'TV Shows'}`);
  
  try {
    const data = await API.discover(type);
    const items = data.results || [];
    
    app.innerHTML = `
      <div class="section">
        <h2>Popular ${type === 'movie' ? 'Movies' : 'TV Shows'}</h2>
        ${grid(items, type)}
      </div>
    `;
  } catch(e) {
    console.error('Discover page error:', e);
    app.innerHTML = errorBlock(e);
  }
}

/***********************
 * SEARCH             *
 ***********************/
let searchTimeout;
const suggest = el('#suggest');

el('#q').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  
  if(!q) {
    suggest.classList.remove('show');
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      const data = await API.searchMulti(q);
      const items = (data.results || [])
        .filter(x => x.media_type !== 'person')
        .slice(0, 6);
        
      if(!items.length) {
        suggest.innerHTML = `<div class="suggest-empty">No results found</div>`;
      } else {
        suggest.innerHTML = items.map(x => `
          <a class="suggest-item" href="#/watch?type=${x.media_type}&id=${x.id}">
            <img src="${imgUrl(x.poster_path,'w92')}" alt="">
            <div>
              <div class="title">${titleOf(x)}</div>
              <div class="sub">
                ${x.media_type === 'movie' ? 'Movie' : 'TV'} • 
                ${(x.release_date || x.first_air_date || '').slice(0,4)}
              </div>
            </div>
          </a>
        `).join('');
      }
      
      suggest.classList.add('show');
    } catch(e) {
      console.error('Search error:', e);
    }
  }, 300);
});

document.addEventListener('click', e => {
  if(!suggest.contains(e.target) && e.target !== el('#q')) {
    suggest.classList.remove('show');
  }
});

// Theme toggle
el('#themeBtn').addEventListener('click', () => {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
});

/***********************
 * WATCHLIST PAGE     *
 ***********************/
async function renderWatchlist() {
  const app = el('#app');
  
  if(!state.watchlist.length) {
    app.innerHTML = `
      <div style="text-align:center; padding:40px;">
        <h2>Your watchlist is empty</h2>
        <p style="color:var(--muted)">Add movies and TV shows to keep track of what you want to watch.</p>
      </div>
    `;
    return;
  }
  
  app.innerHTML = `
    <div class="section">
      <h2>Your Watchlist</h2>
      ${grid(state.watchlist)}
    </div>
  `;
        }

/***********************
 * UTILITY FUNCTIONS   *
 ***********************/
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

function imgUrl(path, size='w342') {
  return path ? `${CONFIG.IMAGE_BASE}${size}${path}` : '';
}

function titleOf(x) {
  return x.title || x.name || x.original_title || x.original_name || 'Untitled';
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
  })
};

/***********************
 * WATCHLIST MANAGEMENT*
 ***********************/
function inWatchlist(item) {
  return state.watchlist.some(x => x.id === item.id && x.media_type === item.media_type);
}

function toggleWatchlist(item) {
  const idx = state.watchlist.findIndex(x => x.id === item.id && x.media_type === item.media_type);
  if(idx > -1) {
    state.watchlist.splice(idx, 1);
    toast('Removed from Watchlist');
  } else {
    state.watchlist.unshift({
      id: item.id,
      media_type: item.media_type,
      title: titleOf(item),
      poster: item.poster_path,
      timestamp: Date.now()
    });
    toast('Added to Watchlist');
  }
}

function pushHistory(item) {
  const key = item.media_type + ':' + item.id;
  state.history = state.history.filter(x => (x.media_type + ':' + x.id) !== key);
  state.history.unshift({
    id: item.id,
    media_type: item.media_type,
    title: titleOf(item),
    poster: item.poster_path,
    timestamp: Date.now()
  });
  state.history = state.history.slice(0, 60);
}

/***********************
 * VIDEO PLAYER        *
 ***********************/
function videoEmbed(data) {
  const { id, media_type } = data;
  const endpoints = media_type === 'movie' ? MOVIE_ENDPOINTS : SERIES_ENDPOINTS;
  const currentUrl = endpoints[state.currentServer];
  
  let embedUrl = currentUrl + id;
  if (media_type === 'tv') {
    embedUrl += `/${state.currentSeason}/${state.currentEpisode}`;
  }
  
  return `
    <div class="player-container ${state.loadingVideo ? 'loading' : ''}">
      <iframe
        id="videoPlayer"
        src="${embedUrl}"
        allowfullscreen
        allow="fullscreen"
        loading="lazy"
        style="width:100%;height:100%;border:none;">
      </iframe>
      ${state.loadingVideo ? '<div class="loading-overlay">Loading video...</div>' : ''}
    </div>
  `;
}

function serverSelector(type) {
  const endpoints = type === 'movie' ? MOVIE_ENDPOINTS : SERIES_ENDPOINTS;
  return `
    <div class="select-group">
      <label>Server</label>
      <select class="select" id="serverSelect">
        ${endpoints.map((_, i) => `
          <option value="${i}" ${i === state.currentServer ? 'selected' : ''}>
            Server ${i + 1}
          </option>
        `).join('')}
      </select>
    </div>
  `;
}

function episodeSelector(data) {
  if (!data.seasons) return '';
  
  const currentSeason = data.seasons.find(s => s.season_number === state.currentSeason) || data.seasons[0];
  const episodeCount = currentSeason?.episode_count || 1;
  
  return `
    <div class="episode-controls">
      <div class="select-group">
        <label>Season</label>
        <select class="select" id="seasonSelect">
          ${data.seasons.map(s => `
            <option value="${s.season_number}" 
              ${s.season_number === state.currentSeason ? 'selected' : ''}>
              Season ${s.season_number} (${s.episode_count} Episodes)
            </option>
          `).join('')}
        </select>
      </div>
      
      <div class="select-group">
        <label>Episode</label>
        <select class="select" id="episodeSelect">
          ${Array.from({length: episodeCount}, (_, i) => `
            <option value="${i + 1}" ${i + 1 === state.currentEpisode ? 'selected' : ''}>
              Episode ${i + 1}
            </option>
          `).join('')}
        </select>
      </div>
    </div>
  `;
}

/***********************
 * UI COMPONENTS      *
 ***********************/
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

function cards(items, type) {
  return (Array.isArray(items) ? items : [])
    .filter(x => x && x.id)
    .map(x => card({ ...x, media_type: x.media_type || type }))
    .join('');
}

function grid(items, type) {
  return `<div class="grid" id="home-${type||'mix'}">${cards(items, type)}</div>`;
}

function hero(item) {
  if(!item || !item.id) return '';
  const bg = imgUrl(item.backdrop_path, 'w1280');
  return `<section class="hero" style="background-image:linear-gradient(100deg, rgba(0,0,0,.75) 10%, rgba(0,0,0,.1)), url('${bg}')">
    <div class="hero-inner">
      <div class="chips">
        ${badge(item.media_type || (item.title ? 'movie' : 'tv'))}
      </div>
      <h1>${titleOf(item)}</h1>
      <p>${(item.overview||'').slice(0,220)}${(item.overview||'').length>220?'…':''}</p>
      <div style="margin-top:10px; display:flex; gap:8px">
        <a class="btn primary" href="#/watch?type=${item.media_type || (item.title?'movie':'tv')}&id=${item.id}">
          Watch Now
        </a>
      </div>
    </div>
  </section>`;
}

function badge(type) {
  return `<span class="chip">${type === 'movie' ? 'Movie' : 'TV'}</span>`;
}

function section(title, content) {
  return `<div class="section"><h2>${title}</h2>${content}</div>`;
}

function headerRow(title, right='') {
  return `<div class="section header-row">
    <h2>${title}</h2>
    <div>${right}</div>
  </div>`;
}

function actorCard(a) {
  const img = imgUrl(a.profile_path, 'w185') || '';
  return `<div class="actor">
    <img src="${img}" alt="${a.name}" loading="lazy">
    <div>
      <div class="title">${a.name}</div>
      <div class="sub">${a.character||''}</div>
    </div>
  </div>`;
}

/***********************
 * PAGE RENDERING     *
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
      section('Popular Movies', grid((movies.results||[]), 'movie')),
      section('Popular TV', grid((tv.results||[]), 'tv')),
    ].join('');
  } catch(e) {
    console.error('Home page error:', e);
    app.innerHTML = errorBlock(e);
  }
}

async function renderWatch(params) {
  const { type = 'movie', id } = params;
  const app = el('#app');
  if(!id) return navigate('#/home');
  app.innerHTML = sectionSkeleton('Loading…');
  
  try {
    const data = await API.details(type, id);
    data.media_type = type;
    pushHistory(data);
    
    const player = videoEmbed(data);
    const controls = type === 'tv' ? episodeSelector(data) : '';
    
    app.innerHTML = [
      `<div class="player-wrap">
         <section class="panel">
           <div class="player" id="player">${player}</div>
           <div class="controls">
             <div class="controls-primary">
               ${serverSelector(type)}
               ${controls}
             </div>
             <div class="controls-secondary">
               <button class="btn" id="fsBtn">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                 </svg>
               </button>
               <button class="btn" id="watchlistBtn">
                 ${inWatchlist(data) ? '★ In Watchlist' : '☆ Add to Watchlist'}
               </button>
             </div>
           </div>
         </section>
         <aside class="panel">
           ${detailsBlock(data)}
         </aside>
       </div>`,
      type === 'tv' ? `
        <div class="section">
          <h2>Episodes</h2>
          <div class="seasons-grid">
            ${data.seasons?.map(season => `
              <div class="season-card ${season.season_number === state.currentSeason ? 'active' : ''}">
                <div class="season-card-inner">
                  <h3>Season ${season.season_number}</h3>
                  <div class="episode-count">${season.episode_count} Episodes</div>
                  <button class="btn" data-season="${season.season_number}">
                    Watch Season ${season.season_number}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '',
      `<div class="section">
         <h2>Cast</h2>
         <div class="cast">
           ${(data.credits?.cast || []).slice(0, 12).map(actorCard).join('')}
         </div>
       </div>
       <div class="section">
         <h2>Similar Titles</h2>
         <div class="grid">
           ${cards((data.similar?.results || []).slice(0, 12), type)}
         </div>
       </div>`
    ].join('');

    // Bind all controls
    bindPlayerControls(data);
    
  } catch(e) {
    console.error('Watch page error:', e);
    app.innerHTML = errorBlock(e);
  }
}

function bindPlayerControls(data) {
  // Server selection
  el('#serverSelect')?.addEventListener('change', async (e) => {
    state.loadingVideo = true;
    state.currentServer = parseInt(e.target.value);
    el('#player').innerHTML = videoEmbed(data);
    await sleep(500);
    state.loadingVideo = false;
    el('#player').innerHTML = videoEmbed(data);
  });

  // Season selection
  el('#seasonSelect')?.addEventListener('change', async (e) => {
    state.loadingVideo = true;
    state.currentSeason = parseInt(e.target.value);
    updateEpisodeSelect(data);
    el('#player').innerHTML = videoEmbed(data);
    await sleep(500);
    state.loadingVideo = false;
    el('#player').innerHTML = videoEmbed(data);
  });

  // Episode selection
  el('#episodeSelect')?.addEventListener('change', async (e) => {
    state.loadingVideo = true;
    state.currentEpisode = parseInt(e.target.value);
    el('#player').innerHTML = videoEmbed(data);
    await sleep(500);
    state.loadingVideo = false;
    el('#player').innerHTML = videoEmbed(data);
  });

  // Season card buttons
  els('[data-season]').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.loadingVideo = true;
      state.currentSeason = parseInt(btn.dataset.season);
      state.currentEpisode = 1;
      if (el('#seasonSelect')) el('#seasonSelect').value = state.currentSeason;
      updateEpisodeSelect(data);
      el('#player').innerHTML = videoEmbed(data);
      await sleep(500);
      state.loadingVideo = false;
      el('#player').innerHTML = videoEmbed(data);
      
      els('.season-card').forEach(card => 
        card.classList.toggle('active', 
          card.querySelector('[data-season]').dataset.season === state.currentSeason.toString())
      );
    });
  });

  // Fullscreen
  el('#fsBtn')?.addEventListener('click', () => {
    const player = el('#player');
    if (!player) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      player.requestFullscreen().catch(console.error);
    }
  });

  // Watchlist
  el('#watchlistBtn')?.addEventListener('click', () => {
    toggleWatchlist(data);
    el('#watchlistBtn').textContent = inWatchlist(data) ? '★ In Watchlist' : '☆ Add to Watchlist';
  });
}

function updateEpisodeSelect(data) {
  const episodeSelect = el('#episodeSelect');
  if (!episodeSelect || !data.seasons) return;
  
  const currentSeason = data.seasons.find(s => s.season_number === state.currentSeason);
  const episodeCount = currentSeason?.episode_count || 1;
  
  episodeSelect.innerHTML = Array.from({length: episodeCount}, (_, i) => `
    <option value="${i + 1}" ${i + 1 === state.currentEpisode ? 'selected' : ''}>
      Episode ${i + 1}
    </option>
  `).join('');
}

/***********************
 * INITIALIZATION      *
 ***********************/
document.addEventListener('DOMContentLoaded', () => {
  setTheme(state.theme);
  tick();
});

window.addEventListener('hashchange', () => {
  state.route = location.hash || '#/home';
  tick();
});

// First run setup
(function firstRun() {
  document.addEventListener('keydown', (e) => {
    if(e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const k = prompt('Enter your TMDB API key:', CONFIG.TMDB_KEY);
      if(k) { CONFIG.TMDB_KEY = k; toast('API key saved'); tick(); }
    }
    if(e.key === 'r' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const r = prompt('Enter your region code (e.g., US, GB):', CONFIG.REGION);
      if(r) { CONFIG.REGION = r.toUpperCase(); toast('Region updated'); tick(); }
    }
  });
})();
