
// api.js – Reusable Client-Side REST API Helper with Hybrid Fallback
class AgriConnectAPI {
  static _memoryToken = null;
  static _memoryUser = null;

  static getBaseUrl() {
    // 1. Runtime override via localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const custom = localStorage.getItem('AGRICONNECT_API_URL');
        if (custom && custom.trim()) {
          return custom.trim().replace(/\/+$/, '');
        }
      }
    } catch (e) {}

    // 2. Explicitly configured in AgriConnectConfig / window
    if (
      typeof window !== 'undefined' &&
      window.AgriConnectConfig &&
      typeof window.AgriConnectConfig.getBaseUrl === 'function'
    ) {
      return window.AgriConnectConfig.getBaseUrl();
    }

    if (
      typeof window !== 'undefined' &&
      window.AgriConnectConfig &&
      window.AgriConnectConfig.API_BASE_URL
    ) {
      return window.AgriConnectConfig.API_BASE_URL.replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined' && window.API_BASE_URL) {
      return window.API_BASE_URL.replace(/\/+$/, '');
    }

    // 3. Environment detection
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;

      const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '';

      if (isLocal) {
        if (
          window.location.port === '10000' ||
          window.location.port === 10000
        ) {
          return `${window.location.protocol}//${hostname || 'localhost'}:10000/api`;
        }

        return 'http://localhost:10000/api';
      }

      // Production backend - Render
      return 'https://a-b-1-snoy.onrender.com/api';
    }

    return 'http://localhost:10000/api';
  }

  static getToken() {
    try {
      if (
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('agriconnect_token')
      ) {
        return localStorage.getItem('agriconnect_token');
      }

      if (
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('agriconnect_token')
      ) {
        return sessionStorage.getItem('agriconnect_token');
      }
    } catch (e) {}

    return AgriConnectAPI._memoryToken || null;
  }

  static setToken(token) {
    AgriConnectAPI._memoryToken = token;

    try {
      if (typeof localStorage !== 'undefined' && token) {
        localStorage.setItem('agriconnect_token', token);
      }

      if (typeof sessionStorage !== 'undefined' && token) {
        sessionStorage.setItem('agriconnect_token', token);
      }
    } catch (e) {
      console.warn('Storage persistence warning:', e.message);
    }
  }

  static removeToken() {
    AgriConnectAPI._memoryToken = null;
    AgriConnectAPI._memoryUser = null;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('agriconnect_token');
        localStorage.removeItem('currentUser');
      }

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('agriconnect_token');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('agriconnect_user');
      }
    } catch (e) {}
  }

  static getCurrentUser() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw =
          sessionStorage.getItem('currentUser') ||
          sessionStorage.getItem('agriconnect_user');

        if (raw) {
          return JSON.parse(raw);
        }
      }

      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('currentUser');

        if (raw) {
          return JSON.parse(raw);
        }
      }
    } catch (e) {}

    return AgriConnectAPI._memoryUser || null;
  }

  static setCurrentUser(user) {
    AgriConnectAPI._memoryUser = user;

    try {
      if (user) {
        const str = JSON.stringify(user);

        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('currentUser', str);
          sessionStorage.setItem('agriconnect_user', str);
        }

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('currentUser', str);
        }
      }
    } catch (e) {}
  }

  static async request(endpoint, options = {}) {
    const baseUrl = this.getBaseUrl();

    const url = `${baseUrl}${
      endpoint.startsWith('/') ? endpoint : '/' + endpoint
    }`;

    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      if (
        typeof window !== 'undefined' &&
        window.AgriConnectConfig &&
        window.AgriConnectConfig.IS_DEV
      ) {
        console.log(
          `[API] ${config.method || 'GET'} ${endpoint}`
        );
      }

      // 15-second timeout controller for cloud Atlas queries
      const controller =
        typeof AbortController !== 'undefined'
          ? new AbortController()
          : null;

      let timeoutId = null;

      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), 15000);
        config.signal = controller.signal;
      }

      const res = await fetch(url, config);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      let data = {};

      try {
        data = await res.json();
      } catch (e) {
        data = {
          success: res.ok,
          statusText: res.statusText
        };
      }

      if (res.status === 401) {
        console.warn(
          `[API] 401 Unauthorized on ${endpoint}`
        );

        return {
          success: false,
          status: 401,
          isAuthError: true,
          message:
            data.message ||
            'Session expired. Please log in again.'
        };
      }

      if (res.status === 403) {
        console.warn(
          `[API] 403 Forbidden on ${endpoint}`
        );

        return {
          success: false,
          status: 403,
          isForbidden: true,
          message:
            data.message ||
            'Access forbidden: Insufficient permissions.'
        };
      }

      if (res.status === 400) {
        return {
          success: false,
          status: 400,
          isValidationError: true,
          message:
            data.message || 'Validation error'
        };
      }

      if (res.status === 404) {
        return {
          success: false,
          status: 404,
          isNotFound: true,
          message:
            data.message || 'Resource not found'
        };
      }

      if (res.status === 409) {
        return {
          success: false,
          status: 409,
          isConflictError: true,
          message:
            data.message ||
            'Account with this email or mobile already exists.'
        };
      }

      if (!res.ok) {
        return {
          success: false,
          status: res.status,
          isServerError: true,
          message:
            data.message ||
            `Server error (${res.status})`
        };
      }

      return {
        success: true,
        status: res.status,
        ...data
      };
    } catch (networkError) {
      console.warn(
        `[API] Network unavailable on ${endpoint} (${networkError.message})`
      );

      return {
        success: false,
        isNetworkError: true,
        message:
          `Backend server unreachable: ${networkError.message}. ` +
          `Make sure the Node server is running.`,
        error: networkError.message
      };
    }
  }

  static apiGet(endpoint) {
    return this.request(endpoint, {
      method: 'GET'
    });
  }

  static apiPost(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    });
  }

  static apiPut(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data
    });
  }

  static apiDelete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
}

// Global functional shortcuts
const apiGet = (url) =>
  AgriConnectAPI.apiGet(url);

const apiPost = (url, data) =>
  AgriConnectAPI.apiPost(url, data);

const apiPut = (url, data) =>
  AgriConnectAPI.apiPut(url, data);

const apiDelete = (url) =>
  AgriConnectAPI.apiDelete(url);

const getToken = () =>
  AgriConnectAPI.getToken();

const setToken = (t) =>
  AgriConnectAPI.setToken(t);

const removeToken = () =>
  AgriConnectAPI.removeToken();

const getCurrentUser = () =>
  AgriConnectAPI.getCurrentUser();

if (typeof window !== 'undefined') {
  window.AgriConnectAPI = AgriConnectAPI;
  window.apiGet = apiGet;
  window.apiPost = apiPost;
  window.apiPut = apiPut;
  window.apiDelete = apiDelete;
  window.getToken = getToken;
  window.setToken = setToken;
  window.removeToken = removeToken;
  window.getCurrentUser = getCurrentUser;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AgriConnectAPI,
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    getToken,
    setToken,
    removeToken,
    getCurrentUser
  };
}

