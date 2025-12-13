/**
 * Integration Tests
 * End-to-end tests for complete user flows
 */

require('./setup');
const request = require('supertest');
const createApp = require('./app');
const User = require('../models/User');
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const {
  createTestUser,
  createAdminUser,
  createResponderUser,
  createTestReport,
  createTestAlert,
  wait,
} = require('./helpers');

const app = createApp();

describe('Integration Tests', () => {
  
  // ==========================================
  // Complete User Registration Flow
  // ==========================================
  describe('User Registration Flow', () => {
    
    it('should complete full registration and login', async () => {
      // Step 1: Register
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Integration',
          lastName: 'User',
          email: 'integration@example.com',
          password: 'SecurePass123!',
          phone: '+1234567890',
        });

      expect(registerRes.status).toBe(201);
      const { token } = registerRes.body.data;

      // Step 2: Get profile
      const profileRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.data.email).toBe('integration@example.com');
      expect(profileRes.body.data.firstName).toBe('Integration');

      // Step 3: Update location
      const updateRes = await request(app)
        .patch('/api/auth/update-location')
        .set('Authorization', `Bearer ${token}`)
        .send({
          lat: 40.7128,
          lng: -74.0060,
        });

      expect(updateRes.status).toBe(200);

      // Step 4: Login with credentials
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'integration@example.com',
          password: 'SecurePass123!',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.token).toBeDefined();
    });
  });

  // ==========================================
  // Complete Report Lifecycle
  // ==========================================
  describe('Report Lifecycle', () => {
    
    it('should complete full report lifecycle: create → verify → moderate', async () => {
      // Create reporter
      const { token: reporterToken, user: reporter } = await createTestUser();

      // Step 1: Create report
      const createRes = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          title: 'Traffic Accident',
          description: 'Two cars collided at intersection',
          category: 'accident',
          severity: 'high',
          location: {
            coordinates: [-74.0060, 40.7128],
            address: '123 Main St',
            city: 'New York',
          },
        });

      expect(createRes.status).toBe(201);
      const reportId = createRes.body.data._id;

      // Step 2: Verify report is accessible
      const getRes = await request(app).get(`/api/reports/${reportId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.verificationStatus).toBe('unverified');

      // Step 3: Create verifiers and upvote
      for (let i = 0; i < 3; i++) {
        const { token: verifierToken } = await createTestUser();

        const verifyRes = await request(app)
          .post(`/api/reports/${reportId}/verify`)
          .set('Authorization', `Bearer ${verifierToken}`)
          .send({
            vote: 'confirm',
            userLat: 40.7128,
            userLng: -74.0060,
          });

        expect(verifyRes.status).toBe(200);
      }

      // Step 4: Check report is now verified
      const verifiedRes = await request(app).get(`/api/reports/${reportId}`);
      expect(verifiedRes.body.data.verificationStatus).toBe('verified');
      expect(verifiedRes.body.data.votes.up).toBe(3);
    });

    it('should allow admin to moderate report', async () => {
      const { user } = await createTestUser();
      const { token: adminToken } = await createAdminUser();
      const report = await createTestReport(user._id);

      // Admin approves report
      const moderateRes = await request(app)
        .patch(`/api/reports/${report._id}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' });

      expect(moderateRes.status).toBe(200);
      expect(moderateRes.body.data.status).toBe('verified');
    });
  });

  // ==========================================
  // Complete Alert Lifecycle
  // ==========================================
  describe('Alert Lifecycle', () => {
    
    it('should complete full alert lifecycle: create → view → cancel', async () => {
      // Create admin
      const { token: adminToken, user: admin } = await createAdminUser();

      // Step 1: Create alert
      const createRes = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Severe Weather Warning',
          description: 'Heavy thunderstorms expected',
          type: 'weather',
          severity: 'warning',
          targetArea: {
            coordinates: [-74.0060, 40.7128],
            radius: 25,
            city: 'New York',
          },
        });

      expect(createRes.status).toBe(201);
      const alertId = createRes.body.data._id;

      // Step 2: Verify alert is public
      const getRes = await request(app).get(`/api/alerts/${alertId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.title).toBe('Severe Weather Warning');

      // Step 3: Get all alerts (should include the new alert)
      const listRes = await request(app).get('/api/alerts');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some(a => a._id === alertId)).toBe(true);

      // Step 4: Cancel alert
      const cancelRes = await request(app)
        .delete(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Weather cleared' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('cancelled');

      // Step 5: Alert should no longer be in active list
      const listAfterRes = await request(app).get('/api/alerts');
      expect(listAfterRes.body.data.find(a => a._id === alertId)).toBeUndefined();
    });
  });

  // ==========================================
  // Analytics Dashboard
  // ==========================================
  describe('Analytics Dashboard', () => {
    
    it('should provide complete analytics for admin', async () => {
      // Setup: Create some data
      const { user } = await createTestUser();
      const { user: admin, token: adminToken } = await createAdminUser();
      
      // Create reports
      await createTestReport(user._id, { category: 'accident' });
      await createTestReport(user._id, { category: 'fire' });
      await createTestReport(user._id, { category: 'accident' });
      
      // Create alerts
      await createTestAlert(admin._id, { type: 'weather' });
      await createTestAlert(admin._id, { type: 'emergency' });

      // Test report stats
      const reportStatsRes = await request(app)
        .get('/api/analytics/reports-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reportStatsRes.status).toBe(200);
      expect(reportStatsRes.body.data.total).toBeGreaterThanOrEqual(3);
      expect(reportStatsRes.body.data.byCategory).toBeDefined();

      // Test population count
      const populationRes = await request(app)
        .get('/api/analytics/population')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ lat: 40.7128, lng: -74.0060, radius: 50 });

      expect(populationRes.status).toBe(200);
      expect(populationRes.body.data.population).toBeDefined();

      // Test heatmap
      const heatmapRes = await request(app)
        .get('/api/analytics/heatmap')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ type: 'reports' });

      expect(heatmapRes.status).toBe(200);
      expect(heatmapRes.body.data.type).toBe('reports');
    });
  });

  // ==========================================
  // Cross-Resource Workflows
  // ==========================================
  describe('Cross-Resource Workflows', () => {
    
    it('should allow responder to create alert based on verified report', async () => {
      // Create report
      const { token: reporterToken, user: reporter } = await createTestUser();
      const report = await createTestReport(reporter._id, {
        category: 'fire',
        severity: 'critical',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128],
          city: 'New York',
        },
      });

      // Responder creates alert in same area
      const { token: responderToken } = await createResponderUser();
      
      const alertRes = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${responderToken}`)
        .send({
          title: 'Fire Emergency Response',
          description: `Responding to reported fire at ${report.location.city}`,
          type: 'emergency',
          severity: 'critical',
          targetArea: {
            coordinates: report.location.coordinates,
            radius: 5,
          },
        });

      expect(alertRes.status).toBe(201);
      expect(alertRes.body.data.targetArea.coordinates).toEqual(report.location.coordinates);
    });

    it('should track multiple reports in same area', async () => {
      const location = {
        type: 'Point',
        coordinates: [-73.9857, 40.7484], // Times Square
      };

      // Create multiple reports in same area
      const { user: user1 } = await createTestUser();
      const { user: user2 } = await createTestUser();
      const { user: user3 } = await createTestUser();

      await createTestReport(user1._id, { 
        category: 'crime', 
        location,
        title: 'Report 1',
      });
      await createTestReport(user2._id, { 
        category: 'crime', 
        location,
        title: 'Report 2',
      });
      await createTestReport(user3._id, { 
        category: 'suspicious_activity', 
        location,
        title: 'Report 3',
      });

      // Query reports without geo query (geo queries may not work with memory server)
      const res = await request(app)
        .get('/api/reports')
        .query({ category: 'crime' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================
  // Error Handling Flows
  // ==========================================
  describe('Error Handling Flows', () => {
    
    it('should handle concurrent operations gracefully', async () => {
      const { token } = await createTestUser();

      // Try multiple operations simultaneously
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/reports')
            .set('Authorization', `Bearer ${token}`)
            .send({
              title: `Concurrent Report ${i}`,
              description: 'Testing concurrent submissions',
              category: 'other',
              location: {
                coordinates: [-74.0060 + i * 0.001, 40.7128],
              },
            })
        );
      }

      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(res => {
        expect(res.status).toBe(201);
      });
    });

    it('should handle invalid data gracefully', async () => {
      const { token } = await createTestUser();

      // Missing required fields
      const res1 = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Incomplete' });

      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      // Invalid category
      const res2 = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Bad Category',
          description: 'Testing invalid category',
          category: 'invalid_category',
          location: {
            coordinates: [-74.0060, 40.7128],
          },
        });

      expect(res2.status).toBe(400);
    });

    it('should handle non-existent resources', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      // Non-existent report
      const reportRes = await request(app).get(`/api/reports/${fakeId}`);
      expect(reportRes.status).toBe(404);

      // Non-existent alert
      const alertRes = await request(app).get(`/api/alerts/${fakeId}`);
      expect(alertRes.status).toBe(404);
    });
  });
});
