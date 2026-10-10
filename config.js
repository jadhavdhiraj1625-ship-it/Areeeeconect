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
  const DEFAULT_RENDER_URL = 'https://agreeconnect-backend.onrender.com/api';

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
    if (typeof window !== 'undefined' && window.VITE_API_URL) {
      return String(window.VITE_API_URL).trim().replace(/\/+$/, '');
    }

    // 3. Environment detection & Local development
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = String(window.location.port || '');

      // Check if user explicitly wants local backend during local development
      let wantsLocalBackend = false;
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('USE_LOCAL_BACKEND') === 'true') {
          wantsLocalBackend = true;
        }
      } catch (e) {}
      if (window.USE_LOCAL_BACKEND === true) {
        wantsLocalBackend = true;
      }

      // If running on local HTTP server (localhost or 127.0.0.1)
      if ((protocol === 'http:' || protocol === 'https:') && (hostname === 'localhost' || hostname === '127.0.0.1')) {
        // If served directly by local backend on port 5000 or explicitly opted into local backend
        if (port === '5000' || wantsLocalBackend) {
          return `${protocol}//${hostname}:5000/api`;
        }
      }

      // If opened via file:/// protocol or on any remote/production domain (e.g. *.vercel.app):
      // ALWAYS use the live production Render backend
    }

    // 4. Default for production, Vercel, and file:/// URLs: ALWAYS production Render backend
    return DEFAULT_RENDER_URL.replace(/\/+$/, '');
  }

  const isLocalEnv = (typeof window !== 'undefined' && window.location)
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    : false;

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
