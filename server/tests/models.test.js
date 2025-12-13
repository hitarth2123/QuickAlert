/**
 * Models Tests
 * Tests for Mongoose models and schema validations
 */

require('./setup');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const Session = require('../models/Session');
const ReportVerification = require('../models/ReportVerification');
const Verification = require('../models/Verification');

describe('Models', () => {
  
  // ==========================================
  // User Model
  // ==========================================
  describe('User Model', () => {
    
    it('should create a user with valid data', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: await bcrypt.hash('password123', 10),
        phone: '+1234567890',
      };

      const user = await User.create(userData);

      expect(user._id).toBeDefined();
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe('user'); // Default role
      expect(user.isActive).toBe(true); // Default active
    });

    it('should require email field', async () => {
      const userData = {
        firstName: 'No',
        lastName: 'Email',
        password: 'password123',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should enforce unique email', async () => {
      const userData = {
        firstName: 'User',
        lastName: 'One',
        email: 'unique@example.com',
        password: await bcrypt.hash('password123', 10),
      };

      await User.create(userData);

      const duplicateUser = {
        firstName: 'User',
        lastName: 'Two',
        email: 'unique@example.com',
        password: await bcrypt.hash('password456', 10),
      };

      await expect(User.create(duplicateUser)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const userData = {
        firstName: 'Invalid',
        lastName: 'Email',
        email: 'not-an-email',
        password: 'password123',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should validate role enum', async () => {
      const userData = {
        firstName: 'Invalid',
        lastName: 'Role',
        email: 'role@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'invalid_role',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should store location as GeoJSON Point', async () => {
      const userData = {
        firstName: 'Location',
        lastName: 'User',
        email: 'location@example.com',
        password: await bcrypt.hash('password123', 10),
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      };

      const user = await User.create(userData);

      expect(user.location.type).toBe('Point');
      expect(user.location.coordinates).toEqual([-74.0060, 40.7128]);
    });

    it('should have timestamps', async () => {
      const user = await User.create({
        firstName: 'Timestamp',
        lastName: 'User',
        email: 'timestamp@example.com',
        password: await bcrypt.hash('password123', 10),
      });

      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });
  });

  // ==========================================
  // Report Model
  // ==========================================
  describe('Report Model', () => {
    
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        firstName: 'Report',
        lastName: 'Tester',
        email: 'reporter@example.com',
        password: await bcrypt.hash('password123', 10),
      });
    });

    it('should create a report with valid data', async () => {
      const reportData = {
        title: 'Test Report',
        description: 'Test description',
        category: 'accident',
        severity: 'high',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
          address: '123 Test St',
          city: 'New York',
        },
        reporter: testUser._id,
      };

      const report = await Report.create(reportData);

      expect(report._id).toBeDefined();
      expect(report.title).toBe(reportData.title);
      expect(report.status).toBe('pending'); // Default status
      expect(report.verificationStatus).toBe('unverified'); // Default
    });

    it('should require title field', async () => {
      const reportData = {
        description: 'No title',
        category: 'other',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
        reporter: testUser._id,
      };

      await expect(Report.create(reportData)).rejects.toThrow();
    });

    it('should validate category enum', async () => {
      const reportData = {
        title: 'Invalid Category',
        description: 'Test',
        category: 'invalid_category',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
        reporter: testUser._id,
      };

      await expect(Report.create(reportData)).rejects.toThrow();
    });

    it('should validate severity enum', async () => {
      const reportData = {
        title: 'Invalid Severity',
        description: 'Test',
        category: 'other',
        severity: 'invalid_severity',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
        reporter: testUser._id,
      };

      await expect(Report.create(reportData)).rejects.toThrow();
    });

    it('should initialize votes to zero', async () => {
      const report = await Report.create({
        title: 'Vote Test',
        description: 'Test',
        category: 'other',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
        reporter: testUser._id,
      });

      expect(report.votes.up).toBe(0);
      expect(report.votes.down).toBe(0);
    });

    it('should store updates as embedded documents', async () => {
      const report = await Report.create({
        title: 'Update Test',
        description: 'Test',
        category: 'other',
        severity: 'low',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
        reporter: testUser._id,
        updates: [
          {
            author: testUser._id,
            content: 'First update',
          },
        ],
      });

      expect(report.updates.length).toBe(1);
      expect(report.updates[0].content).toBe('First update');
    });
  });

  // ==========================================
  // Alert Model
  // ==========================================
  describe('Alert Model', () => {
    
    let adminUser;

    beforeEach(async () => {
      adminUser = await User.create({
        firstName: 'Alert',
        lastName: 'Admin',
        email: 'alertadmin@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'admin',
      });
    });

    it('should create an alert with valid data', async () => {
      const alertData = {
        title: 'Weather Alert',
        description: 'Heavy rain expected',
        type: 'weather',
        severity: 'warning',
        source: {
          type: 'official',
          officialSource: 'admin',
        },
        createdBy: adminUser._id,
        targetArea: {
          type: 'Circle',
          coordinates: [-74.0060, 40.7128],
          radius: 10,
        },
      };

      const alert = await Alert.create(alertData);

      expect(alert._id).toBeDefined();
      expect(alert.title).toBe(alertData.title);
      expect(alert.type).toBe('weather');
      expect(alert.isActive).toBe(true);
    });

    it('should validate alert type enum', async () => {
      const alertData = {
        title: 'Invalid Type',
        description: 'Test',
        type: 'invalid_type',
        source: {
          type: 'official',
          officialSource: 'admin',
        },
        createdBy: adminUser._id,
        targetArea: {
          type: 'Circle',
          coordinates: [-74.0060, 40.7128],
          radius: 10,
        },
      };

      await expect(Alert.create(alertData)).rejects.toThrow();
    });

    it('should validate severity enum', async () => {
      const alertData = {
        title: 'Invalid Severity',
        description: 'Test',
        type: 'other',
        severity: 'invalid_severity',
        source: {
          type: 'official',
          officialSource: 'admin',
        },
        createdBy: adminUser._id,
        targetArea: {
          type: 'Circle',
          coordinates: [-74.0060, 40.7128],
          radius: 10,
        },
      };

      await expect(Alert.create(alertData)).rejects.toThrow();
    });

    it('should initialize delivery stats', async () => {
      const alert = await Alert.create({
        title: 'Delivery Test',
        description: 'Test',
        type: 'other',
        source: {
          type: 'official',
          officialSource: 'admin',
        },
        createdBy: adminUser._id,
        targetArea: {
          type: 'Circle',
          coordinates: [-74.0060, 40.7128],
          radius: 10,
        },
      });

      expect(alert.delivery.sent).toBe(0);
      expect(alert.delivery.read).toBe(0);
      expect(alert.delivery.delivered).toBe(0);
    });
  });

  // ==========================================
  // Session Model
  // ==========================================
  describe('Session Model', () => {
    
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        firstName: 'Session',
        lastName: 'User',
        email: 'session@example.com',
        password: await bcrypt.hash('password123', 10),
      });
    });

    it('should create a session with valid data', async () => {
      const sessionData = {
        token: 'unique_token_123456',
        userId: testUser._id,
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
        socketId: 'socket_123',
        ipAddress: '192.168.1.1',
      };

      const session = await Session.create(sessionData);

      expect(session._id).toBeDefined();
      expect(session.token).toBe(sessionData.token);
      expect(session.lastPing).toBeDefined();
    });

    it('should require token', async () => {
      const sessionData = {
        userId: testUser._id,
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      };

      await expect(Session.create(sessionData)).rejects.toThrow();
    });

    it('should enforce unique token', async () => {
      const sessionData = {
        token: 'unique_session_token',
        userId: testUser._id,
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      };

      await Session.create(sessionData);

      const duplicateSession = {
        token: 'unique_session_token',
        userId: testUser._id,
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      };

      await expect(Session.create(duplicateSession)).rejects.toThrow();
    });
  });

  // ==========================================
  // ReportVerification Model
  // ==========================================
  describe('ReportVerification Model', () => {
    
    let testUser, testReport;

    beforeEach(async () => {
      testUser = await User.create({
        firstName: 'Verify',
        lastName: 'User',
        email: 'verifier@example.com',
        password: await bcrypt.hash('password123', 10),
      });

      const reporter = await User.create({
        firstName: 'Report',
        lastName: 'Creator',
        email: 'reporter2@example.com',
        password: await bcrypt.hash('password123', 10),
      });

      testReport = await Report.create({
        title: 'Test Report',
        description: 'Test',
        category: 'other',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
        reporter: reporter._id,
      });
    });

    it('should create a verification record', async () => {
      const verificationData = {
        reportId: testReport._id,
        userId: testUser._id,
        vote: 'confirm',
        userLocation: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      };

      const verification = await ReportVerification.create(verificationData);

      expect(verification._id).toBeDefined();
      expect(verification.vote).toBe('confirm');
    });

    it('should validate vote enum (confirm/deny)', async () => {
      const verificationData = {
        reportId: testReport._id,
        userId: testUser._id,
        vote: 'invalid_vote',
        userLocation: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      };

      await expect(ReportVerification.create(verificationData)).rejects.toThrow();
    });

    it('should enforce unique reportId + userId combination', async () => {
      const verificationData = {
        reportId: testReport._id,
        userId: testUser._id,
        vote: 'confirm',
        userLocation: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      };

      await ReportVerification.create(verificationData);

      // Try to create duplicate
      await expect(ReportVerification.create(verificationData)).rejects.toThrow();
    });
  });

  // ==========================================
  // Verification Model (Email/Phone)
  // ==========================================
  describe('Verification Model', () => {
    
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        firstName: 'Verification',
        lastName: 'User',
        email: 'verify@example.com',
        password: await bcrypt.hash('password123', 10),
      });
    });

    it('should create email verification token', async () => {
      const verificationData = {
        user: testUser._id,
        type: 'email',
        token: 'abc123token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      const verification = await Verification.create(verificationData);

      expect(verification._id).toBeDefined();
      expect(verification.type).toBe('email');
      expect(verification.status).toBe('pending');
    });

    it('should create phone verification', async () => {
      const verificationData = {
        user: testUser._id,
        type: 'phone',
        token: 'phone123token',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      };

      const verification = await Verification.create(verificationData);

      expect(verification.type).toBe('phone');
    });

    it('should validate verification type enum', async () => {
      const verificationData = {
        user: testUser._id,
        type: 'invalid_type',
        token: 'token123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      await expect(Verification.create(verificationData)).rejects.toThrow();
    });
  });

  // ==========================================
  // Geospatial Index Tests
  // ==========================================
  describe('Geospatial Indexes', () => {
    
    it('should support geospatial queries on User location', async () => {
      // Create users at different locations
      await User.create({
        firstName: 'NYC',
        lastName: 'User',
        email: 'nyc@example.com',
        password: await bcrypt.hash('password123', 10),
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128], // New York
        },
      });

      await User.create({
        firstName: 'LA',
        lastName: 'User',
        email: 'la@example.com',
        password: await bcrypt.hash('password123', 10),
        location: {
          type: 'Point',
          coordinates: [-118.2437, 34.0522], // Los Angeles
        },
      });

      // Query users near NYC (within 100km)
      const nearbyUsers = await User.find({
        'location.coordinates': {
          $geoWithin: {
            $centerSphere: [[-74.0060, 40.7128], 100 / 6371],
          },
        },
      });

      expect(nearbyUsers.length).toBe(1);
      expect(nearbyUsers[0].firstName).toBe('NYC');
    });

    it('should support geospatial queries on Report location', async () => {
      const user = await User.create({
        firstName: 'Geo',
        lastName: 'Reporter',
        email: 'geo@example.com',
        password: await bcrypt.hash('password123', 10),
      });

      await Report.create({
        title: 'NYC Report',
        description: 'Test',
        category: 'other',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
        reporter: user._id,
      });

      await Report.create({
        title: 'LA Report',
        description: 'Test',
        category: 'other',
        location: {
          type: 'Point',
          coordinates: [-118.2437, 34.0522],
        },
        reporter: user._id,
      });

      // Query reports near NYC
      const nearbyReports = await Report.find({
        'location.coordinates': {
          $geoWithin: {
            $centerSphere: [[-74.0060, 40.7128], 50 / 6371],
          },
        },
      });

      expect(nearbyReports.length).toBe(1);
      expect(nearbyReports[0].title).toBe('NYC Report');
    });
  });
});
