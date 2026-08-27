// backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables (from .env in local dev or Render Environment Variables in cloud)
dotenv.config();

// Database Connection
const { connectDB, getLastError } = require('./config/db');

// API Routes
const authRoutes = require('./routes/authRoutes');
const farmRoutes = require('./routes/farmRoutes');
const surveyorRoutes = require('./routes/surveyorRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const adminRoutes = require('./routes/adminRoutes');
const talukaRoutes = require('./routes/talukaRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ======================================================
// CORS CONFIGURATION (Vercel Frontend & Dev Origins)
// ======================================================
const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:5500',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

if (process.env.FRONTEND_URL) {
  const customOrigins = process.env.FRONTEND_URL.split(',').map(u => u.trim().replace(/\/+$/, ''));
  customOrigins.forEach(u => {
    if (u && !allowedOrigins.includes(u)) allowedOrigins.push(u);
  });
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser clients (curl, Postman, server-to-server, mobile)
    if (!origin) return callback(null, true);

    const isMatch = allowedOrigins.some(allowed => {
      if (allowed === '*' || origin === allowed) return true;
      if (allowed.includes('*')) {
        const regex = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return regex.test(origin);
      }
      return false;
    }) || origin.endsWith('.vercel.app') || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    if (isMatch) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Request from origin: ${origin}`);
      // Allow Vercel preview URLs and standard origins
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Establish Database Connection
connectDB();

// ======================================================
// ROOT API STATUS ROUTE (Pure REST API, No Frontend)
// ======================================================
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AgriConnect Backend API is active',
    service: 'agriconnect-backend',
    health: '/api/health',
    version: '2.0.0'
  });
});

// ======================================================
// HEALTH CHECK ENDPOINT
// ======================================================
app.get('/api/health', (req, res) => {
  const state = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const isConnected = state === 1;
  const dbStatus = state === 1 ? 'connected' : state === 2 ? 'connecting' : 'disconnected';
  const lastError = getLastError();

  res.status(isConnected ? 200 : 503).json({
    success: isConnected,
    database: dbStatus,
    databaseName: 'Areeconnect_database',
    environment: process.env.NODE_ENV || 'production',
    message: isConnected ? 'AgriConnect backend is running' : `AgriConnect backend is running (Database ${dbStatus})`,
    ...(lastError && !isConnected ? { error: lastError } : {}),
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// API ROUTES
// ======================================================
app.use('/api/auth', authRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/surveyors', surveyorRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/talukas', talukaRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route '${req.originalUrl}' not found`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server on 0.0.0.0 (Required for Render)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log('🌾 AgriConnect Backend API Service Running');
  console.log(`🌐 Host & Port:     0.0.0.0:${PORT}`);
  console.log(`📡 API Health:      /api/health`);
  console.log('======================================================\n');
});

module.exports = { app, server };
