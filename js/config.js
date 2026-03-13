// Constants and Configuration Settings

const TMDB_API_KEY = '8b38fdbfc051bcd57c89da7fc2e5bdef';
const TMDB_ENDPOINTS = {
    search: 'https://api.themoviedb.org/3/search/movie',
    trending: 'https://api.themoviedb.org/3/trending/all/week',
    specific: (id) => `https://api.themoviedb.org/3/movie/${id}`
};

const PROVIDER_NAMES = {
    NETFLIX: 'Netflix',
    HULU: 'Hulu',
    AMAZON: 'Amazon Prime Video',
    DISNEY: 'Disney+',
    HBO: 'HBO Max'
};

export { TMDB_API_KEY, TMDB_ENDPOINTS, PROVIDER_NAMES };
