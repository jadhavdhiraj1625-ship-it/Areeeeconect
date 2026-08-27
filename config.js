/**
 * config.js — Central API & Environment Configuration for AgriConnect
 * 
 * PRODUCTION DEPLOYMENT INSTRUCTIONS:
 * 1. Default production backend URL is configured below as DEFAULT_RENDER_URL.
 *    Update this string to your deployed Render URL (e.g., https://your-service.onrender.com/api).
 * 2. Alternatively, you can override the URL at runtime without modifying code:
 *    - In the browser console: localStorage.setItem('AGRICONNECT_API_URL', 'https://your-service.onrender.com/api')
 *    - Or define: window.AGRICONNECT_API_URL = 'https://your-service.onrender.com/api'
 * 3. In local development (localhost / 127.0.0.1), this module automatically routes to http://localhost:5000/api.
 */

(function() {
  // Set your default Render backend URL here
  const DEFAULT_RENDER_URL = 'https://agriconnect-backend.onrender.com/api';

  function determineBaseUrl() {
    // 1. Runtime override via localStorage (useful for instant testing without redeployment)
    try {
      if (typeof localStorage !== 'undefined') {
        const customUrl = localStorage.getItem('AGRICONNECT_API_URL');
        if (customUrl && customUrl.trim()) {
          return customUrl.trim().replace(/\/+$/, '');
        }
      }
    } catch (e) {}

    // 2. Global variable override
    if (typeof window !== 'undefined' && window.AGRICONNECT_API_URL) {
      return String(window.AGRICONNECT_API_URL).trim().replace(/\/+$/, '');
    }

    // 3. Local development environment detection (localhost / 127.0.0.1 on any port or file protocol)
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
      if (isLocal) {
        if (window.location.port === '5000' || window.location.port === 5000) {
          return `${window.location.protocol}//${hostname || 'localhost'}:5000/api`;
        }
        return 'http://localhost:5000/api';
      }
    }

    // 4. Production fallback (Render backend)
    return DEFAULT_RENDER_URL.replace(/\/+$/, '');
  }

  const isLocalEnv = (typeof window !== 'undefined' && window.location)
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '')
    : true;

  const AgriConnectConfig = {
    DEFAULT_RENDER_URL: DEFAULT_RENDER_URL,
    API_BASE_URL: determineBaseUrl(),
    TIMEOUT_MS: 20000,
    IS_DEV: isLocalEnv,
    getBaseUrl: determineBaseUrl
  };

  const API_BASE_URL = AgriConnectConfig.API_BASE_URL;

  if (typeof window !== 'undefined') {
    window.AgriConnectConfig = AgriConnectConfig;
    window.API_BASE_URL = API_BASE_URL;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AgriConnectConfig, API_BASE_URL, DEFAULT_RENDER_URL };
  }
})();
