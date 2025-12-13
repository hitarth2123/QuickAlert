import {
  generateReactHelpers,
} from "@uploadthing/react";

// Generate the React helpers for your upload router
export const { useUploadThing, uploadFiles } = generateReactHelpers({
  url: `${import.meta.env.VITE_API_URL || ''}/api/upload`,
});

// File type configurations
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const ACCEPTED_MEDIA_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

// Max file sizes
export const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
export const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16MB

// Validate file before upload
export const validateFile = (file) => {
  const errors = [];
  
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    if (file.size > MAX_IMAGE_SIZE) {
      errors.push(`Image ${file.name} exceeds 4MB limit`);
    }
  } else if (ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    if (file.size > MAX_VIDEO_SIZE) {
      errors.push(`Video ${file.name} exceeds 16MB limit`);
    }
  } else {
    errors.push(`File type ${file.type} is not supported`);
  }
  
  return errors;
};

// Validate multiple files
export const validateFiles = (files) => {
  const errors = [];
  
  files.forEach(file => {
    const fileErrors = validateFile(file);
    errors.push(...fileErrors);
  });
  
  // Check total count
  const imageCount = files.filter(f => ACCEPTED_IMAGE_TYPES.includes(f.type)).length;
  const videoCount = files.filter(f => ACCEPTED_VIDEO_TYPES.includes(f.type)).length;
  
  if (imageCount > 5) {
    errors.push('Maximum 5 images allowed');
  }
  if (videoCount > 3) {
    errors.push('Maximum 3 videos allowed');
  }
  
  return errors;
};

// Format file size for display
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get file type from mime type
export const getFileType = (mimeType) => {
  if (ACCEPTED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (ACCEPTED_VIDEO_TYPES.includes(mimeType)) return 'video';
  return 'unknown';
};
