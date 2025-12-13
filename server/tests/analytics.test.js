/**
 * Analytics Routes Tests
 * Tests for /api/analytics endpoints
 */

require('./setup');
const request = require('supertest');
const createApp = require('./app');
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const User = require('../models/User');
const {
  createTestUser,
  createAdminUser,
  createResponderUser,
  createTestReport,
  createTestAlert,
} = require('./helpers');

const app = createApp();

describe('Analytics Routes', () => {
  
  // ==========================================
  // GET /api/analytics/population
  // ==========================================
  describe('GET /api/analytics/population', () => {
    
    it('should return population count for radius query', async () => {
      const { token: adminToken } = await createAdminUser();
      
      // Create some users with locations
      await createTestUser({
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      });

      const res = await request(app)
        .get('/api/analytics/population')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ lat: 40.7128, lng: -74.0060, radius: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.population).toBeDefined();
      expect(typeof res.body.data.population).toBe('number');
    });

    it('should require lat, lng, and radius OR polygon', async () => {
      const { token: adminToken } = await createAdminUser();

      const res = await request(app)
        .get('/api/analytics/population')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should deny regular user access', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get('/api/analytics/population')
        .set('Authorization', `Bearer ${token}`)
        .query({ lat: 40.7128, lng: -74.0060, radius: 10 });

      expect(res.status).toBe(403);
    });

    it('should allow responder access', async () => {
      const { token: responderToken } = await createResponderUser();

      const res = await request(app)
        .get('/api/analytics/population')
        .set('Authorization', `Bearer ${responderToken}`)
        .query({ lat: 40.7128, lng: -74.0060, radius: 10 });

      expect(res.status).toBe(200);
    });

    it('should support polygon query', async () => {
      const { token: adminToken } = await createAdminUser();

      const polygon = [
        [-74.1, 40.6],
        [-74.1, 40.8],
        [-73.9, 40.8],
        [-73.9, 40.6],
        [-74.1, 40.6],
      ];

      const res = await request(app)
        .get('/api/analytics/population')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ polygon: JSON.stringify(polygon) });

      expect(res.status).toBe(200);
      expect(res.body.data.query).toBe('polygon');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/analytics/population')
        .query({ lat: 40.7128, lng: -74.0060, radius: 10 });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // GET /api/analytics/reports-stats
  // ==========================================
  describe('GET /api/analytics/reports-stats', () => {
    
    it('should return report statistics for admin', async () => {
      const { token: adminToken } = await createAdminUser();
      const { user } = await createTestUser();
      
      // Create some reports
      await createTestReport(user._id, { category: 'accident', severity: 'high' });
      await createTestReport(user._id, { category: 'fire', severity: 'medium' });
      await createTestReport(user._id, { category: 'accident', severity: 'low' });

      const res = await request(app)
        .get('/api/analytics/reports-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeDefined();
      expect(res.body.data.byCategory).toBeDefined();
      expect(res.body.data.bySeverity).toBeDefined();
      expect(res.body.data.byStatus).toBeDefined();
    });

    it('should filter by date range', async () => {
      const { token: adminToken } = await createAdminUser();
      const { user } = await createTestUser();
      
      await createTestReport(user._id);

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const res = await request(app)
        .get('/api/analytics/reports-stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ startDate, endDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by category', async () => {
      const { token: adminToken } = await createAdminUser();
      const { user } = await createTestUser();
      
      await createTestReport(user._id, { category: 'accident' });
      await createTestReport(user._id, { category: 'fire' });

      const res = await request(app)
        .get('/api/analytics/reports-stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ category: 'accident' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should deny regular user access', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get('/api/analytics/reports-stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should include verification statistics', async () => {
      const { token: adminToken } = await createAdminUser();
      const { user } = await createTestUser();
      
      await createTestReport(user._id, { verificationStatus: 'verified' });
      await createTestReport(user._id, { verificationStatus: 'unverified' });

      const res = await request(app)
        .get('/api/analytics/reports-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.verified).toBeDefined();
      expect(res.body.data.unverified).toBeDefined();
    });

    it('should include over time data', async () => {
      const { token: adminToken } = await createAdminUser();
      const { user } = await createTestUser();
      
      await createTestReport(user._id);

      const res = await request(app)
        .get('/api/analytics/reports-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.overTime).toBeDefined();
      expect(Array.isArray(res.body.data.overTime)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/analytics/reports-stats');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // GET /api/analytics/heatmap
  // ==========================================
  describe('GET /api/analytics/heatmap', () => {
    
    it('should return user heatmap data for admin', async () => {
      const { token: adminToken } = await createAdminUser();
      
      // Create users with locations
      await createTestUser({
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      });

      const res = await request(app)
        .get('/api/analytics/heatmap')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ type: 'users', lat: 40.7128, lng: -74.0060, radius: 50 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('users');
      expect(res.body.data.points).toBeDefined();
      expect(Array.isArray(res.body.data.points)).toBe(true);
    });

    it('should return report heatmap data', async () => {
      const { token: adminToken } = await createAdminUser();
      const { user } = await createTestUser();
      
      await createTestReport(user._id);

      const res = await request(app)
        .get('/api/analytics/heatmap')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ type: 'reports' });

      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('reports');
    });

    it('should support custom grid size', async () => {
      const { token: adminToken } = await createAdminUser();

      const res = await request(app)
        .get('/api/analytics/heatmap')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ type: 'users', gridSize: 0.05 });

      expect(res.status).toBe(200);
      expect(res.body.data.gridSize).toBe(0.05);
    });

    it('should deny regular user access', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get('/api/analytics/heatmap')
        .set('Authorization', `Bearer ${token}`)
        .query({ type: 'users' });

      expect(res.status).toBe(403);
    });

    it('should allow responder access', async () => {
      const { token: responderToken } = await createResponderUser();

      const res = await request(app)
        .get('/api/analytics/heatmap')
        .set('Authorization', `Bearer ${responderToken}`)
        .query({ type: 'users' });

      expect(res.status).toBe(200);
    });

    it('should include bounds when data exists', async () => {
      const { token: adminToken } = await createAdminUser();
      
      // Create users with locations to generate heatmap data
      for (let i = 0; i < 3; i++) {
        await createTestUser({
          location: {
            type: 'Point',
            coordinates: [-74.0060 + i * 0.01, 40.7128 + i * 0.01],
          },
        });
      }

      const res = await request(app)
        .get('/api/analytics/heatmap')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ type: 'users' });

      expect(res.status).toBe(200);
      if (res.body.data.points.length > 0) {
        expect(res.body.data.bounds).toBeDefined();
        expect(res.body.data.maxIntensity).toBeDefined();
      }
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/analytics/heatmap')
        .query({ type: 'users' });

      expect(res.status).toBe(401);
    });
  });
});
