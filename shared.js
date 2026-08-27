// shared.js – Central data store, Dijkstra pathfinding, and authentication for AgriConnect

// ── Graph definition (undirected weighted edges) ────────────────────
var graph = {
  Thalner: { Chopda: 15, Shirpur: 22, Amalner: 30 },
  Chopda: { Thalner: 15, Yawal: 25, Jalgaon: 40 },
  Shirpur: { Thalner: 22, Sendhwa: 35 },
  Amalner: { Thalner: 30, Jalgaon: 35, Pachora: 40 },
  Yawal: { Chopda: 25, Bhusawal: 32 },
  Jalgaon: { Chopda: 40, Amalner: 35, Bhusawal: 28, Jamner: 30, Pachora: 45 },
  Sendhwa: { Shirpur: 35 },
  Bhusawal: { Yawal: 32, Jalgaon: 28, Jamner: 32 },
  Jamner: { Jalgaon: 30, Bhusawal: 32, Pachora: 38 },
  Pachora: { Jalgaon: 45, Amalner: 40, Jamner: 38 }
};

// Node coordinates for UI maps
var nodeCoordinates = {
  Thalner: { lat: 21.0, lng: 75.0 },
  Chopda: { lat: 21.2, lng: 75.5 },
  Shirpur: { lat: 21.5, lng: 75.3 },
  Amalner: { lat: 20.9, lng: 74.8 },
  Yawal: { lat: 21.1, lng: 75.1 },
  Jalgaon: { lat: 21.0, lng: 75.4 },
  Sendhwa: { lat: 21.6, lng: 75.2 },
  Bhusawal: { lat: 20.8, lng: 75.6 },
  Jamner: { lat: 20.8, lng: 75.8 },
  Pachora: { lat: 20.6, lng: 75.3 }
};

// Taluka definitions
var talukas = [
  { name: "chopda", capacity: 3, node: "Chopda" },
  { name: "thalner", capacity: 3, node: "Thalner" },
  { name: "shirpur", capacity: 3, node: "Shirpur" },
  { name: "jalgaon", capacity: 3, node: "Jalgaon" },
  { name: "jamner", capacity: 3, node: "Jamner" },
  { name: "pachora", capacity: 3, node: "Pachora" }
];

/**
 * AgriConnectDB – Client-side in-memory DB with LocalStorage persistence (Fallback Engine)
 */
