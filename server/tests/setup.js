/**
 * Test Setup Configuration
 * Configures MongoDB Memory Server and test environment
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Set environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-key-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-12345';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-ok!';
process.env.NODE_ENV = 'test';

// Increase timeout for MongoDB Memory Server setup
jest.setTimeout(30000);

// Setup before all tests
beforeAll(async () => {
  // Create MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect to in-memory database
  await mongoose.connect(mongoUri);
});

// Cleanup after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Disconnect and stop server after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Export for use in tests
module.exports = { mongoServer };
