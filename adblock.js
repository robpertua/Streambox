// Ad blocking functionality
class AdBlocker {
  constructor() {
    this.adPatterns = [
      'ads',
      'analytics',
      'tracking',
      'advertisement',
      'banner',
      'popup',
      'adsystem',
      'doubleclick',
      'google-analytics',
      'adservice'
    ];
  }

  isAd(urlString) {
    try {
      if (!urlString || typeof urlString !== 'string') return false;
      
      const url = urlString.toLowerCase();
      return this.adPatterns.some(pattern => url.indexOf(pattern) !== -1);
    } catch (error) {
      console.error('Ad detection error:', error);
      return false;
    }
  }
}