var AgriConnectDB = class AgriConnectDB {
  constructor() {
    this.farmers = {};
    this.surveyors = {};
    this.candidates = {};
    this.waitingLists = {};
    this.revenue = 0;
    this.invoices = [];
    this.bookings = [];
    this.loadState();
    
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('reset')) {
        this.clearDatabase();
        return;
      }
    }
    
    if (Object.keys(this.farmers).length === 0) {
      this.seedDemoData();
    }
  }

  clearDatabase() {
    try { 
      localStorage.removeItem('agriDB');
      localStorage.removeItem('farms_8625098532');
      localStorage.removeItem('farms_9988776655');
    } catch (e) { 
      console.warn('Failed to clear localStorage', e); 
    }
    this.farmers = {};
    this.surveyors = {};
    this.candidates = {};
    this.waitingLists = {};
    this.revenue = 0;
    this.invoices = [];
    this.bookings = [];
    this.seedDemoData();
    this.saveState();
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.location.href = cleanUrl;
    }
  }

  loadState() {
    try {
      const raw = localStorage.getItem("agriDB");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data !== "object" || data === null) return;
      
      // Purge legacy demo surveyors from client storage
      if (data.surveyors) {
        delete data.surveyors["7276025116"];
        delete data.surveyors["9876543210"];
        delete data.surveyors["s1"];
      }
      if (data.candidates) {
        delete data.candidates["cand-1"];
        delete data.candidates["cand-2"];
      }
      
      const safeAssign = (src, dst) => {
        if (src && typeof src === "object") Object.assign(dst, src);
      };
      
      safeAssign(data.farmers, this.farmers);
      safeAssign(data.surveyors, this.surveyors);
      safeAssign(data.candidates, this.candidates);
      safeAssign(data.waitingLists, this.waitingLists);
      if (Array.isArray(data.invoices)) this.invoices = data.invoices;
      if (Array.isArray(data.bookings)) this.bookings = data.bookings;
      if (typeof data.revenue === "number") this.revenue = data.revenue;
    } catch (e) {
      console.warn("Failed to load AgriConnect DB state:", e);
    }
  }

  saveState() {
    const payload = {
      farmers: this.farmers,
      surveyors: this.surveyors,
      candidates: this.candidates,
      waitingLists: this.waitingLists,
      invoices: this.invoices,
      bookings: this.bookings,
      revenue: this.revenue
    };
    try {
      localStorage.setItem("agriDB", JSON.stringify(payload));
    } catch (e) {
      console.error("Failed to save AgriConnect DB:", e);
    }
  }

  getCandidatesArray() {
    return Array.isArray(this.candidates) ? this.candidates : Object.values(this.candidates);
  }

  findCandidate(predicate) {
    const arr = this.getCandidatesArray();
    if (typeof predicate === 'function') return arr.find(predicate);
    return this.candidates[predicate] || arr.find(c => c.id === predicate || c.mobile === predicate || c.email === predicate);
  }

  seedDemoData() {
    // Purge any legacy demo surveyors
    delete this.surveyors["7276025116"];
    delete this.surveyors["9876543210"];
    delete this.surveyors["s1"];
    delete this.candidates["cand-1"];
    delete this.candidates["cand-2"];

    this.farmers["8625098532"] = {
      mobile: "8625098532",
      password: "password",
      name: "Rohit Bhamare",
      email: "rohit@example.com",
      village: "Thalner",
      taluka: "thalner",
      status: "Active"
    };
    this.farmers["9988776655"] = {
      mobile: "9988776655",
      password: "password",
      name: "Baldev Singh",
      email: "baldev@example.com",
      village: "Shirpur",
      taluka: "shirpur",
      status: "Active"
    };

    try {
      if (typeof localStorage !== 'undefined' && !localStorage.getItem("farms_8625098532")) {
        localStorage.setItem("farms_8625098532", JSON.stringify([
          {
            name: "Plot 4-A, Khasra No. 112",
            location: "Thalner, Near Canal",
            area: 3.5,
            contact: "8625098532",
            surveyType: "Boundary Tally",
            cost: 1750,
            registeredAt: new Date().toISOString()
          }
        ]));
      }
    } catch (e) {}

    // Surveyors starts empty; real surveyors are created when candidates apply and are approved by Admin for their specific Taluka

    const candArray = [
      {
        id: "cand-3",
        name: "Amit Deshmukh",
        mobile: "9100229988",
        email: "amit@gmail.com",
        password: "password",
        aadhaar: "111122223333",
        qualification: "B.Tech Civil Engineering",
        experience: 1,
        taluka: "chopda",
        license: "LIC-991122",
        status: "Applied",
        interviewScore: null,
        employeeId: null
      },
      {
        id: "cand-4",
        name: "Priya Sharma",
        mobile: "9500123456",
        email: "priya@gmail.com",
        password: "password",
        aadhaar: "555566667777",
        qualification: "ITI Surveyor Certification",
        experience: 2,
        taluka: "shirpur",
        license: "LIC-445566",
        status: "Interview Pending",
        interviewScore: null,
        employeeId: null
      }
    ];
    
    candArray.forEach(c => {
      this.candidates[c.id] = c;
    });

    talukas.forEach(t => {
      if (!this.waitingLists[t.name]) this.waitingLists[t.name] = [];
    });

    this.saveState();
  }

  solveDijkstra(startNode) {
    const distances = {};
    const prev = {};
    const allNodes = Object.keys(graph);
    
    for (const node of allNodes) {
      distances[node] = Infinity;
      prev[node] = null;
    }
    
    const matchedNode = allNodes.find(n => n.toLowerCase() === String(startNode || '').toLowerCase()) || 'Thalner';
    distances[matchedNode] = 0;
    
    const pq = new Set(allNodes);
    
    while (pq.size) {
      const u = [...pq].reduce((a, b) => (distances[a] < distances[b] ? a : b));
      pq.delete(u);
      if (distances[u] === Infinity) break;
      for (const [v, w] of Object.entries(graph[u] || {})) {
        const alt = distances[u] + w;
        if (distances[v] === undefined || alt < distances[v]) {
          distances[v] = alt;
          prev[v] = u;
        }
      }
    }
    return { distances, prev };
  }

  findNearestAvailableSurveyor(targetNode) {
    const { distances } = this.solveDijkstra(targetNode);
    let nearest = null;
    let minDist = Infinity;
    for (const s of Object.values(this.surveyors)) {
      if (s.status !== "Available") continue;
      const d = distances[s.node];
      if (d !== undefined && d < minDist) {
        minDist = d;
        nearest = s;
      }
    }
    return nearest;
  }
}

