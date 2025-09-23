// Browser compatibility layer for Chrome/Firefox
// This ensures the extension works in both browsers

(function () {
  // Use browser namespace if available (Firefox), otherwise fall back to chrome
  if (typeof browser !== 'undefined') {
    window.browserAPI = browser;
  } else if (typeof chrome !== 'undefined') {
    window.browserAPI = chrome;
  } else {
    console.error('No browser API found');
  }
})();
