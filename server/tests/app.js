/**
 * Express App Factory for Testing
 * Creates a fresh Express app instance for testing
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import routes
const authRoutes = require('../routes/auth');
const reportRoutes = require('../routes/reports');
const alertRoutes = require('../routes/alerts');
const analyticsRoutes = require('../routes/analytics');

/**
 * Create Express app for testing
 */
const createApp = () => {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mock Socket.IO
  const mockIo = {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emitNewReport: jest.fn(),
    emitReportVerified: jest.fn(),
    emitOfficialAlert: jest.fn(),
    emitReportModerated: jest.fn(),
    emitUserCountUpdate: jest.fn(),
  };
  app.set('io', mockIo);

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/analytics', analyticsRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Test Error:', err.message);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Server error',
    });
  });

  return app;
};

module.exports = createApp;
