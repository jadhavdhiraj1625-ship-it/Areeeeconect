// backend/server.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

// Database
const connectDB = require('./config/db');

// Routes
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
// CORS CONFIGURATION
// ======================================================

const allowedOrigins = [
  // Vercel frontend
  'https://agriconnect-2026.vercel.app',

  // Local development
  'http://localhost:5500',
  'http://localhost:3000',
  'http://localhost:5173',

  // 127.0.0.1
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

// Add FRONTEND_URL from Render environment variables if available
if (process.env.FRONTEND_URL) {
  const frontendUrls = process.env.FRONTEND_URL
    .split(',')
    .map(url => url.trim().replace(/\/+$/, ''));

  frontendUrls.forEach(url => {
    if (url && !allowedOrigins.includes(url)) {
      allowedOrigins.push(url);
    }
  });
}

app.use(
  cors({
    origin: function (origin, callback) {

      // Allow requests without Origin
      // Example: Postman, curl, server-to-server
      if (!origin) {
        return callback(null, true);
      }

      // Allow known frontend origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('CORS request from:', origin);

      return callback(new Error('Not allowed by CORS'));
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept'
    ]
  })
);


// ======================================================
// BODY PARSER
// ======================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ======================================================
// DATABASE CONNECTION
// ======================================================

connectDB();


// ======================================================
// SERVE FRONTEND STATIC FILES
// ======================================================

app.use(express.static(path.join(__dirname, '..')));


// ======================================================
// ROOT ROUTE
// ======================================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});


// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/api/health', (req, res) => {

  const state = mongoose.connection.readyState;

  // 0 = disconnected
  // 1 = connected
  // 2 = connecting
  // 3 = disconnecting

  const isConnected = state === 1;

  const dbStatus =
    state === 1
      ? 'connected'
      : state === 2
        ? 'connecting'
        : 'disconnected';

  res.status(isConnected ? 200 : 503).json({
    success: isConnected,

    message: isConnected
      ? 'AgriConnect backend is running'
      : `AgriConnect backend is running (Database ${dbStatus})`,

    database: dbStatus,

    databaseName: 'Areeconnect_database',

    environment: process.env.NODE_ENV || 'production',

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


// ======================================================
// 404 ROUTE
// ======================================================

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });

});


// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {

  console.error('Unhandled server error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });

});


// ======================================================
// START SERVER
// ======================================================

const server = app.listen(PORT, '0.0.0.0', () => {

  console.log('');
  console.log('======================================================');
  console.log('🌾 AgriConnect Backend Running');
  console.log('======================================================');

  console.log(`🌐 Port: ${PORT}`);

  console.log(`🌐 Local URL: http://localhost:${PORT}`);

  console.log(
    `🔑 Login Page: http://localhost:${PORT}/login.html`
  );

  console.log(
    `👑 Admin Page: http://localhost:${PORT}/admin.html`
  );

  console.log(
    `🌾 Farmer Page: http://localhost:${PORT}/farmer.html`
  );

  console.log(
    `📐 Surveyor Page: http://localhost:${PORT}/surveyor.html`
  );

  console.log(
    `📡 API Health: http://localhost:${PORT}/api/health`
  );

  console.log('======================================================');
  console.log('');

});


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  app,
  server
};