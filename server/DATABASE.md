# MongoDB Setup & Schema Design

## Database Architecture

| Property | Value |
|----------|-------|
| **Database Name** | `alertnet_db` |
| **MongoDB Version** | 6.0+ recommended |
| **Storage Engine** | WiredTiger |

---

## Collections Overview

| Collection | Purpose | Indexes |
|------------|---------|---------|
| `users` | User credentials, roles, encrypted location | email (unique), location (2dsphere) |
| `reports` | Incident reports with geospatial data | location (2dsphere), reportedAt (TTL) |
| `alerts` | Official emergency alerts with geo-fencing | geoFence (2dsphere), expiresAt (TTL) |
| `verifications` | Track verification votes per report | reportId, userId (compound unique) |
| `sessions` | Active user sessions for population tracking | location (2dsphere), expiresAt (TTL) |

---

## Schema Structures

### 1. Users Collection

```javascript
{
  _id: ObjectId,
  email: String,                    // Optional for registered users, unique index
  passwordHash: String,             // bcrypt hashed
  role: String,                     // enum: 'user', 'admin', 'alert'
  lastKnownLocation: {
    type: "Point",
    coordinates: [lng, lat]         // ENCRYPTED before storage
  },
  isActive: Boolean,
  createdAt: Date,
  lastSeen: Date
}
```

**Mongoose Model:** `models/User.js`

**Key Fields:**
- `email` - Unique, optional for anonymous users
- `role` - Controls API access permissions
- `lastKnownLocation` - GeoJSON Point, coordinates encrypted with AES-256
- `isActive` - Soft delete flag

---

### 2. Reports Collection

```javascript
{
  _id: ObjectId,
  location: {
    type: "Point",
    coordinates: [lng, lat]         // ENCRYPTED, with 2dsphere index
  },
  incidentType: String,             // enum: 'Flooding', 'Fire', 'Earthquake', etc.
  description: String,
  photoUrl: String,                 // Cloudinary URL
  status: String,                   // enum: 'unverified', 'verified', 'dismissed', 'archived'
  verificationCount: Number,
  verifiedBy: [ObjectId],           // Array of user IDs who verified
  reportedBy: ObjectId,             // Nullable for anonymous reports
  reportedAt: Date,
  expiresAt: Date,                  // Auto-archive after 48 hours (TTL index)
  moderatedBy: ObjectId,
  moderationAction: String
}
```

**Mongoose Model:** `models/Report.js`

**Key Fields:**
- `location` - GeoJSON Point with 2dsphere index for proximity queries
- `incidentType` - Categorizes the emergency type
- `status` - Workflow state
- `verificationCount` - Auto-incremented when users verify
- `expiresAt` - TTL indexed, reports auto-archive after 48 hours

---

### 3. Alerts Collection

```javascript
{
  _id: ObjectId,
  message: String,
  severity: String,                 // enum: 'Info', 'Warning', 'Critical'
  geoFence: {
    type: "Polygon",
    coordinates: [[[lng, lat], [lng, lat], ...]]  // Closed polygon
  },
  createdBy: ObjectId,
  createdAt: Date,
  expiresAt: Date,
  affectedUserCount: Number         // Calculated at broadcast time
}
```

**Mongoose Model:** `models/Alert.js`

**Key Fields:**
- `severity` - Determines notification priority
- `geoFence` - GeoJSON Polygon for targeted alerts
- `affectedUserCount` - Populated when alert is broadcasted

---

### 4. Verifications Collection

```javascript
{
  _id: ObjectId,
  reportId: ObjectId,               // Reference to report
  userId: ObjectId,                 // User who verified
  vote: String,                     // enum: 'confirm', 'deny'
  userLocation: {
    type: "Point",
    coordinates: [lng, lat]         // User's location when voting
  },
  verifiedAt: Date
}
```

**Mongoose Model:** `models/Verification.js`

**Key Fields:**
- `reportId` + `userId` - Compound unique index (one vote per user per report)
- `vote` - 'confirm' increases verification count, 'deny' flags for review
- `userLocation` - Must be within 2km of report to verify

---

### 5. Sessions Collection (Optional - Population Tracking)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  token: String,                    // Session token
  location: {
    type: "Point",
    coordinates: [lng, lat]         // Current location
  },
  socketId: String,                 // Socket.IO connection ID
  isActive: Boolean,
  lastPing: Date,
  expiresAt: Date                   // TTL - auto-cleanup after 24h
}
```

**Mongoose Model:** `models/Session.js`

**Purpose:**
- Real-time population density tracking
- Alert targeting based on user locations
- Calculate `affectedUserCount` for alerts

---

## MongoDB Indexes

### Required Indexes

```javascript
// Users Collection
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ "lastKnownLocation.coordinates": "2dsphere" });
db.users.createIndex({ role: 1 });
db.users.createIndex({ isActive: 1 });

// Reports Collection
db.reports.createIndex({ "location.coordinates": "2dsphere" });
db.reports.createIndex({ reportedAt: 1 }, { expireAfterSeconds: 172800 }); // 48-hour TTL
db.reports.createIndex({ status: 1 });
db.reports.createIndex({ incidentType: 1 });
db.reports.createIndex({ reportedBy: 1 });

// Alerts Collection
db.alerts.createIndex({ "geoFence.coordinates": "2dsphere" });
db.alerts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL at expiresAt
db.alerts.createIndex({ severity: 1 });
db.alerts.createIndex({ createdBy: 1 });
db.alerts.createIndex({ createdAt: -1 });

// Verifications Collection
db.verifications.createIndex({ reportId: 1, userId: 1 }, { unique: true });
db.verifications.createIndex({ reportId: 1 });
db.verifications.createIndex({ userId: 1 });
db.verifications.createIndex({ vote: 1 });

