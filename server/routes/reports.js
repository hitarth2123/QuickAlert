const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roleCheck');
const { reportCreationLimiter, searchLimiter } = require('../middleware/rateLimiter');
const { deleteFromUploadThing } = require('../config/uploadthing');
const { encrypt, decrypt } = require('../utils/encryption');
const { distanceBetweenCoords } = require('../utils/geoUtils');
const { logger } = require('../utils/logger');

/**
 * ============================================
 * REPORTS ROUTES (/api/reports)
 * ============================================
 */

/**
 * @route   POST /api/reports
 * @desc    Submit new incident report
 * @access  Optional (allow anonymous)
 */
router.post('/', optionalAuth, reportCreationLimiter, async (req, res) => {
  try {
    const {
      title,
      description,
      sensitiveData,
      category,
      subcategory,
      severity,
      location,
      isAnonymous,
      tags,
      media, // Array of { url, key, type } from UploadThing
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !location) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, category, and location',
      });
    }

    // Parse location if it's a string
    const parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;

    // Validate location has coordinates
    if (!parsedLocation.coordinates || parsedLocation.coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Location must include coordinates [longitude, latitude]',
      });
    }

    // Encrypt sensitive data if provided
    let encryptedSensitiveData = null;
    if (sensitiveData) {
      encryptedSensitiveData = encrypt(sensitiveData);
    }

    // Process media array (already uploaded via UploadThing)
    const parsedMedia = typeof media === 'string' ? JSON.parse(media) : media;
    const processedMedia = (parsedMedia || []).map((item) => ({
      url: item.url,
      publicId: item.key, // UploadThing file key
      type: item.type || 'image',
    }));

    // Parse tags if string
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;

    // Create report - reporter is optional for anonymous
    const reportData = {
      title,
      description,
      sensitiveData: encryptedSensitiveData,
      category,
      subcategory,
      severity: severity || 'medium',
      location: {
        type: 'Point',
        coordinates: parsedLocation.coordinates,
        address: parsedLocation.address,
        city: parsedLocation.city,
        state: parsedLocation.state,
        country: parsedLocation.country,
      },
      isAnonymous: isAnonymous === 'true' || isAnonymous === true || !req.user,
      media: processedMedia,
      tags: parsedTags || [],
    };

    // Add reporter if authenticated
    if (req.user) {
      reportData.reporter = req.user._id;
    }

    const report = await Report.create(reportData);

    // Emit socket event for real-time updates (geo-filtered to 10km)
    const io = req.app.get('io');
    if (io && io.emitNewReport) {
      io.emitNewReport(report);
    }

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: report,
    });
  } catch (error) {
    console.error('Create report error:', error);

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
});

/**
 * @route   GET /api/reports
 * @desc    Get reports within radius (?lat=X&lng=Y&radius=5km)
 * @access  Public
 */
