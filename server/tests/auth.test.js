/**
 * Authentication Routes Tests
 * Tests for /api/auth endpoints
 */

require('./setup');
const request = require('supertest');
const createApp = require('./app');
const User = require('../models/User');
const { createTestUser, createAdminUser } = require('./helpers');

const app = createApp();

describe('Auth Routes', () => {
  // ==========================================
  // POST /api/auth/register
  // ==========================================
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'SecurePass123!',
        phone: '+1234567890',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(userData.email.toLowerCase());
      expect(res.body.data.token).toBeDefined();
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',
          password: 'SecurePass123!',
        });

      expect(res.status).toBe(400);
    });

    it('should fail with weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: '123',
        });

      expect(res.status).toBe(400);
    });

    it('should fail with duplicate email', async () => {
      await createTestUser({ email: 'duplicate@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Another',
          lastName: 'User',
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already');
    });
  });

  // ==========================================
  // POST /api/auth/login
  // ==========================================
  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const { plainPassword } = await createTestUser({
        email: 'login@example.com',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: plainPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should fail with incorrect password', async () => {
      await createTestUser({ email: 'wrongpass@example.com' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrongpass@example.com',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
    });

    it('should fail with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        });

      expect(res.status).toBe(401);
    });

    it('should fail with inactive account', async () => {
      const { plainPassword } = await createTestUser({
        email: 'inactive@example.com',
        isActive: false,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@example.com',
          password: plainPassword,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // GET /api/auth/me
  // ==========================================
  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      const { token, user } = await createTestUser();

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id.toString()).toBe(user._id.toString());
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // PATCH /api/auth/update-location
  // ==========================================
  describe('PATCH /api/auth/update-location', () => {
    it('should update user location', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch('/api/auth/update-location')
        .set('Authorization', `Bearer ${token}`)
        .send({ lat: 51.5074, lng: -0.1278 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.location.coordinates).toEqual([-0.1278, 51.5074]);
    });

    it('should fail without coordinates', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch('/api/auth/update-location')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should fail with invalid coordinates', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch('/api/auth/update-location')
        .set('Authorization', `Bearer ${token}`)
        .send({ lat: 100, lng: -74.0060 });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // POST /api/auth/refresh
  // ==========================================
  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const userData = {
        firstName: 'Refresh',
        lastName: 'User',
        email: 'refresh@example.com',
        password: 'SecurePass123!',
      };

      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(userData);

      const refreshToken = registerRes.body.data.refreshToken;

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
    });

    it('should fail without refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should fail with invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // POST /api/auth/forgot-password
  // ==========================================
  describe('POST /api/auth/forgot-password', () => {
    it('should return success for any email (security)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'any@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // POST /api/auth/reset-password/:token
  // ==========================================
  describe('POST /api/auth/reset-password/:token', () => {
    it('should fail with invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password/invalid-token')
        .send({ password: 'NewSecurePass123!' });

      expect(res.status).toBe(400);
    });

    it('should fail with short password', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password/any-token')
        .send({ password: '123' });

      expect(res.status).toBe(400);
    });
  });
});
