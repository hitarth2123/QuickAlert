# UploadThing Migration Guide

## Overview

QuickAlert has migrated from **Cloudinary** to **UploadThing** for file uploads. This document covers the changes made and how to use the new upload system.

---

## 🔧 Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# UploadThing Configuration
UPLOADTHING_TOKEN=your_uploadthing_token_here
```

Get your token from [UploadThing Dashboard](https://uploadthing.com/dashboard).

### Removed Configuration

The following Cloudinary variables are no longer needed:

```env
# CLOUDINARY_CLOUD_NAME (removed)
# CLOUDINARY_API_KEY (removed)
# CLOUDINARY_API_SECRET (removed)
```

---

## 📁 Server-Side Changes

### New Files

| File | Description |
|------|-------------|
| `config/uploadthing.js` | UploadThing configuration and file router |
| `routes/upload.js` | Upload API endpoints |

### Modified Files

| File | Changes |
|------|---------|
| `server.js` | Replaced Cloudinary with UploadThing imports |
| `routes/reports.js` | Updated to accept media array from client |
| `routes/alerts.js` | Updated to accept media array from client |

### File Upload Limits

| Type | Max Size | Max Count |
|------|----------|-----------|
| Images | 4MB | 5 files |
| Videos | 16MB | 3 files |

### API Endpoints

#### Upload Files
```
POST /api/upload
```
Handled automatically by UploadThing. Use client-side SDK.

#### Delete File
```
DELETE /api/upload/:fileKey
Authorization: Bearer <token>
```

#### List Files (Admin Only)
```
GET /api/upload/list?limit=50&offset=0
Authorization: Bearer <token>
```

---

## 💻 Client-Side Changes

### New Files

| File | Description |
|------|-------------|
| `services/uploadthing.js` | UploadThing React helpers and validators |
| `components/Shared/FileUpload.jsx` | Reusable file upload component |

### Installation

```bash
cd client
npm install @uploadthing/react
```

### Using the FileUpload Component

```jsx
import FileUpload from '../components/Shared/FileUpload';

function MyForm() {
  const [uploadedMedia, setUploadedMedia] = useState([]);

  const handleMediaUpload = (files) => {
    setUploadedMedia(prev => [...prev, ...files]);
  };

  const handleMediaError = (error) => {
    console.error('Upload failed:', error.message);
  };

  return (
    <FileUpload
      onUploadComplete={handleMediaUpload}
      onUploadError={handleMediaError}
      maxFiles={5}
      disabled={uploadedMedia.length >= 5}
    />
  );
}
```

### FileUpload Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onUploadComplete` | `function` | - | Called with array of uploaded files |
| `onUploadError` | `function` | - | Called when upload fails |
| `maxFiles` | `number` | 5 | Maximum files allowed |
| `acceptedTypes` | `array` | All media | Accepted MIME types |
| `disabled` | `boolean` | false | Disable the uploader |
| `className` | `string` | '' | Additional CSS classes |

### Uploaded File Object

```javascript
{
  url: "https://utfs.io/f/abc123...",  // Public URL
  key: "abc123...",                     // File key for deletion
  name: "photo.jpg",                    // Original filename
  size: 1024000,                        // Size in bytes
  type: "image"                         // "image" or "video"
}
```

---

## 📝 Submitting Forms with Media

### Report Form Example

```javascript
const handleSubmit = async () => {
  const reportData = {
    title: "Accident Report",
    description: "Details...",
    category: "accident",
    location: {
      type: "Point",
      coordinates: [-122.4194, 37.7749]
    },
    // Media uploaded via UploadThing
    media: uploadedMedia.map(m => ({
      url: m.url,
      key: m.key,
      type: m.type
    }))
  };

  await reportsApi.create(reportData);
};
```

### Alert Form Example

```javascript
const alertData = {
  title: "Emergency Alert",
  description: "Details...",
  type: "fire",
  severity: "critical",
  targetArea: {
    coordinates: [-122.4194, 37.7749],
    radius: 10 // km
  },
  media: uploadedMedia.map(m => ({
    url: m.url,
    key: m.key,
    type: m.type
  }))
};

await alertsApi.create(alertData);
```

---

## 🗑️ Deleting Files

### Server-Side

```javascript
const { deleteFromUploadThing } = require('../config/uploadthing');

// Delete single file
await deleteFromUploadThing('file_key_here');

// Delete multiple files
await deleteFromUploadThing(['key1', 'key2', 'key3']);
```

### Client-Side API Call

```javascript
await api.delete(`/api/upload/${fileKey}`);
```

---

## 🔄 Data Model Changes

### Media Object in Reports/Alerts

**Before (Cloudinary):**
```javascript
{
  url: "https://res.cloudinary.com/...",
  publicId: "quickalert/images/abc123",
  type: "image"
}
```

**After (UploadThing):**
```javascript
{
  url: "https://utfs.io/f/abc123...",
  publicId: "abc123...",  // Now stores UploadThing file key
  type: "image"
}
```

---

## ✅ Server Startup Logs

When the server starts successfully, you'll see:

```
[11:33:27 PM] ✓ Socket.IO: Initialized
[11:33:27 PM] ◌ MongoDB: Connecting...
[11:33:27 PM] ◌ UploadThing: Testing connection...

╔════════════════════════════════════════════════════════════╗
║   🚨 QuickAlert API Server                                 ║
╠════════════════════════════════════════════════════════════╣
║   Port:        3000                                        ║
║   Environment: development                                 ║
╚════════════════════════════════════════════════════════════╝

[11:33:27 PM] ✓ Server ready to accept connections
[11:33:27 PM] ✓ MongoDB: Connected to localhost/alertnet_db
[11:33:28 PM] ✓ UploadThing: Connected
```

---

## 🚨 Troubleshooting

### "UploadThing: No token configured"
- Check that `UPLOADTHING_TOKEN` is set in your `.env` file
- Restart the server after adding the token

### "Upload failed: Unauthorized"
- Verify your UploadThing token is valid
- Check the token hasn't expired

### "File too large"
- Images must be under 4MB
- Videos must be under 16MB

### "Invalid file type"
- Supported images: JPEG, PNG, GIF, WebP
- Supported videos: MP4, MOV, WebM

---

## 📦 Package Changes

### Server Dependencies

**Added:**
```json
"uploadthing": "^7.7.4"
```

**Can be removed (optional):**
```json
"cloudinary": "^2.8.0",
"multer": "^1.4.5-lts.1",
"multer-storage-cloudinary": "^2.2.1"
```

### Client Dependencies

**Added:**
```json
"@uploadthing/react": "^7.x"
```

---

## 🔗 Resources

- [UploadThing Documentation](https://docs.uploadthing.com/)
- [UploadThing Dashboard](https://uploadthing.com/dashboard)
- [React Integration Guide](https://docs.uploadthing.com/getting-started/appdir)
