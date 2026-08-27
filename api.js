
// api.js – Reusable Client-Side REST API Helper for AgriConnect
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

    if (
      typeof window !== 'undefined' &&
      window.API_BASE_URL
    ) {
      return window.API_BASE_URL.replace(/\/+$/, '');
    }

    // 3. Environment detection
    if (
      typeof window !== 'undefined' &&
      window.location
    ) {
      const hostname = window.location.hostname;

      const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '';

      // Local development
      if (isLocal) {
        if (
          window.location.port === '5000' ||
          window.location.port === 5000
        ) {
          return `${window.location.protocol}//${
            hostname || 'localhost'
          }:5000/api`;
        }

        return 'http://localhost:5000/api';
      }

      // Production backend on Render
      return 'https://agreeconnect-backend.onrender.com/api';
    }

    // Final fallback
    return 'https://agreeconnect-backend.onrender.com/api';
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

    return this._memoryToken;
  }

  static setToken(token) {
    this._memoryToken = token;

    try {
      if (typeof localStorage !== 'undefined') {
        if (token) {
          localStorage.setItem(
            'agriconnect_token',
            token
          );
        } else {
          localStorage.removeItem(
            'agriconnect_token'
          );
        }
      }

      if (typeof sessionStorage !== 'undefined') {
        if (token) {
          sessionStorage.setItem(
            'agriconnect_token',
            token
          );
        } else {
          sessionStorage.removeItem(
            'agriconnect_token'
          );
        }
      }
    } catch (e) {}
  }

  static removeToken() {
    this.setToken(null);
  }

  static clearToken() {
    this.setToken(null);
  }

  static getCurrentUser() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const u1 =
          sessionStorage.getItem(
            'agriconnect_user'
          ) ||
          sessionStorage.getItem(
            'currentUser'
          );

        if (u1) {
          return JSON.parse(u1);
        }
      }

      if (typeof localStorage !== 'undefined') {
        const u2 =
          localStorage.getItem(
            'agriconnect_user'
          ) ||
          localStorage.getItem(
            'currentUser'
          );

        if (u2) {
          return JSON.parse(u2);
        }
      }
    } catch (e) {}

    return this._memoryUser;
  }

  static setCurrentUser(user) {
    this._memoryUser = user;

    try {
      const str = JSON.stringify(user);

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(
          'agriconnect_user',
          str
        );

        sessionStorage.setItem(
          'currentUser',
          str
        );
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          'agriconnect_user',
          str
        );

        localStorage.setItem(
          'currentUser',
          str
        );
      }
    } catch (e) {}
  }

  static clearUser() {
    this._memoryUser = null;

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(
          'agriconnect_user'
        );

        sessionStorage.removeItem(
          'currentUser'
        );
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(
          'agriconnect_user'
        );

        localStorage.removeItem(
          'currentUser'
        );
      }
    } catch (e) {}
  }

  static logout() {
    this.clearToken();
    this.clearUser();

    if (
      typeof window !== 'undefined' &&
      window.location
    ) {
      window.location.href = 'login.html';
    }
  }

  static async request(
    endpoint,
    options = {}
  ) {
    const baseUrl = this.getBaseUrl();

    const cleanEndpoint =
      endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`;

    const url =
      `${baseUrl}${cleanEndpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();

    if (
      token &&
      !headers['Authorization']
    ) {
      headers['Authorization'] =
        `Bearer ${token}`;
    }

    const config = {
      method: options.method || 'GET',
      headers,
      ...options
    };

    if (
      options.body &&
      typeof options.body === 'object' &&
      !(options.body instanceof FormData)
    ) {
      config.body =
        JSON.stringify(options.body);
    }

    try {
      const response =
        await fetch(url, config);

      const contentType =
        response.headers.get(
          'content-type'
        );

      let data;

      if (
        contentType &&
        contentType.includes(
          'application/json'
        )
      ) {
        data = await response.json();
      } else {
        const text =
          await response.text();

        try {
          data = JSON.parse(text);
        } catch {
          data = {
            message: text
          };
        }
      }

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          message:
            data && data.message
              ? data.message
              : `HTTP ${response.status}: ${response.statusText}`,
          ...data
        };
      }

      return {
        success: true,
        status: response.status,
        ...data
      };
    } catch (err) {
      console.warn(
        `[AgriConnect API Error] ${
          options.method || 'GET'
        } ${url}:`,
        err.message
      );

      return {
        success: false,
        status: 0,
        networkError: true,
        message:
          `Connection to backend server failed (${err.message}). ` +
          `Ensure the backend is reachable at ${baseUrl}.`
      };
    }
  }

  static async apiGet(
    endpoint,
    options = {}
  ) {
    return this.request(
      endpoint,
      {
        ...options,
        method: 'GET'
      }
    );
  }

  static async apiPost(
    endpoint,
    body = {},
    options = {}
  ) {
    return this.request(
      endpoint,
      {
        ...options,
        method: 'POST',
        body
      }
    );
  }

  static async apiPut(
    endpoint,
    body = {},
    options = {}
  ) {
    return this.request(
      endpoint,
      {
        ...options,
        method: 'PUT',
        body
      }
    );
  }

  static async apiDelete(
    endpoint,
    options = {}
  ) {
    return this.request(
      endpoint,
      {
        ...options,
        method: 'DELETE'
      }
    );
  }

  static async apiPatch(
    endpoint,
    body = {},
    options = {}
  ) {
    return this.request(
      endpoint,
      {
        ...options,
        method: 'PATCH',
        body
      }
    );
  }
}

// Global API object
if (typeof window !== 'undefined') {
  window.AgriConnectAPI =
    AgriConnectAPI;
}

// Node.js / CommonJS support
if (
  typeof module !== 'undefined' &&
  module.exports
) {
  module.exports =
    AgriConnectAPI;
}
