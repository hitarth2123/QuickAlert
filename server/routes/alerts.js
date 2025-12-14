const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roleCheck');
const { alertBroadcastLimiter, searchLimiter } = require('../middleware/rateLimiter');
const { deleteFromUploadThing } = require('../config/uploadthing');
const { distanceBetweenCoords } = require('../utils/geoUtils');
const { logger } = require('../utils/logger');

/**
 * ============================================
 * ALERTS ROUTES (/api/alerts)
 * ============================================
 */

/**
 * Broadcast alert to users in target area using Socket.IO geo-filtered emit
 */
async function broadcastAlert(alert, io) {
  if (!io || !io.emitOfficialAlert) return;

  try {
    // Use the geo-filtered emit function from socketHandler
    io.emitOfficialAlert(alert);

    // Find users in the target area for delivery stats
    let usersQuery = {
      isActive: true,
      'alertPreferences.pushEnabled': true,
    };

    // Add geospatial filter if coordinates are provided
    if (alert.targetArea?.coordinates && alert.targetArea.coordinates.length === 2) {
      const radiusKm = alert.targetArea.radius || 10;
      usersQuery['location.coordinates'] = {
        $geoWithin: {
          $centerSphere: [alert.targetArea.coordinates, radiusKm / 6371],
        },
      };
    }

    const users = await User.find(usersQuery).select('_id');

    // Update delivery stats
    alert.delivery.totalTargeted = users.length;
    alert.delivery.sent = users.length;
    await alert.save();
  } catch (error) {
    console.error('Broadcast alert error:', error);
  }
}

/**
 * @route   POST /api/alerts
 * @desc    Create official alert with geo-fence
 * @access  Private (alert role required)
 */
router.post(
  '/',
  protect,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.RESPONDER),
  alertBroadcastLimiter,
  async (req, res) => {
    try {
      const {
        title,
        description,
        type,
        severity,
        targetArea, // { coordinates: [lng, lat], radius: 10 } or polygon
        effectiveFrom,
        effectiveUntil,
        instructions,
        media, // Array of { url, key, type } from UploadThing
      } = req.body;

      // Validate required fields
      if (!title || !description || !type || !targetArea) {
        return res.status(400).json({
          success: false,
          message: 'Please provide title, description, type, and targetArea',
        });
      }

      // Parse JSON fields
      const parsedTargetArea = typeof targetArea === 'string' ? JSON.parse(targetArea) : targetArea;
      const parsedInstructions = typeof instructions === 'string' ? JSON.parse(instructions) : instructions;

      // Validate targetArea has coordinates
      if (!parsedTargetArea.coordinates || parsedTargetArea.coordinates.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Target area must include coordinates [longitude, latitude]',
        });
      }

      // Process media array (already uploaded via UploadThing)
      const parsedMedia = typeof media === 'string' ? JSON.parse(media) : media;
      const processedMedia = (parsedMedia || []).map((item) => ({
        url: item.url,
        publicId: item.key, // UploadThing file key
        type: item.type || 'image',
      }));

      const alert = await Alert.create({
        title,
        description,
        type,
        severity: severity || 'advisory',
        source: {
          type: 'official',
          officialSource: req.user.role,
        },
        createdBy: req.user._id,
        targetArea: {
          type: 'Circle',
          coordinates: parsedTargetArea.coordinates,
          radius: parsedTargetArea.radius || 10, // Default 10km
          city: parsedTargetArea.city,
          state: parsedTargetArea.state,
          country: parsedTargetArea.country,
        },
        effectiveFrom: effectiveFrom || new Date(),
        effectiveUntil,
        instructions: parsedInstructions || [],
        media: processedMedia,
        status: 'active',
        isActive: true,
      });

      // Broadcast alert to users in the area
      await broadcastAlert(alert, req.app.get('io'));

      res.status(201).json({
        success: true,
        message: 'Alert created and broadcasted successfully',
        data: alert,
      });
    } catch (error) {
      console.error('Create alert error:', error);

      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          message: messages.join(', '),
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
);