/**
 * Authentication Engine – Hybrid Express API with Local Storage Fallback
 */
var AgriConnectAuth = class AgriConnectAuth {
  static async login(identifier, password, role) {
    // 1. Try Express Backend REST API
    try {
      const res = await AgriConnectAPI.apiPost('/auth/login', {
        identifier,
        email: identifier,
        mobile: identifier,
        username: identifier,
        password,
        role: role.toLowerCase()
      });

      if (res && res.success && res.token) {
        AgriConnectAPI.setToken(res.token);
        const effRole = (res.user?.role || role).toLowerCase();
        let normalizedRole = 'Farmer';
        let redirect = 'farmer.html';
        if (effRole === 'admin') {
          normalizedRole = 'Admin';
          redirect = 'admin.html';
        } else if (effRole === 'surveyor') {
          normalizedRole = 'Surveyor';
          redirect = 'surveyor.html';
        } else if (effRole === 'candidate' || effRole === 'applicant') {
          normalizedRole = 'Applicant';
          redirect = 'applicant.html';
        } else {
          normalizedRole = 'Farmer';
          redirect = 'farmer.html';
        }

        const user = { ...(res.user || { name: identifier }), role: normalizedRole };
        AgriConnectAPI.setCurrentUser(user);

        return { success: true, redirect, user, token: res.token, message: res.message || 'Login successful' };
      }

      return {
        success: false,
        status: res ? res.status : 401,
        message: (res && res.message) ? res.message : 'Invalid credentials. Please verify your username, mobile, and password.'
      };
    } catch (err) {
      console.error('API error during login:', err);
      return { success: false, message: `Login connection error: ${err.message}` };
    }
  }

  static async register(userData) {
    try {
      const res = await AgriConnectAPI.apiPost('/auth/register', {
        name: userData.name,
        email: userData.email,
        mobile: userData.mobile,
        password: userData.password,
        role: (userData.role || 'farmer').toLowerCase(),
        village: userData.village || '',
        taluka: userData.taluka || 'thalner'
      });

      if (res && res.success && res.user) {
        if (res.token) AgriConnectAPI.setToken(res.token);
        const userObj = res.user;
        userObj.role = 'Farmer';
        AgriConnectAPI.setCurrentUser(userObj);

        return {
          success: true,
          status: 201,
          message: res.message || 'User registered successfully in MongoDB Atlas',
          user: userObj,
          token: res.token
        };
      }

      return {
        success: false,
        status: res ? res.status : 400,
        message: (res && res.message) ? res.message : 'Registration failed in MongoDB Atlas'
      };
    } catch (err) {
      console.error('Registration error:', err);
      return {
        success: false,
        message: `Registration failed: ${err.message}`
      };
    }
  }

  static localLogin(identifier, password, role) {
    const db = new AgriConnectDB();
    if (typeof window !== 'undefined') window.AgriDB = db;
    let user = null;

    if (role === "Admin") {
      if ((identifier.toLowerCase() === "admin") && password === "admin") {
        user = { name: "Operations Admin", role: "Admin", mobile: "admin", username: "admin" };
      } else {
        return { success: false, message: "Invalid Admin credentials (use admin / admin)." };
      }
    } else if (role === "Applicant") {
      const candList = Array.isArray(db.candidates) ? db.candidates : Object.values(db.candidates);
      user = candList.find(c => (c.email && c.email.toLowerCase() === identifier.toLowerCase()) || c.mobile === identifier);
      if (user) {
        if (user.password && user.password !== password) {
          return { success: false, message: "Incorrect password for this applicant account." };
        }
        user = { ...user, role: "Applicant" };
      } else {
        return { success: false, message: "Applicant email not found. Please submit an application first." };
      }
    } else if (role === "Farmer") {
      const f = db.farmers[identifier];
      if (f) {
        if (f.password === password) {
          user = { ...f, role: "Farmer" };
        } else {
          return { success: false, message: "Incorrect password for farmer." };
        }
      } else {
        return { success: false, message: "Farmer mobile number not found. Please create an account." };
      }
    } else if (role === "Surveyor") {
      const s = db.surveyors[identifier];
      if (s) {
        if (s.password === password) {
          user = { ...s, role: "Surveyor", id: s.id || s.emp_id };
        } else {
          return { success: false, message: "Incorrect password for surveyor." };
        }
      } else {
        const sByOther = Object.values(db.surveyors).find(item => item.id === identifier || item.emp_id === identifier || item.email === identifier);
        if (sByOther && sByOther.password === password) {
          user = { ...sByOther, role: "Surveyor", id: sByOther.id || sByOther.emp_id };
        } else {
          return { success: false, message: "Surveyor account not found with this mobile/username." };
        }
      }
    }

    if (user) {
      AgriConnectAPI.setCurrentUser(user);
      const redirect = role === "Admin" ? "admin.html" : role === "Farmer" ? "farmer.html" : role === "Surveyor" ? "surveyor.html" : "applicant.html";
      return { success: true, redirect, user };
    }
    return { success: false, message: "Invalid credentials. Please check and try again." };
  }

  static getCurrentUser() {
    return AgriConnectAPI.getCurrentUser();
  }

  static checkSession(requiredRole) {
    const user = this.getCurrentUser();
    const token = AgriConnectAPI.getToken();

    if (!user && !token) {
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = "login.html" + (requiredRole ? `?role=${encodeURIComponent(requiredRole)}` : '');
      }
      return null;
    }

    // Verify token with backend asynchronously in the background
    if (token) {
      AgriConnectAPI.apiGet('/auth/me').then(res => {
        if (res && res.status === 401) {
          AgriConnectAPI.removeToken();
          if (typeof window !== 'undefined' && window.location) {
            window.location.href = "login.html" + (requiredRole ? `?role=${encodeURIComponent(requiredRole)}` : '');
          }
        } else if (res && res.success && res.user) {
          AgriConnectAPI.setCurrentUser(res.user);
          const currentRole = (res.user.role || '').toLowerCase();
          if (requiredRole && currentRole && currentRole !== requiredRole.toLowerCase()) {
            if (typeof window !== 'undefined' && window.location) {
              if (requiredRole.toLowerCase() === 'surveyor' && (currentRole === 'candidate' || currentRole === 'applicant')) {
                alert('Surveyor dashboard access is not permitted for candidate accounts until recruitment qualification is complete.');
                window.location.href = 'applicant.html';
              } else {
                alert(`Access denied: ${requiredRole} role required. You are signed in as ${res.user.role}.`);
                window.location.href = "login.html" + (requiredRole ? `?role=${encodeURIComponent(requiredRole)}` : '');
              }
            }
          }
        }
      }).catch(() => {});
    }

    if (requiredRole && user && user.role && user.role.toLowerCase() !== requiredRole.toLowerCase()) {
      if (typeof window !== 'undefined' && window.location) {
        const uRole = user.role.toLowerCase();
        if (requiredRole.toLowerCase() === 'surveyor' && (uRole === 'candidate' || uRole === 'applicant')) {
          alert('Surveyor dashboard access is not permitted for candidate accounts until recruitment qualification is complete.');
          window.location.href = 'applicant.html';
          return null;
        }
        alert(`Access denied: ${requiredRole} role required. You are signed in as ${user.role}.`);
        window.location.href = "login.html" + (requiredRole ? `?role=${encodeURIComponent(requiredRole)}` : '');
      }
      return null;
    }
    return user || { role: requiredRole, name: requiredRole };
  }

  static logout() {
    AgriConnectAPI.removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = "login.html";
    }
  }
}

