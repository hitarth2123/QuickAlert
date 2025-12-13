const mongoose = require('mongoose');

/**
 * Session Schema - Track active user sessions for population tracking
 * Used for real-time population density calculations and alert targeting
 */
const sessionSchema = new mongoose.Schema(
  {
    // User reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Session token
    token: {
      type: String,
      required: true,
      unique: true,
    },
    // Current location (for population tracking)
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude] - ENCRYPTED before storage
        required: true,
      },
    },
    // Device information
    device: {
      type: {
        type: String,
        enum: ['mobile', 'web', 'desktop'],
        default: 'mobile',
      },
      platform: {
        type: String,
        enum: ['ios', 'android', 'web', 'windows', 'macos', 'linux'],
      },
      deviceId: String,
      userAgent: String,
      appVersion: String,
    },
    // Connection info
    socketId: String,
    ipAddress: String,
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    // Timestamps
    lastPing: {
      type: Date,
      default: Date.now,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    disconnectedAt: Date,
    // Session expiry (auto-cleanup inactive sessions)
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
sessionSchema.index({ userId: 1 });
// Note: token index not needed here - created automatically by unique: true in schema
sessionSchema.index({ 'location.coordinates': '2dsphere' }); // Geospatial for population queries
sessionSchema.index({ socketId: 1 });
sessionSchema.index({ isActive: 1 });
sessionSchema.index({ lastPing: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index - auto-delete expired

// Static: Create new session
sessionSchema.statics.createSession = async function (userId, locationCoords, deviceInfo, socketId, ipAddress) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');

  const session = await this.create({
    userId,
    token,
    location: {
      type: 'Point',
      coordinates: locationCoords,
    },
    device: deviceInfo,
    socketId,
    ipAddress,
  });

  return session;
};

// Static: Update session location
sessionSchema.statics.updateLocation = async function (sessionId, coordinates) {
  return this.findByIdAndUpdate(
    sessionId,
    {
      $set: {
        'location.coordinates': coordinates,
        lastPing: new Date(),
      },
    },
    { new: true }
  );
};

// Static: Get active sessions in area (for population count)
sessionSchema.statics.getSessionsInArea = async function (coordinates, radiusKm) {
  return this.find({
    isActive: true,
    'location.coordinates': {
      $geoWithin: {
        $centerSphere: [coordinates, radiusKm / 6371],
      },
    },
  }).select('userId location');
};

// Static: Get active sessions in polygon
sessionSchema.statics.getSessionsInPolygon = async function (polygon) {
  return this.find({
    isActive: true,
    'location.coordinates': {
      $geoWithin: {
        $polygon: polygon,
      },
    },
  }).select('userId location');
};

// Static: Count active users in area
sessionSchema.statics.countUsersInArea = async function (coordinates, radiusKm) {
  const sessions = await this.getSessionsInArea(coordinates, radiusKm);
  // Return unique user count
  const uniqueUsers = new Set(sessions.map(s => s.userId.toString()));
  return uniqueUsers.size;
};

// Static: End session
sessionSchema.statics.endSession = async function (tokenOrSocketId) {
  const query = tokenOrSocketId.length > 40 
    ? { token: tokenOrSocketId }
    : { socketId: tokenOrSocketId };

  return this.findOneAndUpdate(
    query,
    {
      $set: {
        isActive: false,
        disconnectedAt: new Date(),
      },
    },
    { new: true }
  );
};

// Static: Cleanup inactive sessions (call periodically)
sessionSchema.statics.cleanupInactive = async function (inactiveMinutes = 30) {
  const cutoff = new Date(Date.now() - inactiveMinutes * 60 * 1000);

  return this.updateMany(
    {
      isActive: true,
      lastPing: { $lt: cutoff },
    },
    {
      $set: {
        isActive: false,
        disconnectedAt: new Date(),
      },
    }
  );
};

// Instance: Ping session (update lastPing)
sessionSchema.methods.ping = async function () {
  this.lastPing = new Date();
  return this.save();
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
