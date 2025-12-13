const { createUploadthing } = require('uploadthing/express');
const { UTApi } = require('uploadthing/server');
const { logger } = require('../utils/logger');

// Initialize UploadThing
const f = createUploadthing();

// Initialize UTApi for server-side operations
const utapi = new UTApi();

// Test UploadThing connection
const testUploadThingConnection = async () => {
  try {
    logger.connection('UploadThing', 'pending', 'Testing connection...');
    
    // Check if token is configured
    if (!process.env.UPLOADTHING_TOKEN) {
      logger.connection('UploadThing', 'warning', 'No token configured (uploads disabled)');
      return false;
    }
    
    // Try to list files as a connection test
    await utapi.listFiles({ limit: 1 });
    logger.connection('UploadThing', 'success', 'Connected');
    return true;
  } catch (error) {
    if (error.message?.includes('unauthorized') || error.message?.includes('Invalid')) {
      logger.connection('UploadThing', 'error', 'Invalid token');
    } else {
      logger.connection('UploadThing', 'error', `Connection failed: ${error.message || 'Unknown error'}`);
    }
    return false;
  }
};

// File router configuration
const uploadRouter = {
  // Image uploader for reports and alerts
  imageUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 5 } })
    .middleware(async ({ req }) => {
      // Get user from request if authenticated
      const userId = req.user?._id?.toString() || 'anonymous';
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      logger.info(`Image uploaded by ${metadata.userId}: ${file.name}`);
      return { 
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        type: 'image'
      };
    }),

  // Video uploader for reports and alerts
  videoUploader: f({ video: { maxFileSize: '16MB', maxFileCount: 3 } })
    .middleware(async ({ req }) => {
      const userId = req.user?._id?.toString() || 'anonymous';
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      logger.info(`Video uploaded by ${metadata.userId}: ${file.name}`);
      return { 
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        type: 'video'
      };
    }),

  // Mixed media uploader (images + videos)
  mediaUploader: f({
    image: { maxFileSize: '4MB', maxFileCount: 5 },
    video: { maxFileSize: '16MB', maxFileCount: 3 },
  })
    .middleware(async ({ req }) => {
      const userId = req.user?._id?.toString() || 'anonymous';
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const type = file.type?.startsWith('video/') ? 'video' : 'image';
      logger.info(`Media uploaded by ${metadata.userId}: ${file.name} (${type})`);
      return { 
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        type
      };
    }),
};

// Helper function to delete file from UploadThing
const deleteFromUploadThing = async (fileKey) => {
  try {
    if (!fileKey) return null;
    const result = await utapi.deleteFiles(fileKey);
    return result;
  } catch (error) {
    logger.error(`Error deleting from UploadThing: ${error.message}`);
    throw error;
  }
};

// Helper function to delete multiple files
const deleteMultipleFiles = async (fileKeys) => {
  try {
    if (!fileKeys || fileKeys.length === 0) return null;
    const result = await utapi.deleteFiles(fileKeys);
    return result;
  } catch (error) {
    logger.error(`Error deleting files from UploadThing: ${error.message}`);
    throw error;
  }
};

// Helper to get file URL (UploadThing URLs are already optimized)
const getFileUrl = (fileKey) => {
  if (!fileKey) return null;
  return `https://utfs.io/f/${fileKey}`;
};

module.exports = {
  uploadRouter,
  utapi,
  deleteFromUploadThing,
  deleteMultipleFiles,
  getFileUrl,
  testUploadThingConnection,
};
