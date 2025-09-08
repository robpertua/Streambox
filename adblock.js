// Simple ad blocker implementation
const StreamboxAdBlocker = {
  init() {
    this.removeAds();
    this.observeNewAds();
  },

  removeAds() {
    const adSelectors = [
      'iframe[src*="ads"]',
      'iframe[src*="google"]',
      'iframe[src*="doubleclick"]',
      '[class*="ad-container"]',
      '[id*="ads-"]',
      '[class*="banner-ad"]'
    ];

    adSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.style.display = 'none';
      });
    });
  },

  observeNewAds() {
    const observer = new MutationObserver(() => this.removeAds());
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  StreamboxAdBlocker.init();
});
