const express = require('express');
const router = express.Router();
const { createRouteHandler } = require('uploadthing/express');
const { uploadRouter, utapi, deleteFromUploadThing } = require('../config/uploadthing');
const { protect, optionalAuth } = require('../middleware/auth');
const { logger } = require('../utils/logger');

/**
 * ============================================
 * UPLOAD ROUTES (/api/upload)
 * ============================================
 */

// UploadThing route handler
const uploadthingHandler = createRouteHandler({
  router: uploadRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
  },
});

// Mount UploadThing routes
router.use('/', uploadthingHandler);

/**
 * @route   DELETE /api/upload/:fileKey
 * @desc    Delete a file from UploadThing
 * @access  Private
 */
router.delete('/:fileKey', protect, async (req, res) => {
  try {
    const { fileKey } = req.params;

    if (!fileKey) {
      return res.status(400).json({
        success: false,
        message: 'File key is required',
      });
    }

    await deleteFromUploadThing(fileKey);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    logger.error(`Delete file error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
    });
  }
});

/**
 * @route   GET /api/upload/list
 * @desc    List uploaded files (admin only)
 * @access  Private (Admin)
 */
router.get('/list', protect, async (req, res) => {
  try {
    // Only allow admins to list all files
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to list files',
      });
    }

    const { limit = 50, offset = 0 } = req.query;

    const files = await utapi.listFiles({
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    logger.error(`List files error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error listing files',
    });
  }
});

module.exports = router;
