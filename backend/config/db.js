// backend/config/db.js
const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers for resolving MongoDB Atlas SRV connection strings on Windows
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {
  // Fallback to default system DNS
}

/**
 * Sanitizes connection strings to prevent credentials from leaking in logs or error messages.
 */
function sanitizeUri(uri) {
  if (!uri) return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
}

/**
 * Connect to MongoDB Atlas via Mongoose.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  } catch (dnsErr) {}

  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.warn(
      '⚠️  [MongoDB Warning] MONGODB_URI is not configured with your Atlas database password in .env.\n' +
      '   Please set your MongoDB Atlas password in backend/.env:\n' +
      '   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.0qqka4s.mongodb.net/Areeconnect_database?retryWrites=true&w=majority'
    );
    return false;
  }

  let attempts = 0;
  while (attempts < 5) {
    try {
      attempts++;
      const conn = await mongoose.connect(uri, {
        dbName: 'Areeconnect_database',
        serverSelectionTimeoutMS: 20000
      });

      console.log(`✅ MongoDB Atlas connected successfully: ${conn.connection.host}`);
      return true;
    } catch (error) {
      const sanitizedMsg = sanitizeUri(error.message);
      console.error(`❌ MongoDB connection attempt ${attempts} failed: ${sanitizedMsg}`);
      if (attempts < 5) {
        console.log('🔄 Retrying MongoDB connection in 2 seconds...');
        await new Promise(r => setTimeout(r, 2000));
      } else {
        return false;
      }
    }
  }
  return false;
};

module.exports = connectDB;