/**
 * @route   GET /api/alerts
 * @desc    Get active alerts (?lat=X&lng=Y)
 * @access  Public
 */
router.get('/', searchLimiter, async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 50, // Default 50km
      page = 1,
      limit = 20,
      type,
      severity,
      includeAll, // Admin flag to include all alerts (inactive, expired, etc.)
    } = req.query;

    // Build query
    const query = {};
    
    // Only apply active filters if not requesting all alerts (for admin panel)
    if (includeAll !== 'true') {
      query.isActive = true;
      query.status = 'active';
      query.$or = [
        { effectiveUntil: { $exists: false } },
        { effectiveUntil: { $gt: new Date() } },
      ];
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Severity filter
    if (severity) {
      query.severity = severity;
    }

    // Geospatial query - if lat and lng provided
    if (lat && lng) {
      query['targetArea.coordinates'] = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            parseFloat(radius) / 6371, // Convert km to radians
          ],
        },
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [alerts, total] = await Promise.all([
      Alert.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'firstName lastName')
        .select('-interactions.acknowledgedBy -interactions.safeCheckIns'),
      Alert.countDocuments(query),
    ]);

    // Add distance if coordinates provided
    let processedAlerts = alerts.map((alert) => {
      const alertObj = alert.toObject();

      if (lat && lng && alert.targetArea?.coordinates) {
        alertObj.distance = distanceBetweenCoords(
          alert.targetArea.coordinates,
          [parseFloat(lng), parseFloat(lat)]
        ).toFixed(2);
      }

      return alertObj;
    });

    res.json({
      success: true,
      data: processedAlerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + alerts.length < total,
      },
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   GET /api/alerts/nearby
 * @desc    Get alerts near a location
 * @access  Public
 */
router.get('/nearby', searchLimiter, async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 10, // Default 10km
      page = 1,
      limit = 50,
      type,
      severity,
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    // Build query for active alerts - exclude resolved and cancelled
    const query = {
      isActive: true,
      status: { $in: ['active'] }, // Only show active alerts, not resolved or cancelled
      $or: [
        { effectiveUntil: { $exists: false } },
        { effectiveUntil: { $gt: new Date() } },
      ],
    };

    // Type filter
    if (type) {
      query.type = type;
    }

    // Severity filter
    if (severity) {
      query.severity = severity;
    }

    // Geospatial query - radius in meters, convert to km for centerSphere
    const radiusKm = parseFloat(radius) / 1000; // Convert meters to km
    query['targetArea.coordinates'] = {
      $geoWithin: {
        $centerSphere: [
          [parseFloat(lng), parseFloat(lat)],
          radiusKm / 6371, // Convert km to radians
        ],
      },
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [alerts, total] = await Promise.all([
      Alert.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'firstName lastName')
        .select('-interactions.acknowledgedBy -interactions.safeCheckIns'),
      Alert.countDocuments(query),
    ]);

    // Add distance to each alert
    const processedAlerts = alerts.map((alert) => {
      const alertObj = alert.toObject();

      if (alert.targetArea?.coordinates) {
        alertObj.distance = distanceBetweenCoords(
          alert.targetArea.coordinates,
          [parseFloat(lng), parseFloat(lat)]
        ).toFixed(2);
      }

      return alertObj;
    });

    res.json({
      success: true,
      data: processedAlerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + alerts.length < total,
      },
    });
  } catch (error) {
    console.error('Get nearby alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   GET /api/alerts/:id
 * @desc    Get single alert details
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('parentAlert', 'title')
      .populate('childAlerts', 'title status');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    // Increment view count
    alert.interactions.views = (alert.interactions.views || 0) + 1;
    await alert.save();

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error('Get alert error:', error);

    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   PUT /api/alerts/:id
 * @desc    Update alert (status, resolve, expire, etc.)
 * @access  Private (admin/responder role required)
 */
router.put(
  '/:id',
  protect,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.RESPONDER),
  async (req, res) => {
    try {
      const { status, isActive, title, description, severity, effectiveUntil } = req.body;

      const alert = await Alert.findById(req.params.id);

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found',
        });
      }

      // Update allowed fields
      if (status) {
        alert.status = status;
        
        // If resolving/expiring/cancelling, set isActive to false
        if (['resolved', 'expired', 'cancelled'].includes(status)) {
          alert.isActive = false;
          alert.resolvedAt = new Date();
          alert.resolvedBy = req.user._id;
        }
        
        // If reactivating, set isActive to true
        if (status === 'active') {
          alert.isActive = true;
          alert.resolvedAt = undefined;
          alert.resolvedBy = undefined;
        }
      }
      
      if (isActive !== undefined) {
        alert.isActive = isActive;
      }
      
      if (title) alert.title = title;
      if (description) alert.description = description;
      if (severity) alert.severity = severity;
      if (effectiveUntil) alert.effectiveUntil = new Date(effectiveUntil);

      await alert.save();

      // If alert resolved/cancelled, also update related report if exists
      if (['resolved', 'expired', 'cancelled'].includes(status) && alert.source?.reportId) {
        try {
          const Report = require('../models/Report');
          await Report.findByIdAndUpdate(alert.source.reportId, {
            status: status === 'cancelled' ? 'rejected' : 'resolved',
          });
          
          // Also emit reportModerated event so maps update
          if (io) {
            io.emitReportModerated && io.emitReportModerated(
              { _id: alert.source.reportId, status: status === 'cancelled' ? 'rejected' : 'resolved' },
              status === 'cancelled' ? 'reject' : 'resolve',
              req.user._id
            );
          }
        } catch (err) {
          console.log('Could not update related report:', err.message);
        }
      }

      // Emit socket events
      const io = req.app.get('io');
      if (io) {
        io.emit('alertUpdated', alert);
        
        // Emit specific events for resolved/cancelled alerts so maps can remove them
        if (status === 'resolved') {
          io.emit('alertResolved', { alertId: alert._id, alert });
          console.log(`[Socket] alertResolved emitted for alert: ${alert._id}`);
        } else if (status === 'cancelled') {
          io.emit('alertCancelled', { alertId: alert._id, reason: 'Alert cancelled by admin', alert });
          console.log(`[Socket] alertCancelled emitted for alert: ${alert._id}`);
        }
      }

      console.log(`[Admin] Alert ${alert._id} updated to status: ${status} by ${req.user._id}`);

      res.json({
        success: true,
        message: `Alert ${status || 'updated'} successfully`,
        data: alert,
      });
    } catch (error) {
      console.error('Update alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
);

/**
 * @route   DELETE /api/alerts/:id
 * @desc    Delete/expire alert
 * @access  Private (alert/admin role required)
 */
router.delete(
  '/:id',
  protect,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.RESPONDER),
  async (req, res) => {
    try {
      const { reason } = req.body;

      const alert = await Alert.findById(req.params.id);

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found',
        });
      }

      // Check if user is creator or admin
      const isCreator = alert.createdBy.toString() === req.user._id.toString();
      const isAdmin = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role);

      if (!isCreator && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this alert',
        });
      }

      // Soft delete - mark as cancelled/expired
      alert.status = 'cancelled';
      alert.isActive = false;
      alert.cancelledAt = new Date();
      alert.cancelledBy = req.user._id;
      alert.cancellationReason = reason || 'Deleted by administrator';

      await alert.save();

      // Broadcast cancellation
      const io = req.app.get('io');
      if (io) {
        io.emit('alertCancelled', {
          id: alert._id,
          title: alert.title,
          reason: alert.cancellationReason,
        });
      }

      res.json({
        success: true,
        message: 'Alert deleted/expired successfully',
        data: {
          id: alert._id,
          status: alert.status,
          cancelledAt: alert.cancelledAt,
        },
      });
    } catch (error) {
      console.error('Delete alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
);

module.exports = router;
