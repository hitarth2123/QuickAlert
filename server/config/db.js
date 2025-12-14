const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const connectDB = async () => {
  try {
    logger.connection('MongoDB', 'pending', 'Connecting...');
    
    // Connection options
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4
      dbName: 'alertnet_db', // Database name as per spec
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    logger.connection('MongoDB', 'success', `Connected to ${conn.connection.host}/${conn.connection.name}`);

    // Drop problematic sessions index if it exists (one-time fix)
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections({ name: 'sessions' }).toArray();
      if (collections.length > 0) {
        const indexes = await db.collection('sessions').indexes();
        const hasTokenIndex = indexes.some(idx => idx.name === 'token_1');
        if (hasTokenIndex) {
          await db.collection('sessions').dropIndex('token_1');
          logger.info('Dropped problematic token_1 index from sessions collection');
        }
      }
    } catch (indexError) {
      // Index might not exist, that's fine
      if (!indexError.message.includes('index not found')) {
        logger.debug('Session index cleanup:', indexError.message);
      }
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error`, err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.success('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