// Auto-seed DB and make available globally
if (typeof window !== 'undefined') {
  if (!window.AgriDB) window.AgriDB = new AgriConnectDB();
  window.AgriConnectDB = AgriConnectDB;
  window.AgriConnectAuth = AgriConnectAuth;
  window.AgriConnectAPI = AgriConnectAPI;
  window.apiGet = apiGet;
  window.apiPost = apiPost;
  window.apiPut = apiPut;
  window.apiDelete = apiDelete;
  window.getToken = getToken;
  window.setToken = setToken;
  window.removeToken = removeToken;
  window.getCurrentUser = getCurrentUser;
  window.graph = graph;
  window.nodeCoordinates = nodeCoordinates;
  window.talukas = talukas;
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof window !== 'undefined' && !window.AgriDB) {
      window.AgriDB = new AgriConnectDB();
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AgriConnectConfig,
    API_BASE_URL,
    AgriConnectAPI,
    AgriConnectDB,
    AgriConnectAuth,
    graph,
    nodeCoordinates,
    talukas,
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


if (typeof window !== 'undefined') {
  window.AgriConnectAuth = AgriConnectAuth;
  window.AgriConnectDB = AgriConnectDB;
  window.AgriConnectAPI = AgriConnectAPI;
}
if (typeof global !== 'undefined') {
  global.AgriConnectAuth = AgriConnectAuth;
  global.AgriConnectDB = AgriConnectDB;
  global.AgriConnectAPI = AgriConnectAPI;
}
