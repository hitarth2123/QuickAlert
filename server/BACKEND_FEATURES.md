# QuickAlert Backend - Critical Features Implementation

This document details the implementation of all critical backend features for the QuickAlert emergency alert system.

---

## 1. AES-256 Encryption Module

### Location
`utils/encryption.js`

### Features
- **Algorithm:** AES-256-GCM (Galois/Counter Mode)
- **IV Storage:** 16-byte IV stored with ciphertext
- **Auth Tag:** 16-byte authentication tag for integrity
- **Key Derivation:** PBKDF2 with 100,000 iterations if key needs derivation

### Environment Variables
```env
ENCRYPTION_KEY=your-64-character-hex-key  # 32 bytes = 64 hex chars
```

### Usage
```javascript
const { encrypt, decrypt } = require('./utils/encryption');

// Encrypt sensitive data (e.g., GPS coordinates)
const encrypted = encrypt('37.7749,-122.4194');
// Returns: Base64 string containing IV + AuthTag + Ciphertext

// Decrypt data
const decrypted = decrypt(encrypted);
// Returns: '37.7749,-122.4194'
```

### Functions Available
| Function | Description |
|----------|-------------|
| `encrypt(plaintext)` | Encrypts data using AES-256-GCM |
| `decrypt(ciphertext)` | Decrypts AES-256-GCM encrypted data |
| `hash(data)` | SHA-256 hash |
| `hashPassword(password)` | Secure password hashing with salt |
| `generateSecureToken(bytes)` | Generate cryptographically secure tokens |

---

## 2. JWT Authentication

### Location
`middleware/auth.js`

### Configuration
| Setting | Value |
|---------|-------|
| Algorithm | HS256 |
| Token Expiration | 7 days |
| Refresh Token Expiration | 30 days |

### Environment Variables
```env
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters
```

### Token Payload
```javascript
{
  id: "user_id",      // MongoDB ObjectId
  role: "user",       // user | responder | admin | super_admin
  email: "user@email.com",
  iat: 1702468800,    // Issued at timestamp
  exp: 1703073600     // Expiration timestamp (7 days)
}
```

### Middleware Functions
```javascript
const { protect, optionalAuth, generateToken } = require('./middleware/auth');

// Protected route - requires valid JWT
router.get('/profile', protect, (req, res) => {
  // req.user contains authenticated user
});

// Optional auth - attaches user if token present, continues if not
router.get('/public', optionalAuth, (req, res) => {
  // req.user may be null or authenticated user
});

// Generate token with full payload
const token = generateToken(user); // Pass full user object
```

---

## 3. Role-Based Authorization

### Location
`middleware/roleCheck.js`

### Role Hierarchy
```
user < responder < admin < super_admin
```

### Roles Enum
```javascript
const ROLES = {
  USER: 'user',
  RESPONDER: 'responder',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};
```

### Middleware Functions

#### `authorize(...roles)` - Check specific roles
```javascript
// Only admin and super_admin can access
router.patch('/moderate', protect, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), handler);
```

#### `authorizeMinRole(role)` - Check minimum role level
```javascript
// Responder and above can access
router.post('/alerts', protect, authorizeMinRole(ROLES.RESPONDER), handler);
```

#### `authorizeOwnerOrAdmin(getOwnerId)` - Owner or admin access
```javascript
// User can edit own resource, or admin can edit any
router.put('/report/:id', protect, authorizeOwnerOrAdmin(
  (req) => Report.findById(req.params.id).then(r => r.reporter)
), handler);
```

### Route Restrictions
| Route | Required Role |
|-------|---------------|
| `POST /api/alerts` | responder, admin, super_admin |
| `PATCH /api/reports/:id/moderate` | admin, super_admin |
| `DELETE /api/reports/:id` | admin, super_admin |
| `GET /api/analytics/*` | responder, admin, super_admin |

---

## 4. Geospatial Queries

### MongoDB Setup
Ensure 2dsphere index on location fields:
```javascript
// In models/Report.js and models/User.js
locationSchema.index({ coordinates: '2dsphere' });
```

### Find Reports Within Radius
```javascript
// GET /api/reports?lat=37.7749&lng=-122.4194&radius=5

const query = {
  'location.coordinates': {
    $near: {
      $geometry: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)], // [longitude, latitude]
      },
      $maxDistance: radiusInMeters, // 5km = 5000 meters
    },
  },
};

const reports = await Report.find(query);
```

### Find Users in Polygon (for alerts)
```javascript
// GET /api/analytics/population?polygon=[[lng1,lat1],[lng2,lat2],...]

const query = {
  'location.coordinates': {
    $geoWithin: {
      $polygon: polygonCoords,
    },
  },
};
```

### Find Users in Radius (for alert broadcasting)
```javascript
const query = {
  'location.coordinates': {
    $geoWithin: {
      $centerSphere: [
        [lng, lat],
        radiusKm / 6371, // Convert km to radians
      ],
    },
  },
};
```

