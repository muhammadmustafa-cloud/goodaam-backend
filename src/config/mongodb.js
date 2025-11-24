const mongoose = require('mongoose');
const logger = require('./logger');

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  logger.error('❌ DATABASE_URL environment variable is not set!');
  logger.error('Please create .env.local (for local) or .env (for production) file.');
  process.exit(1);
}

// Log which database is being used (without exposing credentials)
const dbUrl = process.env.DATABASE_URL;
// Try to parse MongoDB connection string
let dbInfo = null;
if (dbUrl.startsWith('mongodb+srv://')) {
  dbInfo = dbUrl.match(/mongodb\+srv:\/\/[^:]+:[^@]+@([^/]+)\/(.+)/);
} else if (dbUrl.startsWith('mongodb://')) {
  dbInfo = dbUrl.match(/mongodb:\/\/(?:[^:]+:[^@]+@)?([^/]+)\/(.+)/);
}

if (dbInfo) {
  const [, host, database] = dbInfo;
  logger.info(`📊 Database: ${database} @ ${host}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
} else {
  logger.warn('⚠️ Could not parse DATABASE_URL format - will attempt connection anyway');
}

// MongoDB connection options
const options = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4 // Use IPv4, skip trying IPv6
};

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL, options);
    logger.info('✅ Connected to MongoDB');
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('✅ MongoDB reconnected');
    });

  } catch (error) {
    logger.error('❌ MongoDB Connection Error', {
      message: error.message,
      stack: error.stack,
    });
    logger.error('💡 Tip: Check your DATABASE_URL in .env file');
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('👋 MongoDB connection closed through app termination');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  logger.info('👋 MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = { connectDB, mongoose };

