/***********************
 * CONFIG & CONSTANTS  *
 ***********************/
const CONFIG = {
  TMDB_KEY: '8b38fdbfc051bcd57c89da7fc2e5bdef',
  REGION: 'US',
  IMAGE_BASE: 'https://image.tmdb.org/t/p/',
  PROVIDER_NAMES: [
    'Netflix',
    'Amazon Prime',
    'Amazon Prime Video',
    'Disney',
    'Disney+',
    'HBO Max',
    'Max',
    'Hulu',
    'Apple TV+',
    'Paramount+',
    'Paramount Plus'
  ]
};

const MOVIE_ENDPOINTS = [
  'https://111movies.com/movie/',
  'https://vidlink.pro/movie/',
  'https://player.videasy.net/movie/',
  'https://vidjoy.pro/embed/movie/',
  'https://vidsrc.io/embed/movie/',
  'https://vidsrc.cc/v2/embed/movie/',
  'https://embed.su/embed/movie/',
  'https://vidrock.net/movie/',
  'https://moviesapi.club/movie/'
];

const SERIES_ENDPOINTS = [
  'https://111movies.com/tv/',
  'https://vidlink.pro/tv/',
  'https://player.videasy.net/tv/',
  'https://vidrock.net/tv/',
  'https://vidjoy.pro/embed/tv/',
  'https://vidsrc.io/embed/tv/',
  'https://vidsrc.cc/v2/embed/tv/',
  'https://embed.su/embed/tv/'
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
 * UTILITY FUNCTIONS   *
 ***********************/
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const el = (sel, parent = document) => parent.querySelector(sel);
const els = (sel, parent = document) => [...parent.querySelectorAll(sel)];
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

function toast(msg) {
  const t = el('#toast');
  if (t) {
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }
}

function setTheme(mode) {
  state.theme = mode;
  if (mode === 'light') document.documentElement.classList.add('light');
  else document.documentElement.classList.remove('light');
}

function imgUrl(path, size = 'w342') {
  return path ? `${CONFIG.IMAGE_BASE}${size}${path}` : '';
}

function titleOf(x) {
  return x.title || x.name || x.original_title || x.original_name || 'Untitled';
}

/***********************
 * TMDB API WRAPPER    *
 ***********************/
const API = {
  async get(path, params = {}) {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    Object.entries({ language: 'en-US', ...params })
      .forEach(([k, v]) => url.searchParams.set(k, v));

    let opts = { headers: { Accept: 'application/json' } };
    if (CONFIG.TMDB_KEY.startsWith('eyJ')) {
      opts.headers.Authorization = `Bearer ${CONFIG.TMDB_KEY}`;
    } else {
      url.searchParams.set('api_key', CONFIG.TMDB_KEY);
    }

    const key = url.toString();
    if (state.cache.has(key)) return state.cache.get(key);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(`TMDB API error ${res.status}: ${res.statusText}`);
        const data = await res.json();
        state.cache.set(key, data);
        return data;
      } catch (e) {
        console.error(`API request failed (attempt ${attempt}):`, e);
        if (attempt === 2) throw e;
        await sleep(400 * attempt);
      }
    }
  },

  genres: {
    movie: () => API.get('/genre/movie/list'),
    tv: () => API.get('/genre/tv/list'),
  },

  trending: (page = 1) => API.get('/trending/all/week', { page }),

  discover: (type, page = 1, extra = {}) => API.get(`/discover/${type}`, {
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

  searchMulti: (q, page = 1) => API.get('/search/multi', {
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
 * UI COMPONENTS       *
 ***********************/
function card(x) {
  if (!x || !x.id) return '';
  const type = x.media_type || (x.title ? 'movie' : 'tv');
  const poster = imgUrl(x.poster_path || x.profile_path, 'w342');
  return `<a class="card" href="#/watch?type=${type}&id=${x.id}" aria-label="Open ${titleOf(x)}">
    <div class="thumb ${!poster ? 'skeleton' : ''}">${poster ?
      `<img loading="lazy" src="${poster}" alt="${titleOf(x)} poster">` : ''}
      ${x.vote_average ? `<span class='rating'>★ ${(x.vote_average).toFixed(1)}</span>` : ''}
      <div class="hover">
        <div class="title">${titleOf(x)}</div>
        <div class="sub">${(x.release_date || x.first_air_date || '').slice(0, 4)} • ${type.toUpperCase()}</div>
      </div>
    </div>
    <div class="meta">
      <div class="title">${titleOf(x)}</div>
      <div class="sub">${(x.release_date || x.first_air_date || '').slice(0, 4)}</div>
    </div>
  </a>`;
}

function cards(items, type) {
  return (Array.isArray(items) ? items : [])
    .filter(x => x && x.id)
    .map(x => card({ ...x, media_type: x.media_type || type }))
    .join('');
}

function grid(items, type) {
  return `<div class="grid" id="home-${type || 'mix'}">${cards(items, type)}</div>`;
}

function hero(item) {
  if (!item || !item.id) return '';
  
  let bgImage;
  if (window.matchMedia('(max-width: 768px)').matches) {
    bgImage = item.poster_path ? 
      imgUrl(item.poster_path, 'w780') : 
      imgUrl(item.backdrop_path, 'w780');
  } else {
    bgImage = item.backdrop_path ? 
      imgUrl(item.backdrop_path, 'w1280') : 
      imgUrl(item.poster_path, 'w1280');
  }

  return `<section class="hero" style="background-image:linear-gradient(100deg, rgba(0,0,0,.75) 10%, rgba(0,0,0,.1)), url('${bgImage}')">
    <div class="hero-inner">
      <div class="chips">
        ${badge(item.media_type || (item.title ? 'movie' : 'tv'))}
      </div>
      <h1>${titleOf(item)}</h1>
      <p>${(item.overview || '').slice(0, 220)}${(item.overview || '').length > 220 ? '…' : ''}</p>
      <div style="margin-top:10px; display:flex; gap:8px">
        <a class="btn primary" href="#/watch?type=${item.media_type || (item.title ? 'movie' : 'tv')}&id=${item.id}">
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

function actorCard(a) {
  const img = imgUrl(a.profile_path, 'w185') || '';
  return `<div class="actor">
    <img src="${img}" alt="${a.name}" loading="lazy">
    <div>
      <div class="title">${a.name}</div>
      <div class="sub">${a.character || ''}</div>
    </div>
  </div>`;
}

/***********************
 * WATCHLIST & HISTORY *
 ***********************/
function inWatchlist(item) {
  if (!item || !item.id) return false;
  return state.watchlist.some(x => x.id === item.id);
}

function toggleWatchlist(item) {
  if (!item || !item.id) return;
  
  const idx = state.watchlist.findIndex(x => x.id === item.id);
  
  if (idx > -1) {
    state.watchlist.splice(idx, 1);
    toast('Removed from Watchlist');
  } else {
    const watchlistItem = {
      id: item.id,
      media_type: item.media_type || (item.title ? 'movie' : 'tv'),
      title: titleOf(item),
      poster_path: item.poster_path,
      release_date: item.release_date || item.first_air_date,
      vote_average: item.vote_average,
      timestamp: Date.now()
    };
    state.watchlist.unshift(watchlistItem);
    toast('Added to Watchlist');
  }
  
  saveToLocalStorage();
}

function pushHistory(item) {
  const key = item.media_type + ':' + item.id;
  state.history = state.history.filter(x => (x.media_type + ':' + x.id) !== key);
  state.history.unshift({
    id: item.id,
    media_type: item.media_type,
    title: titleOf(item),
    poster_path: item.poster_path,
    timestamp: Date.now()
  });
  state.history = state.history.slice(0, 60);
  saveToLocalStorage();
}

function saveToLocalStorage() {
  try {
    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
    localStorage.setItem('history', JSON.stringify(state.history));
  } catch (e) {
    console.error('Error saving data:', e);
  }
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

/***********************
 * EPISODE HANDLING    *
 ***********************/
function episodeSelector(data) {
  if (!data.seasons) return '';
  
  const availableSeasons = data.seasons
    .filter(s => {
      const airDate = s.air_date ? new Date(s.air_date) : null;
      const now = new Date();
      return airDate && airDate <= now && s.episode_count > 0;
    })
    .sort((a, b) => a.season_number - b.season_number);

  if (availableSeasons.length === 0) return '';
  
  const currentSeason = availableSeasons.find(s => s.season_number === state.currentSeason) || availableSeasons[0];
  const episodeCount = currentSeason?.episode_count || 1;
  
  if (currentSeason && state.currentSeason !== currentSeason.season_number) {
    state.currentSeason = currentSeason.season_number;
    state.currentEpisode = 1;
  }
  
  return `
    <div class="episode-controls">
      <div class="select-group">
        <label>Season</label>
        <select class="select" id="seasonSelect">
          ${availableSeasons.map(s => {
            const seasonLabel = s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`;
            return `
              <option value="${s.season_number}" 
                ${s.season_number === state.currentSeason ? 'selected' : ''}>
                ${seasonLabel} (${s.episode_count} Episodes)
              </option>
            `;
          }).join('')}
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

function updateEpisodeSelect(data) {
  const episodeSelect = el('#episodeSelect');
  if (!episodeSelect) return;
  
  const currentSeason = data.seasons?.find(s => s.season_number === state.currentSeason);
  const episodeCount = currentSeason?.episode_count || 1;
  
  episodeSelect.innerHTML = Array.from(
    {length: episodeCount}, 
    (_, i) => `
      <option value="${i + 1}" ${i + 1 === state.currentEpisode ? 'selected' : ''}>
        Episode ${i + 1}
      </option>
    `
  ).join('');
}

/***********************
 * LOADING STATES     *
 ***********************/
function skeletonHero() {
  return `
    <div class="hero skeleton" style="min-height:280px">
      <div class="hero-inner">
        <div style="width:80px;height:24px;margin-bottom:16px" class="skeleton"></div>
        <div style="width:60%;height:32px;margin-bottom:12px" class="skeleton"></div>
        <div style="width:80%;height:80px" class="skeleton"></div>
      </div>
    </div>
  `;
}

function sectionSkeleton(title) {
  return `
    <div class="section">
      <h2>${title}</h2>
      <div class="grid">
        ${Array(6).fill(`
          <div class="card">
            <div class="thumb skeleton"></div>
            <div class="meta">
              <div style="width:80%;height:20px;margin-bottom:8px" class="skeleton"></div>
              <div style="width:40%;height:16px" class="skeleton"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function errorBlock(error) {
  return `
    <div style="text-align:center; padding:40px;">
      <h2>Error</h2>
      <p style="color:var(--muted)">${error.message || 'An error occurred'}</p>
      <button class="btn" onclick="location.reload()">Retry</button>
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
 * PAGE RENDERING      *
 ***********************/
async function renderHome() {
  const app = el('#app');
  if (!app) return;
  
  const urlParams = new URLSearchParams(location.hash.split('?')[1] || '');
  const currentPage = parseInt(urlParams.get('page')) || 1;
  
  app.innerHTML = skeletonHero() + sectionSkeleton('Latest Releases') + 
                 sectionSkeleton('Popular Movies') + sectionSkeleton('Trending Shows');
  
  try {
    const [trend, movies, tv] = await Promise.all([
      API.trending(currentPage),
      API.discover('movie', currentPage),
      API.discover('tv', currentPage)
    ]);
    
    const pick = (movies.results || []).find(x => x.backdrop_path) || 
                (tv.results || [])[0] || (trend.results || [])[0] || {};
    
    const totalPages = Math.min(trend.total_pages || 1, 500);
    
    app.innerHTML = [
      hero(pick),
      
      state.history.length ? section('Continue Watching', 
        `<div class="horizontal-scroll">
          ${grid(state.history.slice(0,6).map(item => ({
            ...item,
            title: item.title,
            poster_path: item.poster_path,
            media_type: item.media_type,
            id: item.id
          })))}
         </div>`
      ) : '',
      
      section('Latest Releases', `
        <div class="horizontal-scroll">
          ${grid((trend.results || []).slice(0,12))}
        </div>
      `),
      
      section('Popular Movies', `
        <div class="horizontal-scroll">
          ${grid((movies.results || []).slice(0,12), 'movie')}
        </div>
        <div class="section-footer">
          <a href="#/movies?page=1" class="btn">View All Movies</a>
        </div>
      `),
      
      section('Trending Shows', `
        <div class="horizontal-scroll">
          ${grid((tv.results || []).slice(0,12), 'tv')}
        </div>
        <div class="section-footer">
          <a href="#/tv?page=1" class="btn">View All TV Shows</a>
        </div>
      `)
    ].join('');
    
  } catch(e) {
    console.error('Home page error:', e);
    app.innerHTML = errorBlock(e);
  }
}

async function renderDiscover(type) {
  const app = el('#app');
  if (!app) return;
  
  const urlParams = new URLSearchParams(location.hash.split('?')[1] || '');
  const currentPage = parseInt(urlParams.get('page')) || 1;
  
  app.innerHTML = sectionSkeleton(`Popular ${type === 'movie' ? 'Movies' : 'TV Shows'}`);
  
  try {
    const data = await API.discover(type, currentPage);
    const items = data.results || [];
    const totalPages = Math.min(data.total_pages || 1, 500);
    
    const urlPath = type === 'movie' ? 'movies' : 'tv';
    
    app.innerHTML = `
      <div class="section">
        <h2>Popular ${type === 'movie' ? 'Movies' : 'TV Shows'}</h2>
        ${grid(items, type)}
        
        <div class="pagination">
          ${currentPage > 1 ? `
            <a href="#/${urlPath}?page=${currentPage - 1}" class="btn">← Previous</a>
          ` : ''}
          
          <span class="page-info">Page ${currentPage} of ${totalPages}</span>
          
          ${currentPage < totalPages ? `
            <a href="#/${urlPath}?page=${currentPage + 1}" class="btn">Next →</a>
          ` : ''}
        </div>
      </div>
    `;
  } catch(e) {
    console.error('Discover page error:', e);
    app.innerHTML = errorBlock(e);
  }
}

async function renderWatchlist() {
  const app = el('#app');
  if (!app) return;
  
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

async function renderWatch(params) {
  const { type = 'movie', id } = params;
  const app = el('#app');
  if (!app) return;
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
               <button class="btn" id="watchlistBtn">
                 ${inWatchlist(data) ? '★ In Watchlist' : '☆ Add to Watchlist'}
               </button>
               <a id="downloadBtn" class="btn download" target="_blank" 
                  href="${type === 'movie' ? 
                    `https://dl.vidsrc.vip/movie/${id}` : 
                    `https://dl.vidsrc.vip/tv/${id}/${state.currentSeason}/${state.currentEpisode}`}"
                  style="margin-left:10px">
                 Download
               </a>
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
            ${data.seasons?.filter(season => {
              const airDate = season.air_date ? new Date(season.air_date) : null;
              const now = new Date();
              return airDate && airDate <= now && season.episode_count > 0;
            }).sort((a, b) => a.season_number - b.season_number).map(season => {
              const seasonLabel = season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`;
              const statusText = season.season_number === 0 ? 'Special Episodes' : 
                               season.episode_count === 1 ? '1 Episode' : `${season.episode_count} Episodes`;
              
              return `
                <div class="season-card ${season.season_number === state.currentSeason ? 'active' : ''}">
                  <div class="season-card-inner">
                    <h3>${seasonLabel}</h3>
                    <div class="episode-count">${statusText}</div>
                    ${season.overview ? `<p class="season-overview">${season.overview.slice(0, 100)}${season.overview.length > 100 ? '...' : ''}</p>` : ''}
                    <button class="btn" data-season="${season.season_number}">
                      Watch ${seasonLabel}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
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

    window.scrollTo({ top: 0, behavior: 'smooth' });
    bindPlayerControls(data);
    
  } catch(e) {
    console.error('Watch page error:', e);
    app.innerHTML = errorBlock(e);
  }
}

/***********************
 * EVENT HANDLERS      *
 ***********************/
// Simplified videoEmbed function
function videoEmbed(data) {
  const { id, media_type } = data;
  const endpoints = media_type === 'movie' ? MOVIE_ENDPOINTS : SERIES_ENDPOINTS;
  const currentUrl = endpoints[state.currentServer];
  
  let embedUrl = currentUrl + id;
  if (media_type === 'tv') {
    embedUrl += `/${state.currentSeason}/${state.currentEpisode}`;
  }
  
  return `
    <div class="player-container">
      <iframe
        id="videoPlayer"
        src="${embedUrl}"
        allowfullscreen
        allow="fullscreen"
        style="width:100%;height:100%;border:none;">
      </iframe>
    </div>
  `;
}

// Simplified bindPlayerControls function
function bindPlayerControls(data) {
  // Server selection
  const serverSelect = el('#serverSelect');
  if (serverSelect) {
    serverSelect.addEventListener('change', e => {
      state.currentServer = parseInt(e.target.value);
      const player = el('#player');
      if (player) {
        player.innerHTML = videoEmbed(data);
      }
    });
  }

  // Season selection
  const seasonSelect = el('#seasonSelect');
  if (seasonSelect) {
    seasonSelect.addEventListener('change', e => {
      state.currentSeason = parseInt(e.target.value);
      state.currentEpisode = 1;
      updateEpisodeSelect(data);
      updateDownloadLink(data);
      const player = el('#player');
      if (player) {
        player.innerHTML = videoEmbed(data);
      }
    });
  }

  // Episode selection
  const episodeSelect = el('#episodeSelect');
  if (episodeSelect) {
    episodeSelect.addEventListener('change', e => {
      state.currentEpisode = parseInt(e.target.value);
      updateDownloadLink(data);
      const player = el('#player');
      if (player) {
        player.innerHTML = videoEmbed(data);
      }
    });
  }

  // Season card buttons
  els('[data-season]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentSeason = parseInt(btn.dataset.season);
      state.currentEpisode = 1;
      
      const seasonSelectEl = el('#seasonSelect');
      if (seasonSelectEl) seasonSelectEl.value = state.currentSeason;
      
      updateEpisodeSelect(data);
      updateDownloadLink(data);
      
      const player = el('#player');
      if (player) {
        player.innerHTML = videoEmbed(data);
      }
      
      els('.season-card').forEach(card => 
        card.classList.toggle('active', 
          card.querySelector('[data-season]').dataset.season === state.currentSeason.toString())
      );
    });
  });

  // Watchlist button
  const watchlistBtn = el('#watchlistBtn');
  if (watchlistBtn) {
    watchlistBtn.addEventListener('click', () => {
      toggleWatchlist(data);
      watchlistBtn.textContent = inWatchlist(data) ? '★ In Watchlist' : '☆ Add to Watchlist';
    });
  }
}

// Update link function
function updateDownloadLink(data) {
  const downloadBtn = el('#downloadBtn');
  if (downloadBtn && data.media_type === "tv") {
    downloadBtn.href = `https://dl.vidsrc.vip/tv/${data.id}/${state.currentSeason}/${state.currentEpisode}`;
  }
}

// Update episode select function
function updateEpisodeSelect(data) {
  const episodeSelect = el('#episodeSelect');
  if (!episodeSelect) return;
  
  const currentSeason = data.seasons?.find(s => s.season_number === state.currentSeason);
  const episodeCount = currentSeason?.episode_count || 1;
  
  episodeSelect.innerHTML = Array.from(
    {length: episodeCount}, 
    (_, i) => `
      <option value="${i + 1}" ${i + 1 === state.currentEpisode ? 'selected' : ''}>
        Episode ${i + 1}
      </option>
    `
  ).join('');
          }

/***********************
 * SEARCH              *
 ***********************/
let searchTimeout;

function setupSearch() {
  const searchInput = el('#q');
  const suggest = el('#suggest');
  
  if (!searchInput || !suggest) return;
  
  searchInput.addEventListener('input', e => {
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
    if(!suggest.contains(e.target) && e.target !== searchInput) {
      suggest.classList.remove('show');
    }
  });
  
  window.addEventListener('hashchange', () => {
    suggest.classList.remove('show');
  });
}

/***********************
 * INITIALIZATION      *
 ***********************/
function setupEventListeners() {
  const themeBtn = el('#themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
  }
  
  setupSearch();
  
  window.addEventListener('hashchange', () => {
    state.route = location.hash || '#/home';
    tick();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.pagination a')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

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
}

/***********************
 * ROUTING             *
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
  
  const tabs = els('[data-tab]');
  if (tabs.length > 0) {
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('href') === location.hash);
    });
  }
  
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

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  try {
    const savedWatchlist = localStorage.getItem('watchlist');
    const savedHistory = localStorage.getItem('history');
    if (savedWatchlist) state.watchlist = JSON.parse(savedWatchlist);
    if (savedHistory) state.history = JSON.parse(savedHistory);
  } catch (e) {
    console.error('Error loading saved data:', e);
    state.watchlist = [];
    state.history = [];
  }

  setTheme(state.theme);
  setupEventListeners();
  tick();
});
