const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roleCheck');
const { searchLimiter } = require('../middleware/rateLimiter');
const { isPointInPolygon } = require('../utils/geoUtils');

/**
 * ============================================
 * ANALYTICS ROUTES (/api/analytics)
 * ============================================
 */

/**
 * @route   GET /api/analytics/population
 * @desc    Count users in polygon (?polygon=[[coords]])
 * @access  Private (alert/admin role required)
 */
router.get(
  '/population',
  protect,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.RESPONDER),
  searchLimiter,
  async (req, res) => {
    try {
      const { polygon, lat, lng, radius } = req.query;

      let userCount = 0;
      let query = { isActive: true };

      if (polygon) {
        // Parse polygon coordinates
        const polygonCoords = typeof polygon === 'string' ? JSON.parse(polygon) : polygon;

        // Validate polygon
        if (!Array.isArray(polygonCoords) || polygonCoords.length < 3) {
          return res.status(400).json({
            success: false,
            message: 'Polygon must have at least 3 coordinate pairs',
          });
        }

        // Use MongoDB $geoWithin with polygon
        query['location.coordinates'] = {
          $geoWithin: {
            $polygon: polygonCoords,
          },
        };

        userCount = await User.countDocuments(query);

      } else if (lat && lng && radius) {
        // Circle-based query
        const radiusKm = parseFloat(radius);

        query['location.coordinates'] = {
          $geoWithin: {
            $centerSphere: [
              [parseFloat(lng), parseFloat(lat)],
              radiusKm / 6371, // Convert km to radians
            ],
          },
        };

        userCount = await User.countDocuments(query);

      } else {
        return res.status(400).json({
          success: false,
          message: 'Please provide either polygon coordinates or lat, lng, and radius',
        });
      }

      res.json({
        success: true,
        data: {
          population: userCount,
          query: polygon ? 'polygon' : 'radius',
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Population count error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
);

/**
 * @route   GET /api/analytics/reports-stats
 * @desc    Get report statistics (total, verified, etc.)
 * @access  Private (admin role required)
 */
router.get(
  '/reports-stats',
  protect,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  async (req, res) => {
    try {
      const { startDate, endDate, category } = req.query;

      // Build date filter
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate);
      }

      const matchQuery = {};
      if (Object.keys(dateFilter).length > 0) {
        matchQuery.createdAt = dateFilter;
      }
      if (category) {
        matchQuery.category = category;
      }

      // Get comprehensive statistics
      const [
        totalReports,
        reportsByStatus,
        reportsByCategory,
        reportsBySeverity,
        verificationStats,
        reportsOverTime,
        avgResolutionTime,
      ] = await Promise.all([
        // Total reports
        Report.countDocuments(matchQuery),

        // Reports by status
        Report.aggregate([
          { $match: matchQuery },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        // Reports by category
        Report.aggregate([
          { $match: matchQuery },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),

        // Reports by severity
        Report.aggregate([
          { $match: matchQuery },
          { $group: { _id: '$severity', count: { $sum: 1 } } },
        ]),

        // Verification statistics
        Report.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: '$verificationStatus',
              count: { $sum: 1 },
            },
          },
        ]),

        // Reports over time (last 30 days)
        Report.aggregate([
          {
            $match: {
              createdAt: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Average resolution time
        Report.aggregate([
          {
            $match: {
              ...matchQuery,
              status: 'resolved',
              resolvedAt: { $exists: true },
            },
          },
          {
            $project: {
              resolutionTimeHours: {
                $divide: [
                  { $subtract: ['$resolvedAt', '$createdAt'] },
                  1000 * 60 * 60,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgResolutionTimeHours: { $avg: '$resolutionTimeHours' },
              minResolutionTimeHours: { $min: '$resolutionTimeHours' },
              maxResolutionTimeHours: { $max: '$resolutionTimeHours' },
            },
          },
        ]),
      ]);

      // Format status stats
      const statusStats = {};
      reportsByStatus.forEach((item) => {
        statusStats[item._id || 'unknown'] = item.count;
      });

      // Format category stats
      const categoryStats = {};
      reportsByCategory.forEach((item) => {
        categoryStats[item._id || 'unknown'] = item.count;
      });

      // Format severity stats
      const severityStats = {};
      reportsBySeverity.forEach((item) => {
        severityStats[item._id || 'unknown'] = item.count;
      });

      // Format verification stats
      const verifiedCount = verificationStats.find((v) => v._id === 'verified')?.count || 0;
      const unverifiedCount = verificationStats.find((v) => v._id === 'unverified')?.count || 0;
      const falseReportCount = verificationStats.find((v) => v._id === 'false_report')?.count || 0;

      res.json({
        success: true,
        data: {
          total: totalReports,
          verified: verifiedCount,
          unverified: unverifiedCount,
          falseReports: falseReportCount,
          byStatus: statusStats,
          byCategory: categoryStats,
          bySeverity: severityStats,
          overTime: reportsOverTime,
          resolution: avgResolutionTime[0] || {
            avgResolutionTimeHours: 0,
            minResolutionTimeHours: 0,
            maxResolutionTimeHours: 0,
          },
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Reports stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
);

/**
 * @route   GET /api/analytics/heatmap
 * @desc    Get user density data for heatmap
 * @access  Private (alert/admin role required)
 */
router.get(
  '/heatmap',
  protect,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.RESPONDER),
  searchLimiter,
  async (req, res) => {
    try {
      const {
        lat,
        lng,
        radius = 50, // Default 50km
        gridSize = 0.01, // Grid cell size in degrees (~1.1km)
        type = 'users', // 'users' or 'reports'
      } = req.query;

      let heatmapData = [];

      if (type === 'users') {
        // Build base query
        const matchStage = {
          isActive: true,
          'location.coordinates': { $exists: true },
        };

        // Add geospatial filter if coordinates provided
        if (lat && lng) {
          matchStage['location.coordinates'] = {
            $geoWithin: {
              $centerSphere: [
                [parseFloat(lng), parseFloat(lat)],
                parseFloat(radius) / 6371,
              ],
            },
          };
        }

        // Aggregate users by grid cell
        heatmapData = await User.aggregate([
          { $match: matchStage },
          {
            $project: {
              gridLat: {
                $multiply: [
                  { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, parseFloat(gridSize)] } },
                  parseFloat(gridSize),
                ],
              },
              gridLng: {
                $multiply: [
                  { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, parseFloat(gridSize)] } },
                  parseFloat(gridSize),
                ],
              },
            },
          },
          {
            $group: {
              _id: { lat: '$gridLat', lng: '$gridLng' },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              lat: '$_id.lat',
              lng: '$_id.lng',
              intensity: '$count',
            },
          },
          { $sort: { intensity: -1 } },
          { $limit: 1000 }, // Limit for performance
        ]);

      } else if (type === 'reports') {
        // Build base query for reports
        const matchStage = {
          'location.coordinates': { $exists: true },
          status: { $nin: ['rejected', 'duplicate'] },
        };

        // Add geospatial filter if coordinates provided
        if (lat && lng) {
          matchStage['location.coordinates'] = {
            $geoWithin: {
              $centerSphere: [
                [parseFloat(lng), parseFloat(lat)],
                parseFloat(radius) / 6371,
              ],
            },
          };
        }

        // Aggregate reports by grid cell with severity weighting
        heatmapData = await Report.aggregate([
          { $match: matchStage },
          {
            $project: {
              gridLat: {
                $multiply: [
                  { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, parseFloat(gridSize)] } },
                  parseFloat(gridSize),
                ],
              },
              gridLng: {
                $multiply: [
                  { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, parseFloat(gridSize)] } },
                  parseFloat(gridSize),
                ],
              },
              severityWeight: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$severity', 'critical'] }, then: 4 },
                    { case: { $eq: ['$severity', 'high'] }, then: 3 },
                    { case: { $eq: ['$severity', 'medium'] }, then: 2 },
                  ],
                  default: 1,
                },
              },
            },
          },
          {
            $group: {
              _id: { lat: '$gridLat', lng: '$gridLng' },
              count: { $sum: 1 },
              weightedIntensity: { $sum: '$severityWeight' },
            },
          },
          {
            $project: {
              _id: 0,
              lat: '$_id.lat',
              lng: '$_id.lng',
              count: 1,
              intensity: '$weightedIntensity',
            },
          },
          { $sort: { intensity: -1 } },
          { $limit: 1000 },
        ]);
      }

      // Calculate bounds if data exists
      let bounds = null;
      if (heatmapData.length > 0) {
        bounds = {
          minLat: Math.min(...heatmapData.map((d) => d.lat)),
          maxLat: Math.max(...heatmapData.map((d) => d.lat)),
          minLng: Math.min(...heatmapData.map((d) => d.lng)),
          maxLng: Math.max(...heatmapData.map((d) => d.lng)),
        };
      }

      res.json({
        success: true,
        data: {
          type,
          gridSize: parseFloat(gridSize),
          points: heatmapData,
          totalPoints: heatmapData.length,
          bounds,
          maxIntensity: heatmapData.length > 0 ? Math.max(...heatmapData.map((d) => d.intensity)) : 0,
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Heatmap error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
);

module.exports = router;
