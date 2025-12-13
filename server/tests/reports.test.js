/**
 * Reports Routes Tests
 * Tests for /api/reports endpoints
 */

require('./setup');
const request = require('supertest');
const createApp = require('./app');
const Report = require('../models/Report');
const {
  createTestUser,
  createAdminUser,
  createResponderUser,
  createTestReport,
} = require('./helpers');

const app = createApp();

describe('Reports Routes', () => {
  
  // ==========================================
  // POST /api/reports
  // ==========================================
  describe('POST /api/reports', () => {
    
    it('should create a new report successfully with authentication', async () => {
      const { token } = await createTestUser();

      const reportData = {
        title: 'Traffic Accident on Main Street',
        description: 'Two cars collided at the intersection',
        category: 'accident',
        location: {
          coordinates: [-74.0060, 40.7128],
          address: '123 Main Street',
          city: 'New York',
          state: 'NY',
          country: 'USA',
        },
        severity: 'high',
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(reportData.title);
      expect(res.body.data.category).toBe(reportData.category);
      expect(res.body.data.location.coordinates).toEqual([-74.0060, 40.7128]);
    });

    it('should allow anonymous report creation (optionalAuth)', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({
          title: 'Anonymous Report',
          description: 'Test description for anonymous report',
          category: 'other',
          location: {
            coordinates: [-74.0060, 40.7128],
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAnonymous).toBe(true);
    });

    it('should fail with missing required fields', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Incomplete Report' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('title, description, category, and location');
    });

    it('should fail with invalid category', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test Report',
          description: 'Test description',
          category: 'invalid_category',
          location: {
            coordinates: [-74.0060, 40.7128],
          },
        });

      expect(res.status).toBe(400);
    });

    it('should fail with invalid coordinates', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test Report',
          description: 'Test description',
          category: 'accident',
          location: {
            coordinates: 'invalid',
          },
        });

      expect(res.status).toBe(400);
    });

    it('should fail with missing coordinates in location', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test Report',
          description: 'Test description',
          category: 'accident',
          location: {
            address: 'Some address without coordinates',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('coordinates');
    });

    it('should emit socket event on report creation', async () => {
      const { token } = await createTestUser();
      const io = app.get('io');

      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Socket Test Report',
          description: 'Testing socket emission',
          category: 'fire',
          location: {
            coordinates: [-74.0060, 40.7128],
          },
        });

      expect(io.emitNewReport).toHaveBeenCalled();
    });

    it('should encrypt sensitive data if provided', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Report with Sensitive Data',
          description: 'Test description',
          category: 'crime',
          location: {
            coordinates: [-74.0060, 40.7128],
          },
          sensitiveData: 'Some sensitive information',
        });

      expect(res.status).toBe(201);
      
      // Verify sensitive data was stored (encrypted)
      const report = await Report.findById(res.body.data._id);
      expect(report.sensitiveData).toBeDefined();
      expect(report.sensitiveData).not.toBe('Some sensitive information'); // Should be encrypted
    });
  });

  // ==========================================
  // GET /api/reports
  // ==========================================
  describe('GET /api/reports', () => {
    
    it('should return all active reports', async () => {
      const { user } = await createTestUser();
      
      await createTestReport(user._id);
      await createTestReport(user._id);

      const res = await request(app).get('/api/reports');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter reports by category', async () => {
      const { user } = await createTestUser();
      
      await createTestReport(user._id, { category: 'accident' });
      await createTestReport(user._id, { category: 'fire' });

      const res = await request(app)
        .get('/api/reports')
        .query({ category: 'accident' });

      expect(res.status).toBe(200);
      res.body.data.forEach(report => {
        expect(report.category).toBe('accident');
      });
    });

    it('should filter reports by severity', async () => {
      const { user } = await createTestUser();
      
      await createTestReport(user._id, { severity: 'high' });
      await createTestReport(user._id, { severity: 'low' });

      const res = await request(app)
        .get('/api/reports')
        .query({ severity: 'high' });

      expect(res.status).toBe(200);
      res.body.data.forEach(report => {
        expect(report.severity).toBe('high');
      });
    });

    it('should support pagination', async () => {
      const { user } = await createTestUser();
      
      // Create 5 reports
      for (let i = 0; i < 5; i++) {
        await createTestReport(user._id);
      }

      const res = await request(app)
        .get('/api/reports')
        .query({ page: 1, limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
    });

    it('should not return rejected or duplicate reports by default', async () => {
      const { user } = await createTestUser();
      
      await createTestReport(user._id, { status: 'pending' });
      await createTestReport(user._id, { status: 'rejected' });

      const res = await request(app).get('/api/reports');

      expect(res.status).toBe(200);
      res.body.data.forEach(report => {
        expect(report.status).not.toBe('rejected');
        expect(report.status).not.toBe('duplicate');
      });
    });
  });

  // ==========================================
  // GET /api/reports/:id
  // ==========================================
  describe('GET /api/reports/:id', () => {
    
    it('should return a specific report', async () => {
      const { user } = await createTestUser();
      const report = await createTestReport(user._id);

      const res = await request(app).get(`/api/reports/${report._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(report._id.toString());
    });

    it('should return 404 for non-existent report', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const res = await request(app).get(`/api/reports/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for invalid ID format', async () => {
      const res = await request(app).get('/api/reports/invalid-id');

      expect(res.status).toBe(404);
    });

    it('should increment view count', async () => {
      const { user } = await createTestUser();
      const report = await createTestReport(user._id);
      const initialViewCount = report.viewCount || 0;

      await request(app).get(`/api/reports/${report._id}`);

      const updatedReport = await Report.findById(report._id);
      expect(updatedReport.viewCount).toBe(initialViewCount + 1);
    });

    it('should hide reporter info for anonymous reports', async () => {
      const { user } = await createTestUser();
      const report = await createTestReport(user._id, { isAnonymous: true });

      const res = await request(app).get(`/api/reports/${report._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reporter).toBeNull();
    });

    it('should not include sensitive data in public response', async () => {
      const { user } = await createTestUser();
      const report = await Report.create({
        title: 'Test Report',
        description: 'Test description',
        category: 'accident',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
        reporter: user._id,
        sensitiveData: 'encrypted-data-here',
      });

      const res = await request(app).get(`/api/reports/${report._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.sensitiveData).toBeUndefined();
    });
  });

  // ==========================================
  // POST /api/reports/:id/verify
  // ==========================================
  describe('POST /api/reports/:id/verify', () => {
    
    it('should allow user to confirm a report', async () => {
      const { user: reporter } = await createTestUser();
      const { token: voterToken } = await createTestUser();
      // Create report at known location
      const report = await createTestReport(reporter._id, {
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128], // Known coordinates
        },
      });

      const res = await request(app)
        .post(`/api/reports/${report._id}/verify`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send({ 
          vote: 'confirm',
          userLat: 40.7128,  // Same location as report
          userLng: -74.0060,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.confirms).toBe(1);
      expect(res.body.data.userVote).toBe('up');
    });

    it('should allow user to deny a report', async () => {
      const { user: reporter } = await createTestUser();
      const { token: voterToken } = await createTestUser();
      // Create report at known location
      const report = await createTestReport(reporter._id, {
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      });

      const res = await request(app)
        .post(`/api/reports/${report._id}/verify`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send({ 
          vote: 'deny',
          userLat: 40.7128,
          userLng: -74.0060,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.denies).toBe(1);
      expect(res.body.data.userVote).toBe('down');
    });

    it('should require authentication', async () => {
      const { user } = await createTestUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .post(`/api/reports/${report._id}/verify`)
        .send({ vote: 'confirm' });

      expect(res.status).toBe(401);
    });

    it('should reject invalid vote type', async () => {
      const { user: reporter } = await createTestUser();
      const { token: voterToken } = await createTestUser();
      const report = await createTestReport(reporter._id);

      const res = await request(app)
        .post(`/api/reports/${report._id}/verify`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send({ vote: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should reject votes from users too far from report', async () => {
      const { user: reporter } = await createTestUser();
      const { token: voterToken } = await createTestUser();
      const report = await createTestReport(reporter._id, {
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      });

      // Set voter location far away (different city)
      const res = await request(app)
        .post(`/api/reports/${report._id}/verify`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send({ 
          vote: 'confirm',
          userLat: 34.0522,  // LA coordinates - far from NYC
          userLng: -118.2437,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('within');
    });

    it('should auto-verify report at 3 upvotes', async () => {
      const { user: reporter } = await createTestUser();
      // Create report at known location
      const report = await createTestReport(reporter._id, {
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      });

      // Create 3 voters and vote
      for (let i = 0; i < 3; i++) {
        const { token: voterToken } = await createTestUser();
        await request(app)
          .post(`/api/reports/${report._id}/verify`)
          .set('Authorization', `Bearer ${voterToken}`)
          .send({ 
            vote: 'confirm',
            userLat: 40.7128,
            userLng: -74.0060,
          });
      }

      const updatedReport = await Report.findById(report._id);
      expect(updatedReport.verificationStatus).toBe('verified');
    });

    it('should toggle vote when same user votes again', async () => {
      const { user: reporter } = await createTestUser();
      const { token: voterToken } = await createTestUser();
      // Create report at known location
      const report = await createTestReport(reporter._id, {
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
        },
      });

      // First vote
      await request(app)
        .post(`/api/reports/${report._id}/verify`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send({ 
          vote: 'confirm',
          userLat: 40.7128,
          userLng: -74.0060,
        });

      // Same vote again - should remove
      const res = await request(app)
        .post(`/api/reports/${report._id}/verify`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send({ 
          vote: 'confirm',
          userLat: 40.7128,
          userLng: -74.0060,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.confirms).toBe(0);
    });
  });

  // ==========================================
  // PATCH /api/reports/:id/moderate
  // ==========================================
  describe('PATCH /api/reports/:id/moderate', () => {
    
    it('should allow admin to approve report', async () => {
      const { user } = await createTestUser();
      const { token: adminToken } = await createAdminUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .patch(`/api/reports/${report._id}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('verified');
    });

    it('should allow admin to reject report', async () => {
      const { user } = await createTestUser();
      const { token: adminToken } = await createAdminUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .patch(`/api/reports/${report._id}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'reject', reason: 'False report' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('rejected');
    });

    it('should allow admin to flag report', async () => {
      const { user } = await createTestUser();
      const { token: adminToken } = await createAdminUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .patch(`/api/reports/${report._id}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'flag' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
    });

    it('should deny regular user moderation access', async () => {
      const { user, token } = await createTestUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .patch(`/api/reports/${report._id}/moderate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(403);
    });

    it('should reject invalid action', async () => {
      const { user } = await createTestUser();
      const { token: adminToken } = await createAdminUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .patch(`/api/reports/${report._id}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'invalid_action' });

      expect(res.status).toBe(400);
    });

    it('should emit socket event on moderation', async () => {
      const { user } = await createTestUser();
      const { token: adminToken } = await createAdminUser();
      const report = await createTestReport(user._id);
      const io = app.get('io');

      await request(app)
        .patch(`/api/reports/${report._id}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' });

      expect(io.emitReportModerated).toHaveBeenCalled();
    });
  });

  // ==========================================
  // DELETE /api/reports/:id
  // ==========================================
  describe('DELETE /api/reports/:id', () => {
    
    it('should allow admin to delete report', async () => {
      const { user } = await createTestUser();
      const { token: adminToken } = await createAdminUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .delete(`/api/reports/${report._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify report is deleted
      const deletedReport = await Report.findById(report._id);
      expect(deletedReport).toBeNull();
    });

    it('should deny regular user from deleting reports', async () => {
      const { user, token } = await createTestUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .delete(`/api/reports/${report._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent report', async () => {
      const { token: adminToken } = await createAdminUser();
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .delete(`/api/reports/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const { user } = await createTestUser();
      const report = await createTestReport(user._id);

      const res = await request(app)
        .delete(`/api/reports/${report._id}`);

      expect(res.status).toBe(401);
    });
  });
});
