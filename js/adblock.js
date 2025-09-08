// Ad Blocker Utility
const AdBlocker = {
  // Common ad-related domains and patterns
  adPatterns: [
    'ads.', 'analytics.', 'tracker.',
    'google-analytics.com',
    'doubleclick.net',
    'adnxs.com',
    'advertising.',
    'googleads.',
    'scorecardresearch.com'
  ],

  // Common ad-related element selectors
  adSelectors: [
    '[class*="ad-"]',
    '[class*="ads-"]',
    '[id*="ad-"]',
    '[id*="ads-"]',
    '[class*="banner"]',
    '[class*="sponsored"]',
    'ins.adsbygoogle',
    'div[data-ad]',
    'iframe[src*="ads"]'
  ],

  // Initialize the ad blocker
  init() {
    this.attachObserver();
    this.blockAds();
    this.interceptNetworkRequests();
  },

  // Block existing ads
  blockAds() {
    this.adSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.style.display = 'none';
        element.remove();
      });
    });
  },

  // Observe DOM changes to block dynamically loaded ads
  attachObserver() {
    const observer = new MutationObserver(() => this.blockAds());
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  },

  // Intercept and block ad-related network requests
  interceptNetworkRequests() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = args[0]?.url || args[0];
      if (this.isAdUrl(url)) {
        return new Response('', { status: 200 });
      }
      return originalFetch.apply(window, args);
    };
  },

  // Check if URL is ad-related
  isAdUrl(url) {
    return this.adPatterns.some(pattern => url.includes(pattern));
  }
};

// Initialize ad blocker when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  AdBlocker.init();
});
