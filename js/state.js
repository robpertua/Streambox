/**
 * State Management Module
 *
 * This module handles the application state including theme, watchlist, history,
 * and player state.
 *
 * @module state
 */

/**
 * @typedef {Object} AppState
 * @property {string} theme - The current theme of the application.
 * @property {Array<string>} watchlist - The list of videos in the user's watchlist.
 * @property {Array<string>} history - The list of recently watched videos.
 * @property {Object} playerState - The current state of the video player.
 * @property {boolean} playerState.isPlaying - Indicates if the video is currently playing.
 * @property {number} playerState.volume - The current volume of the player.
 */

const state = /** @type {AppState} */ ({
    theme: 'light',
    watchlist: [],
    history: [],
    playerState: {
        isPlaying: false,
        volume: 50
    }
});

/**
 * Set the current theme.
 * @param {string} newTheme - The new theme to set.
 */
function setTheme(newTheme) {
    state.theme = newTheme;
}

/**
 * Add a video to the watchlist.
 * @param {string} videoId - The ID of the video to add.
 */
function addToWatchlist(videoId) {
    state.watchlist.push(videoId);
}

/**
 * Remove a video from the watchlist.
 * @param {string} videoId - The ID of the video to remove.
 */
function removeFromWatchlist(videoId) {
    state.watchlist = state.watchlist.filter(video => video !== videoId);
}

/**
 * Add a video to the history.
 * @param {string} videoId - The ID of the video to add to history.
 */
function addToHistory(videoId) {
    state.history.push(videoId);
}

/**
 * Set the player state.
 * @param {boolean} isPlaying - Indicates if the player is playing.
 * @param {number} volume - The volume level of the player.
 */
function setPlayerState(isPlaying, volume) {
    state.playerState.isPlaying = isPlaying;
    state.playerState.volume = volume;
}

/**
 * Get the current state.
 * @returns {AppState} The current application state.
 */
function getState() {
    return state;
}

module.exports = {
    setTheme,
    addToWatchlist,
    removeFromWatchlist,
    addToHistory,
    setPlayerState,
    getState
};