// TMDB API Wrapper with error handling and caching

/**
 * API module for TMDB interactions
 */
const API = {
  cache: new Map(),
  baseUrl: 'https://api.themoviedb.org/3',
  
  /**
   * Fetch data from TMDB API with retry logic and caching
   * @param {string} path - API endpoint path
   * @param {object} params - Query parameters
   * @returns {Promise<object>} API response data
   * @throws {Error} If API request fails after retries
   */
  async get(path, params = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    const apiKey = this.getApiKey();
    
    if (!apiKey) {
      throw new Error('TMDB API key is not configured');
    }
    
    Object.entries({ language: 'en-US', ...params })
      .forEach(([k, v]) => url.searchParams.set(k, v));

    let opts = { headers: { Accept: 'application/json' } };
    if (apiKey.startsWith('eyJ')) {
      opts.headers.Authorization = `Bearer ${apiKey}`;
    } else {
      url.searchParams.set('api_key', apiKey);
    }

    const key = url.toString();
    if (this.cache.has(key)) return this.cache.get(key);

    let attempt = 0;
    while (attempt < 3) {
      attempt++;
      try {
        const res = await fetch(url, opts);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        this.cache.set(key, data);
        return data;
      } catch (e) {
        console.error(`API request failed (attempt ${attempt}):`, e);
        if (attempt === 3) {
          throw new Error(`Failed to fetch ${path} after 3 attempts: ${e.message}`);
        }
        await this.sleep(400 * attempt);
      }
    }
  },

  /**
   * Get API key from environment or config
   * @returns {string} The TMDB API key
   */
  getApiKey() {
    return window.CONFIG?.TMDB_KEY || '';
  },

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Search for movies and TV shows
   * @param {string} query - Search query
   * @returns {Promise<object>} Search results
   */
  async searchMulti(query) {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }
    return this.get('/search/multi', { query: query.trim() });
  },

  /**
   * Get trending content
   * @param {string} timeWindow - 'day' or 'week'
   * @returns {Promise<object>} Trending results
   */
  async getTrending(timeWindow = 'week') {
    return this.get(`/trending/all/${timeWindow}`);
  },

  /**
   * Get movie or TV show details
   * @param {number} id - Content ID
   * @param {string} type - 'movie' or 'tv'
   * @returns {Promise<object>} Content details
   */
  async getDetails(id, type = 'movie') {
    if (!id) {
      throw new Error('Content ID is required');
    }
    const endpoint = type === 'movie' ? `/movie/${id}` : `/tv/${id}`;
    return this.get(endpoint, { append_to_response: 'credits,watch/providers,similar' });
  },

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
};