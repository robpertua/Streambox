/***********************
 * CONFIG & UTILITIES  *
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

// Utility functions
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

// ... (keep all other utility functions the same)

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

function createSelect(options, value, onChange, className = '') {
  const select = document.createElement('select');
  select.className = `select ${className}`;
  options.forEach(([val, text]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    opt.selected = val === value;
    select.appendChild(opt);
  });
  select.addEventListener('change', onChange);
  return select;
}

function serverSelector(type) {
  const endpoints = type === 'movie' ? MOVIE_ENDPOINTS : SERIES_ENDPOINTS;
  const options = endpoints.map((_, i) => [`${i}`, `Server ${i + 1}`]);
  
  return `
    <div class="select-group">
      <label>Server</label>
      <select class="select" id="serverSelect">
        ${options.map(([val, text]) => `
          <option value="${val}" ${val === state.currentServer.toString() ? 'selected' : ''}>
            ${text}
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
       </div>
       ${type === 'tv' ? `
         <div class="section">
           <h2>Episodes</h2>
           <div class="seasons-grid">
             ${data.seasons.map(season => `
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
       ` : ''}
       <div class="section">
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
    await sleep(500); // Give iframe time to load
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
      updateEpisodeSelect(data);
      el('#seasonSelect').value = state.currentSeason;
      el('#player').innerHTML = videoEmbed(data);
      await sleep(500);
      state.loadingVideo = false;
      el('#player').innerHTML = videoEmbed(data);
      
      // Update active state
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

// ... (keep all other existing functions the same)

/***********************
 * INITIALIZATION      *
 ***********************/
document.addEventListener('DOMContentLoaded', () => {
  setTheme(state.theme);
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