router.get('/', searchLimiter, async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 5, // Default 5km
      page = 1,
      limit = 20,
      category,
      severity,
      status,
      reporter, // Filter by reporter ID (for "my reports")
    } = req.query;

    // Build query
    const query = {
      isExpired: { $ne: true },
      status: { $nin: ['rejected', 'duplicate'] },
    };

    // Reporter filter (for fetching user's own reports)
    if (reporter) {
      query.reporter = reporter;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Severity filter
    if (severity) {
      query.severity = severity;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Geospatial query - if lat and lng provided
    if (lat && lng) {
      const radiusInMeters = parseFloat(radius) * 1000; // Convert km to meters

      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radiusInMeters,
        },
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reporter', 'firstName lastName avatar')
        .select('-sensitiveData -votes.voters'),
      Report.countDocuments(query),
    ]);

    // Add distance to each report if coordinates provided
    let processedReports = reports.map((report) => {
      const reportObj = report.toObject();

      // Hide reporter info if anonymous
      if (reportObj.isAnonymous) {
        reportObj.reporter = null;
      }

      // Add distance if coordinates provided
      if (lat && lng && report.location?.coordinates) {
        reportObj.distance = distanceBetweenCoords(
          report.location.coordinates,
          [parseFloat(lng), parseFloat(lat)]
        ).toFixed(2);
      }

      return reportObj;
    });

    res.json({
      success: true,
      data: processedReports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + reports.length < total,
      },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   GET /api/reports/nearby
 * @desc    Get reports near a location
 * @access  Public
 */
router.get('/nearby', searchLimiter, async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 5000, // Default 5km in meters
      page = 1,
      limit = 50,
      category,
      severity,
      status,
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    // Get user ID from token if authenticated (optional)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (e) {
        // Token invalid, continue as anonymous
      }
    }

    // Build query
    const query = {
      isExpired: { $ne: true },
      status: { $nin: ['rejected', 'duplicate'] },
    };

    // Category filter
    if (category) {
      query.category = category;
    }

    // Severity filter
    if (severity) {
      query.severity = severity;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Geospatial query using $geoWithin (works with countDocuments)
    // Convert radius from meters to km, then to radians for $centerSphere
    const radiusKm = parseFloat(radius) / 1000;
    query['location.coordinates'] = {
      $geoWithin: {
        $centerSphere: [
          [parseFloat(lng), parseFloat(lat)],
          radiusKm / 6371, // Convert km to radians (Earth's radius = 6371 km)
        ],
      },
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // If user is authenticated, include votes.voters to check their vote
    const selectFields = userId 
      ? '-sensitiveData' 
      : '-sensitiveData -votes.voters';
    
    console.log(`[Nearby] User ID: ${userId}, Select fields: ${selectFields}`);

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reporter', 'firstName lastName avatar')
        .select(selectFields),
      Report.countDocuments(query),
    ]);

    // Add distance to each report and filter votes.voters to only current user
    const processedReports = reports.map((report) => {
      const reportObj = report.toObject();

      // Hide reporter info if anonymous
      if (reportObj.isAnonymous) {
        reportObj.reporter = null;
      }

      // Add distance
      if (report.location?.coordinates) {
        reportObj.distance = distanceBetweenCoords(
          report.location.coordinates,
          [parseFloat(lng), parseFloat(lat)]
        ).toFixed(2);
      }

      // If authenticated, filter voters to only include current user's vote
      if (userId && reportObj.votes?.voters) {
        console.log(`[Nearby] Report ${reportObj._id} has ${reportObj.votes.voters.length} total voters`);
        const userVote = reportObj.votes.voters.find(
          v => v.user.toString() === userId.toString()
        );
        console.log(`[Nearby] User vote found:`, userVote);
        reportObj.votes.voters = userVote ? [userVote] : [];
      }

      return reportObj;
    });

    res.json({
      success: true,
      data: processedReports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + reports.length < total,
      },
    });
  } catch (error) {
    console.error('Get nearby reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   GET /api/reports/:id
 * @desc    Get single report details
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    // Get user ID from token if authenticated (optional)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (e) {
        // Token invalid, continue as anonymous
      }
    }

    const report = await Report.findById(req.params.id)
      .populate('reporter', 'firstName lastName avatar')
      .populate('assignedTo', 'firstName lastName')
      .populate('verifiedBy', 'firstName lastName')
      .populate('updates.author', 'firstName lastName avatar');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    // Increment view count
    report.viewCount = (report.viewCount || 0) + 1;
    await report.save();

    // Prepare response
    const responseReport = report.toObject();

    // Hide reporter if anonymous
    if (report.isAnonymous) {
      responseReport.reporter = null;
    }

    // Remove sensitive data for public access
    delete responseReport.sensitiveData;

    // Filter voters to only include current user's vote (if authenticated)
    if (userId && responseReport.votes?.voters) {
      const userVote = responseReport.votes.voters.find(
        v => v.user.toString() === userId.toString()
      );
      responseReport.votes.voters = userVote ? [userVote] : [];
    } else {
      // Remove all voters for anonymous users
      if (responseReport.votes) {
        responseReport.votes.voters = [];
      }
    }

    res.json({
      success: true,
      data: responseReport,
    });
  } catch (error) {
    console.error('Get report error:', error);

    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   POST /api/reports/:id/verify
 * @desc    Submit verification vote (confirm/deny)
 * @access  Private (user role required)
 * @note    User must be within 2km of report location to verify
 */
router.post('/:id/verify', protect, async (req, res) => {
  try {
    const { vote, userLat, userLng } = req.body; // 'confirm' or 'deny' + user location

    if (!['confirm', 'deny'].includes(vote)) {
      return res.status(400).json({
        success: false,
        message: 'Vote must be "confirm" or "deny"',
      });
    }

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    // Check if user is within verification radius of report location
    const VERIFICATION_RADIUS_KM = 5; // Increased to 5km for better usability
    let userLocation = null;

    // Get user location from request body or user profile
    if (userLat && userLng) {
      userLocation = [parseFloat(userLng), parseFloat(userLat)];
    } else if (req.user.location?.coordinates) {
      userLocation = req.user.location.coordinates;
    }

    // Debug logging
    console.log('Verify request - User location:', userLocation);
    console.log('Verify request - Report location:', report.location?.coordinates);

    if (userLocation && report.location?.coordinates) {
      const distance = distanceBetweenCoords(report.location.coordinates, userLocation);
      console.log('Verify request - Calculated distance:', distance.toFixed(2), 'km');
      
      if (distance > VERIFICATION_RADIUS_KM) {
        return res.status(403).json({
          success: false,
          message: `You must be within ${VERIFICATION_RADIUS_KM}km of the report location to verify. Your distance: ${distance.toFixed(2)}km`,
        });
      }
    } else if (!userLocation) {
      // If no location available, allow verification but log it
      console.log('Verify request - No user location available, allowing verification');
    }

    // Check if user already voted
    const existingVoteIndex = report.votes.voters.findIndex(
      (v) => v.user.toString() === req.user._id.toString()
    );

    const voteType = vote === 'confirm' ? 'up' : 'down';

    if (existingVoteIndex !== -1) {
      const existingVote = report.votes.voters[existingVoteIndex];

      // Same vote - remove it
      if (existingVote.vote === voteType) {
        report.votes[voteType]--;
        report.votes.voters.splice(existingVoteIndex, 1);
      } else {
        // Different vote - change it
        report.votes[existingVote.vote]--;
        report.votes[voteType]++;
        report.votes.voters[existingVoteIndex].vote = voteType;
        report.votes.voters[existingVoteIndex].votedAt = new Date();
      }
    } else {
      // New vote
      report.votes[voteType]++;
      report.votes.voters.push({
        user: req.user._id,
        vote: voteType,
        votedAt: new Date(),
      });
    }

    // Auto-verify if threshold reached (≥3 confirms as per spec)
    const confirmThreshold = 3;
    if (report.votes.up >= confirmThreshold && report.verificationStatus === 'unverified') {
      report.verificationStatus = 'verified';
      report.status = 'verified';
      report.verifiedAt = new Date();

      // Create an alert from the verified report
      try {
        const categoryToType = {
          accident: 'traffic',
          fire: 'emergency',
          flood: 'weather',
          crime: 'crime',
          medical: 'health',
          infrastructure: 'infrastructure',
          other: 'community',
        };

        const categoryToSeverity = {
          accident: 'warning',
          fire: 'critical',
          flood: 'warning',
          crime: 'warning',
          medical: 'advisory',
          infrastructure: 'advisory',
          other: 'info',
        };

        const alert = new Alert({
          title: `⚠️ ${report.title || `${report.category} Incident`}`,
          description: `${report.description || 'Community reported incident'}\n\n📢 **Verified by Community Voting**\nThis alert was automatically generated when ${report.votes.up} community members confirmed this incident report.`,
          shortDescription: `Community verified: ${report.category} incident reported nearby`,
          type: categoryToType[report.category] || 'community',
          severity: categoryToSeverity[report.category] || 'advisory',
          source: {
            type: 'report',
            reportId: report._id,
            officialSource: 'Community Voting System',
          },
          createdBy: report.reporter || req.user._id,
          targetArea: {
            type: 'Circle',
            coordinates: report.location?.coordinates || [0, 0],
            radius: 5, // 5km radius for community alerts
            address: report.locationDescription,
          },
          effectiveFrom: new Date(),
          effectiveUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          isActive: true,
          status: 'active',
          channels: {
            push: true,
            inApp: true,
            email: false,
            sms: false,
          },
          instructions: [
            { text: 'Stay alert and aware of your surroundings', priority: 1 },
            { text: 'Avoid the area if possible', priority: 2 },
            { text: 'Report any additional information', priority: 3 },
          ],
          metadata: {
            isAutomated: true,
            source: 'community_verification',
            reportId: report._id.toString(),
            verificationCount: report.votes.up,
            communityVerified: true,
          },
        });

        await alert.save();
        report.alertId = alert._id; // Link the alert to the report
        
        logger.info(`Alert created from verified report: ${alert._id}`);

        // Emit the new alert via socket
        const io = req.app.get('io');
        if (io && io.emitOfficialAlert) {
          io.emitOfficialAlert(alert);
        }
      } catch (alertError) {
        console.error('Error creating alert from verified report:', alertError);
        // Don't fail the vote if alert creation fails
      }

      // Emit reportVerified event (geo-filtered)
      const io = req.app.get('io');
      if (io && io.emitReportVerified) {
        io.emitReportVerified(report);
      }
    }

    // Auto-flag as false if too many denies (≥3)
    const denyThreshold = 3;
    if (report.votes.down >= denyThreshold && report.verificationStatus === 'unverified') {
      report.verificationStatus = 'false_report';
    }

    await report.save();

    res.json({
      success: true,
      message: `Vote ${vote}ed successfully`,
      data: {
        confirms: report.votes.up,
        denies: report.votes.down,
        verificationStatus: report.verificationStatus,
        userVote: voteType,
      },
    });
  } catch (error) {
    console.error('Verify report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   PATCH /api/reports/:id/moderate
 * @desc    Moderate report (approve/reject/flag)
 * @access  Private (admin role required)
 */
router.patch(
  '/:id/moderate',
  protect,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  async (req, res) => {
    try {
      const { action, reason } = req.body; // action: 'approve', 'reject', 'flag'

      if (!['approve', 'reject', 'flag'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be "approve", "reject", or "flag"',
        });
      }

      const report = await Report.findById(req.params.id);

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found',
        });
      }

      // Update based on action
      switch (action) {
        case 'approve':
          report.status = 'verified';
          report.verificationStatus = 'verified';
          report.verifiedBy = req.user._id;
          report.verifiedAt = new Date();
          break;
        case 'reject':
          report.status = 'rejected';
          report.verificationStatus = 'false_report';
          report.verifiedBy = req.user._id;
          report.verifiedAt = new Date();
          break;
        case 'flag':
          report.status = 'pending';
          report.verificationStatus = 'pending_verification';
          break;
      }

      if (reason) {
        report.verificationNotes = reason;
      }

      await report.save();

      // Emit socket event (geo-filtered)
      const io = req.app.get('io');
      if (io && io.emitReportModerated) {
        io.emitReportModerated(report, action, req.user._id);
      }

      res.json({
        success: true,
        message: `Report ${action}ed successfully`,
        data: {
          id: report._id,
          status: report.status,
          verificationStatus: report.verificationStatus,
          moderatedBy: req.user._id,
          moderatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Moderate report error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
);

/**
 * @route   DELETE /api/reports/:id
 * @desc    Delete report
 * @access  Private (admin role required)
 */
router.delete(
  '/:id',
  protect,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  async (req, res) => {
    try {
      const report = await Report.findById(req.params.id);

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found',
        });
      }

      // Delete associated media from UploadThing
      const fileKeys = report.media
        .filter(m => m.publicId)
        .map(m => m.publicId);
      
      if (fileKeys.length > 0) {
        try {
          await deleteFromUploadThing(fileKeys);
        } catch (err) {
          logger.error(`Error deleting media: ${err.message}`);
        }
      }

      await report.deleteOne();

      // Emit socket event
      const io = req.app.get('io');
      if (io) {
        io.emit('reportDeleted', { id: req.params.id });
      }

      res.json({
        success: true,
        message: 'Report deleted successfully',
      });
    } catch (error) {
      console.error('Delete report error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
);

module.exports = router;
