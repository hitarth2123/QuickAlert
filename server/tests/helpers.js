/**
 * Test Helpers and Utilities
 * Common functions used across all test files
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const Report = require('../models/Report');
const Alert = require('../models/Alert');

// JWT Secret for tests
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

// Simple random data generators (avoiding faker ESM issues)
const randomId = () => crypto.randomBytes(4).toString('hex');
const randomEmail = () => `test_${randomId()}@example.com`;
const randomFirstName = () => ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana'][Math.floor(Math.random() * 6)];
const randomLastName = () => ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis'][Math.floor(Math.random() * 6)];
const randomPhone = () => `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`;
const randomFromArray = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomLng = () => (Math.random() * 360 - 180).toFixed(6);
const randomLat = () => (Math.random() * 180 - 90).toFixed(6);
const randomSentence = () => `Test ${randomId()} alert message`;
const randomParagraph = () => `This is a test description ${randomId()} for testing purposes.`;

/**
 * Generate a valid JWT token for testing
 */
const generateTestToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Create a test user with optional overrides
 */
const createTestUser = async (overrides = {}) => {
  // Don't pre-hash - User model handles hashing on save
  const plainPassword = 'TestPassword123!';
  
  const userData = {
    firstName: randomFirstName(),
    lastName: randomLastName(),
    email: randomEmail(),
    password: plainPassword,  // User model will hash this
    phone: randomPhone(),
    role: 'user',
    isVerified: true,
    isActive: true,
    location: {
      type: 'Point',
      coordinates: [
        parseFloat(randomLng()),
        parseFloat(randomLat())
      ],
    },
    ...overrides,
  };

  const user = await User.create(userData);
  const token = generateTestToken(user);
  
  return { user, token, plainPassword };
};

/**
 * Create an admin user
 */
const createAdminUser = async (overrides = {}) => {
  return createTestUser({ role: 'admin', ...overrides });
};

/**
 * Create a super admin user
 */
const createSuperAdminUser = async (overrides = {}) => {
  return createTestUser({ role: 'super_admin', ...overrides });
};

/**
 * Create a responder user
 */
const createResponderUser = async (overrides = {}) => {
  return createTestUser({ role: 'responder', ...overrides });
};

/**
 * Create a test report
 */
const createTestReport = async (userId, overrides = {}) => {
  const categories = ['accident', 'fire', 'crime', 'medical', 'infrastructure', 'weather', 'emergency', 'natural_disaster', 'traffic', 'other'];
  const severities = ['low', 'medium', 'high', 'critical'];
  
  const reportData = {
    title: randomSentence(),
    description: randomParagraph(),
    category: randomFromArray(categories),
    location: {
      type: 'Point',
      coordinates: [
        parseFloat(randomLng()),
        parseFloat(randomLat())
      ],
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      country: 'Testland',
    },
    severity: randomFromArray(severities),
    reporter: userId,
    status: 'pending',
    ...overrides,
  };

  return Report.create(reportData);
};

/**
 * Create a test alert
 */
const createTestAlert = async (userId, overrides = {}) => {
  const types = ['weather', 'emergency', 'traffic', 'crime', 'health', 'infrastructure', 'community', 'government', 'other'];
  const severities = ['advisory', 'warning', 'critical', 'extreme'];
  
  const alertData = {
    title: randomSentence(),
    description: randomParagraph(),
    type: randomFromArray(types),
    severity: randomFromArray(severities),
    source: {
      type: 'official',
      officialSource: 'admin',
    },
    createdBy: userId,
    targetArea: {
      type: 'Circle',
      coordinates: [
        parseFloat(randomLng()),
        parseFloat(randomLat())
      ],
      radius: 10,
      city: 'Test City',
      state: 'TS',
      country: 'Testland',
    },
    status: 'active',
    isActive: true,
    ...overrides,
  };

  return Alert.create(alertData);
};

/**
 * Generate random coordinates near a given point
 */
const generateNearbyCoordinates = (baseLng, baseLat, maxDistanceKm = 5) => {
  // Rough approximation: 1 degree = ~111km
  const maxDegrees = maxDistanceKm / 111;
  const lng = baseLng + (Math.random() - 0.5) * 2 * maxDegrees;
  const lat = baseLat + (Math.random() - 0.5) * 2 * maxDegrees;
  return [lng, lat];
};

/**
 * Wait for a specified time (for async operations)
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  generateTestToken,
  createTestUser,
  createAdminUser,
  createSuperAdminUser,
  createResponderUser,
  createTestReport,
  createTestAlert,
  generateNearbyCoordinates,
  wait,
  JWT_SECRET,
};
