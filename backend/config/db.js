// backend/config/db.js
const mongoose = require('mongoose');
const dns = require('dns');

// DNS server fallback for robust SRV lookup across cloud container environments
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {}

let lastConnectionError = null;

/**
 * Sanitizes MongoDB connection string to prevent passwords or sensitive tokens from appearing in logs.
 */
function sanitizeUri(uri) {
  if (!uri) return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

/**
 * Categorizes connection errors to provide clear, actionable guidance without exposing secrets.
 */
function categorizeError(errMsg) {
  if (!errMsg) return 'Unknown database error';
  const lower = errMsg.toLowerCase();
  if (lower.includes('bad auth') || lower.includes('authentication failed')) {
    return 'MongoDB Authentication Failed: The username or password in MONGODB_URI is incorrect. Please verify your MongoDB Atlas Database User credentials.';
  }
  if (lower.includes('enotfound') || lower.includes('querysrv') || lower.includes('getaddrinfo')) {
    return 'MongoDB Network/DNS Error: Unable to resolve Atlas cluster host. Ensure cluster URL is correct.';
  }
  if (lower.includes('whitelisted') || lower.includes('connection refused') || lower.includes('timed out') || lower.includes('serverselection')) {
    return 'MongoDB Network Access Error: Connection timed out. Ensure Network Access in MongoDB Atlas allows access (0.0.0.0/0).';
  }
  return errMsg;
}

/**
 * Connect to MongoDB Atlas via Mongoose.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    lastConnectionError = 'MONGODB_URI environment variable is not set. Please configure it in your Render service environment variables.';
    console.error('❌ [Database Error] ' + lastConnectionError);
    return false;
  }

  if (uri.includes('<username>') || uri.includes('<password>')) {
    lastConnectionError = 'MONGODB_URI contains placeholder text (<username> or <password>). Please set real MongoDB Atlas credentials in Render environment variables.';
    console.error('❌ [Database Error] ' + lastConnectionError);
    return false;
  }

  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      const conn = await mongoose.connect(uri, {
        dbName: 'Areeconnect_database',
        serverSelectionTimeoutMS: 15000
      });

      lastConnectionError = null;
      console.log(`✅ MongoDB Atlas connected successfully: ${conn.connection.host} (${conn.connection.name})`);
      return true;
    } catch (error) {
      const sanitized = sanitizeUri(error.message);
      lastConnectionError = categorizeError(error.message);
      console.error(`❌ MongoDB connection attempt ${attempts}/${maxAttempts} failed: ${lastConnectionError}`);

      // If it's a bad auth error, retrying immediately won't help credentials; exit retry loop
      if (error.message.toLowerCase().includes('bad auth') || error.message.toLowerCase().includes('authentication failed')) {
        console.error('⚠️  Authentication failure detected. Please update MONGODB_URI in Render dashboard with valid Atlas user credentials.');
        return false;
      }

      if (attempts < maxAttempts) {
        console.log('🔄 Retrying MongoDB connection in 3 seconds...');
        await new Promise(r => setTimeout(r, 3000));
      } else {
        return false;
      }
    }
  }

  return false;
};

const getLastError = () => lastConnectionError;

module.exports = { connectDB, getLastError, sanitizeUri };
