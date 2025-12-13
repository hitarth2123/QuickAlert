/**
 * Middleware Tests
 * Tests for authentication, authorization, and rate limiting middleware
 */

require('./setup');
const request = require('supertest');
const createApp = require('./app');
const jwt = require('jsonwebtoken');
const {
  createTestUser,
  createAdminUser,
  createResponderUser,
  createTestReport,
  JWT_SECRET,
} = require('./helpers');

const app = createApp();

describe('Middleware', () => {
  
  // ==========================================
  // Authentication Middleware
  // ==========================================
  describe('Authentication Middleware', () => {
    
    it('should allow access with valid token', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer malformed.token.here');

      expect(res.status).toBe(401);
    });

    it('should reject request with expired token', async () => {
      const { user } = await createTestUser();
      
      // Create expired token
      const expiredToken = jwt.sign(
        { id: user._id, role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: '-1h' } // Already expired
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject token with invalid signature', async () => {
      const { user } = await createTestUser();
      
      // Create token with different secret
      const invalidToken = jwt.sign(
        { id: user._id, role: user.role, email: user.email },
        'wrong-secret-key',
        { expiresIn: '7d' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject request for non-existent user', async () => {
      // Create token for non-existent user ID
      const fakeToken = jwt.sign(
        { id: '507f1f77bcf86cd799439011', role: 'user', email: 'fake@test.com' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
    });

    it('should handle Bearer prefix variations', async () => {
      const { token } = await createTestUser();

      // With Bearer prefix
      const res1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res1.status).toBe(200);

      // Without Bearer prefix should fail
      const res2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', token);
      expect(res2.status).toBe(401);
    });
  });

  // ==========================================
  // Authorization Middleware (Role Check)
  // ==========================================
  describe('Authorization Middleware', () => {
    
    it('should allow admin to access admin routes', async () => {
      const { token: adminToken, user: admin } = await createAdminUser();
      const { user } = await createTestUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .patch(`/api/reports/${report._id}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(200);
    });

    it('should deny regular user from admin routes', async () => {
      const { token, user } = await createTestUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .patch(`/api/reports/${report._id}/moderate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(403);
    });

    it('should allow responder to create alerts', async () => {
      const { token: responderToken } = await createResponderUser();

      const res = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${responderToken}`)
        .send({
          title: 'Emergency Alert',
          description: 'Test emergency alert',
          type: 'emergency',
          targetArea: {
            coordinates: [-74.0060, 40.7128],
            radius: 10,
          },
        });

      expect(res.status).toBe(201);
    });

    it('should deny regular user from creating alerts', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Unauthorized Alert',
          description: 'Test',
          type: 'emergency',
          targetArea: {
            coordinates: [-74.0060, 40.7128],
            radius: 10,
          },
        });

      expect(res.status).toBe(403);
    });

    it('should allow admin to access analytics', async () => {
      const { token: adminToken } = await createAdminUser();

      const res = await request(app)
        .get('/api/analytics/reports-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should deny regular user from analytics', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get('/api/analytics/reports-stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should allow responder to access population analytics', async () => {
      const { token: responderToken } = await createResponderUser();

      const res = await request(app)
        .get('/api/analytics/population')
        .set('Authorization', `Bearer ${responderToken}`)
        .query({ lat: 40.7128, lng: -74.0060, radius: 10 });

      expect(res.status).toBe(200);
    });
  });

  // ==========================================
  // Optional Auth Middleware
  // ==========================================
  describe('Optional Auth Middleware', () => {
    
    it('should allow anonymous report submission', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({
          title: 'Anonymous Report',
          description: 'Test anonymous report submission',
          category: 'other',
          location: {
            coordinates: [-74.0060, 40.7128],
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.isAnonymous).toBe(true);
    });

    it('should include user info when authenticated', async () => {
      const { token, user } = await createTestUser();

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Authenticated Report',
          description: 'Test authenticated report submission',
          category: 'other',
          location: {
            coordinates: [-74.0060, 40.7128],
          },
          isAnonymous: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.reporter.toString()).toBe(user._id.toString());
    });
  });

  // ==========================================
  // Public Routes
  // ==========================================
  describe('Public Routes', () => {
    
    it('should allow access to public reports without auth', async () => {
      const { user } = await createTestUser();
      await createTestReport(user._id);

      const res = await request(app).get('/api/reports');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow access to public alerts without auth', async () => {
      const res = await request(app).get('/api/alerts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow access to single report without auth', async () => {
      const { user } = await createTestUser();
      const report = await createTestReport(user._id);

      const res = await request(app).get(`/api/reports/${report._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