---

## 5. Verification Logic

### Location
`routes/reports.js` - `POST /api/reports/:id/verify`

### Rules
1. **Proximity Check:** User must be within **2km** of report location
2. **Duplicate Prevention:** Same user cannot vote twice (can change vote)
3. **Auto-Verify:** Report status changes to `verified` when confirms ≥ **3**
4. **Auto-Flag:** Report marked as `false_report` when denies ≥ **3**

### Implementation
```javascript
// Check proximity (2km radius)
const VERIFICATION_RADIUS_KM = 2;
const distance = distanceBetweenCoords(report.location.coordinates, userLocation);

if (distance > VERIFICATION_RADIUS_KM) {
  return res.status(403).json({
    message: `You must be within ${VERIFICATION_RADIUS_KM}km to verify`,
  });
}

// Check for duplicate votes
const existingVote = report.votes.voters.find(
  v => v.user.toString() === req.user._id.toString()
);

// Auto-verify threshold
if (report.votes.up >= 3 && report.verificationStatus === 'unverified') {
  report.verificationStatus = 'verified';
  report.status = 'verified';
}
```

### Request Example
```javascript
POST /api/reports/:id/verify
{
  "vote": "confirm",     // or "deny"
  "userLat": 37.7749,    // Optional: user's current latitude
  "userLng": -122.4194   // Optional: user's current longitude
}
```

---

## 6. Rate Limiting

### Location
`middleware/rateLimiter.js`

### Configuration
| Limiter | Window | Max Requests | Applied To |
|---------|--------|--------------|------------|
| `generalLimiter` | 1 minute | 100 | All routes (except /health) |
| `authLimiter` | 1 hour | 10 | Login, Register |
| `passwordResetLimiter` | 1 hour | 3 | Password reset |
| `reportCreationLimiter` | 1 hour | 20 | Create reports |
| `uploadLimiter` | 1 hour | 50 | File uploads |
| `searchLimiter` | 1 minute | 30 | Search/query routes |
| `alertBroadcastLimiter` | 1 hour | 10 | Create alerts |

### Usage
```javascript
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');

// Apply to all routes
app.use(generalLimiter);

// Apply to specific routes
router.post('/login', authLimiter, loginHandler);
```

### Response on Limit Exceeded
```json
{
  "success": false,
  "message": "Too many requests, please try again later."
}
```
**HTTP Status:** 429 Too Many Requests

---

## 7. CORS Configuration

### Location
`server.js`

### Configuration
```javascript
const corsOptions = {
  origin: process.env.CLIENT_URL || '*',  // http://localhost:3000 for dev
  credentials: true,                       // Enable cookies/JWT
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
```

### Environment Variable
```env
CLIENT_URL=http://localhost:3000
```

### Security Headers (Helmet)
```javascript
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
```

---

## 8. File Upload (Photos/Videos)

### Location
`config/cloudinary.js`

### Configuration
| Setting | Value |
|---------|-------|
| Storage | Cloudinary |
| Max File Size | **5MB** |
| Max Files | 5 per request |
| Allowed Types | jpg, jpeg, png, gif, mp4, mov, webm |
| Image Transformation | Auto-resize to max 1920x1080 |

### Environment Variables
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Usage
```javascript
const { upload, deleteFromCloudinary } = require('./config/cloudinary');

// Single file upload
router.post('/upload', upload.single('photo'), handler);

// Multiple files (max 5)
router.post('/report', upload.array('media', 5), handler);

// Delete file
await deleteFromCloudinary(publicId, 'image'); // or 'video'
```

### File Storage Structure
```
quickalert/
├── images/      # Uploaded images
└── videos/      # Uploaded videos
```

### Response Format
```javascript
// req.files after upload
[
  {
    path: 'https://res.cloudinary.com/xxx/image/upload/v123/quickalert/images/abc.jpg',
    filename: 'quickalert/images/abc',  // publicId for deletion
  }
]
```

### Stored in Database
```javascript
// Report.media array
{
  url: 'https://res.cloudinary.com/...',
  publicId: 'quickalert/images/abc',
  type: 'image'  // or 'video'
}
```

---

## Environment Variables Summary

Create a `.env` file in the server directory:

```env
# Server
NODE_ENV=development
PORT=5000

# Frontend URL (CORS)
CLIENT_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/quickalert

# JWT (generate secure random strings)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters

# Encryption (32 bytes = 64 hex characters)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-character-hex-encryption-key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## Quick Reference

### Protected Route Example
```javascript
const { protect } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roleCheck');
const { searchLimiter } = require('../middleware/rateLimiter');

router.get(
  '/admin-data',
  protect,                              // 1. Verify JWT
  authorize(ROLES.ADMIN),               // 2. Check role
  searchLimiter,                        // 3. Rate limit
  async (req, res) => {
    // req.user available here
  }
);
```

### Complete Request Flow
```
Request → CORS → Helmet → Rate Limit → Auth → Role Check → Handler → Response
```