// Sessions Collection
db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ token: 1 }, { unique: true });
db.sessions.createIndex({ "location.coordinates": "2dsphere" });
db.sessions.createIndex({ socketId: 1 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
db.sessions.createIndex({ isActive: 1, lastPing: 1 });
```

### Mongoose Index Definitions

Indexes are automatically created from the Mongoose schema definitions:

```javascript
// In models/Report.js
reportSchema.index({ 'location.coordinates': '2dsphere' });
reportSchema.index({ reportedAt: 1 }, { expireAfterSeconds: 172800 });

// In models/User.js
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ 'lastKnownLocation.coordinates': '2dsphere' });
```

---

## MongoDB Atlas Setup Steps

### Step 1: Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for free account
3. Create a new project named `QuickAlert`

### Step 2: Create Free M0 Cluster

1. Click **"Build a Database"**
2. Select **M0 (Free Tier)**
3. Choose cloud provider (AWS/GCP/Azure)
4. Select region closest to your users
5. Name cluster: `quickalert-cluster`
6. Click **"Create"**

### Step 3: Configure Network Access

1. Go to **Network Access** in sidebar
2. Click **"Add IP Address"**
3. For development: Add `0.0.0.0/0` (allows all IPs)
4. For production: Add your server's static IP only

### Step 4: Create Database User

1. Go to **Database Access** in sidebar
2. Click **"Add New Database User"**
3. Authentication: Password
4. Username: `quickalert_admin`
5. Password: Generate secure password
6. Database User Privileges: **Read and write to any database**
7. Click **"Add User"**

### Step 5: Get Connection String

1. Go to **Database** → **Connect**
2. Select **"Connect your application"**
3. Driver: Node.js, Version: 5.5 or later
4. Copy connection string:
   ```
   mongodb+srv://quickalert_admin:<password>@quickalert-cluster.xxxxx.mongodb.net/alertnet_db?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your database user password

### Step 6: Update Environment Variables

```env
MONGODB_URI=mongodb+srv://quickalert_admin:YOUR_PASSWORD@quickalert-cluster.xxxxx.mongodb.net/alertnet_db?retryWrites=true&w=majority
```

### Step 7: Create Collections & Indexes

**Option A: Via MongoDB Compass**
1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Connect using connection string
3. Create database `alertnet_db`
4. Create collections: `users`, `reports`, `alerts`, `verifications`, `sessions`
5. Add indexes via Compass Index tab

**Option B: Via Atlas UI**
1. Go to **Collections** tab in Atlas
2. Click **"Create Database"**
3. Database: `alertnet_db`
4. Collection: `users`
5. Create remaining collections
6. Use **Indexes** tab to create indexes

**Option C: Automatic via Mongoose (Recommended)**
The indexes are defined in Mongoose schemas and will be created automatically when the application starts.

---

## Geospatial Query Examples

### Find Reports Within 5km Radius

```javascript
const reports = await Report.find({
  'location.coordinates': {
    $near: {
      $geometry: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749], // [lng, lat]
      },
      $maxDistance: 5000, // 5km in meters
    },
  },
});
```

### Find Users in Polygon (for Alert Targeting)

```javascript
const usersInArea = await User.find({
  'lastKnownLocation.coordinates': {
    $geoWithin: {
      $geometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.5, 37.8],
          [-122.3, 37.8],
          [-122.3, 37.7],
          [-122.5, 37.7],
          [-122.5, 37.8], // Close the polygon
        ]],
      },
    },
  },
});
```

### Count Users in Circle (Population Density)

```javascript
const count = await Session.countDocuments({
  isActive: true,
  'location.coordinates': {
    $geoWithin: {
      $centerSphere: [
        [-122.4194, 37.7749], // [lng, lat]
        10 / 6371, // 10km radius (converted to radians)
      ],
    },
  },
});
```

---

## TTL Index Configuration

### Reports - Auto-Archive After 48 Hours

```javascript
// In Mongoose schema
reportSchema.index(
  { reportedAt: 1 },
  { expireAfterSeconds: 172800 } // 48 hours = 172800 seconds
);
```

### Sessions - Auto-Delete Expired

```javascript
// In Mongoose schema
sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 } // Delete when expiresAt is reached
);
```

### Alerts - Auto-Expire

```javascript
// In Mongoose schema
alertSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);
```

---

## Encryption for Location Data

Before storing coordinates, encrypt using AES-256:

```javascript
const { encrypt, decrypt } = require('../utils/encryption');

// Before saving
const encryptedCoords = encrypt(JSON.stringify(coordinates));

// After retrieval
const decryptedCoords = JSON.parse(decrypt(encryptedCoords));
```

> **Note:** For geospatial queries to work, you need to decrypt coordinates first or use a different approach where you store both encrypted (for security) and hashed/rounded coordinates (for indexing).

---

## Data Retention Policy

| Collection | Retention | Method |
|------------|-----------|--------|
| Reports | 48 hours | TTL Index on `reportedAt` |
| Alerts | Until `expiresAt` | TTL Index |
| Sessions | 24 hours inactive | TTL Index on `expiresAt` |
| Verifications | Permanent | Manual cleanup |
| Users | Permanent | Soft delete via `isActive` |

---

## Backup Strategy

### MongoDB Atlas Automated Backups
- M0 (Free): No automated backups
- M10+: Daily snapshots, point-in-time recovery

### Manual Backup (Free Tier)
```bash
# Using mongodump
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/alertnet_db" --out=./backup

# Restore
mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/alertnet_db" ./backup/alertnet_db
```

---

## Connection Configuration

### Mongoose Connection Options

```javascript
// config/db.js
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4
};

mongoose.connect(process.env.MONGODB_URI, options);
```

### Connection Events

```javascript
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});
```
