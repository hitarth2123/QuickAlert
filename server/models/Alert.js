const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    // Alert metadata
    title: {
      type: String,
      required: [true, 'Alert title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Alert description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [280, 'Short description cannot exceed 280 characters'],
    },
    // Alert type and category
    type: {
      type: String,
      required: [true, 'Alert type is required'],
      enum: [
        'emergency',
        'weather',
        'traffic',
        'crime',
        'health',
        'infrastructure',
        'community',
        'government',
        'amber',
        'silver',
        'blue',
        'evacuation',
        'shelter_in_place',
        'all_clear',
        'other',
      ],
    },
    severity: {
      type: String,
      required: [true, 'Severity is required'],
      enum: ['info', 'advisory', 'warning', 'critical', 'extreme'],
      default: 'advisory',
    },
    // Source of the alert
    source: {
      type: {
        type: String,
        enum: ['report', 'official', 'automated', 'external'],
        required: true,
      },
      reportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report',
      },
      officialSource: String,
      externalId: String,
    },
    // Creator
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Geographic targeting
    targetArea: {
      type: {
        type: String,
        enum: ['Point', 'Polygon', 'Circle'],
        default: 'Circle',
      },
      // For Point or center of Circle
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
      // For Polygon
      polygon: {
        type: [[Number]], // Array of [longitude, latitude] pairs
      },
      // For Circle
      radius: {
        type: Number,
        default: 10, // km
      },
      // Named areas
      areas: [{
        name: String,
        type: {
          type: String,
          enum: ['city', 'county', 'state', 'country', 'region', 'zone'],
        },
      }],
      // Address info
      address: String,
      city: String,
      state: String,
      country: String,
    },
    // Timing
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    effectiveUntil: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Status
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'active', 'expired', 'cancelled', 'updated'],
      default: 'draft',
    },
    // Channels for distribution
    channels: {
      push: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: false,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      inApp: {
        type: Boolean,
        default: true,
      },
      social: {
        type: Boolean,
        default: false,
      },
    },
    // Instructions and actions
    instructions: [{
      text: {
        type: String,
        required: true,
      },
      priority: {
        type: Number,
        default: 0,
      },
    }],
    actionUrl: String,
    actionLabel: String,
    // Contact information
    contactInfo: {
      phone: String,
      email: String,
      website: String,
    },
    // Media
    media: [{
      url: String,
      publicId: String,
      type: {
        type: String,
        enum: ['image', 'video', 'audio'],
      },
      caption: String,
    }],
    // Related alerts (for updates/follow-ups)
    parentAlert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
    },
    childAlerts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
    }],
    // Update history
    updates: [{
      content: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    // Delivery tracking
    delivery: {
      totalTargeted: {
        type: Number,
        default: 0,
      },
      sent: {
        type: Number,
        default: 0,
      },
      delivered: {
        type: Number,
        default: 0,
      },
      read: {
        type: Number,
        default: 0,
      },
      failed: {
        type: Number,
        default: 0,
      },
    },
    // User interactions
    interactions: {
      views: {
        type: Number,
        default: 0,
      },
      shares: {
        type: Number,
        default: 0,
      },
      acknowledgedBy: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        acknowledgedAt: {
          type: Date,
          default: Date.now,
        },
      }],
      safeCheckIns: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        status: {
          type: String,
          enum: ['safe', 'need_help', 'not_affected'],
        },
        message: String,
        location: {
          type: {
            type: String,
            enum: ['Point'],
          },
          coordinates: [Number],
        },
        checkedInAt: {
          type: Date,
          default: Date.now,
        },
      }],
    },
    // Tags for filtering
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    // Priority for sorting and display
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    // Cancellation info
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
alertSchema.index({ 'targetArea.coordinates': '2dsphere' });
alertSchema.index({ type: 1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ status: 1 });
alertSchema.index({ isActive: 1 });
alertSchema.index({ effectiveFrom: 1 });
alertSchema.index({ effectiveUntil: 1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ tags: 1 });
alertSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
});

// Virtual for checking if alert is currently effective
alertSchema.virtual('isEffective').get(function () {
  const now = new Date();
  const effectiveFrom = this.effectiveFrom || this.createdAt;
  const effectiveUntil = this.effectiveUntil;

  if (!this.isActive || this.status === 'cancelled' || this.status === 'expired') {
    return false;
  }

  if (now < effectiveFrom) {
    return false;
  }

  if (effectiveUntil && now > effectiveUntil) {
    return false;
  }

  return true;
});

// Virtual for acknowledgment rate
alertSchema.virtual('acknowledgmentRate').get(function () {
  if (this.delivery.delivered === 0) return 0;
  return (this.interactions.acknowledgedBy.length / this.delivery.delivered) * 100;
});

// Pre-save middleware
alertSchema.pre('save', function (next) {
  // Auto-generate short description if not provided
  if (!this.shortDescription && this.description) {
    this.shortDescription = this.description.substring(0, 277) + (this.description.length > 277 ? '...' : '');
  }

  // Set priority based on severity
  if (this.isModified('severity') && !this.isModified('priority')) {
    const severityPriority = {
      extreme: 10,
      critical: 8,
      warning: 6,
      advisory: 4,
      info: 2,
    };
    this.priority = severityPriority[this.severity] || 5;
  }

  // Auto-expire alerts
  if (this.effectiveUntil && new Date() > this.effectiveUntil && this.status === 'active') {
    this.status = 'expired';
    this.isActive = false;
  }

  next();
});

// Static method to find active alerts in an area
alertSchema.statics.findActiveInArea = function (coordinates, radius = 10000) {
  return this.find({
    isActive: true,
    status: 'active',
    'targetArea.coordinates': {
      $geoWithin: {
        $centerSphere: [coordinates, radius / 6371000], // radius in radians
      },
    },
    $or: [
      { effectiveUntil: { $exists: false } },
      { effectiveUntil: { $gt: new Date() } },
    ],
  }).sort({ priority: -1, createdAt: -1 });
};

// Static method to find alerts for a user based on their preferences
alertSchema.statics.findForUser = async function (user) {
  const query = {
    isActive: true,
    status: 'active',
    type: { $in: user.alertPreferences?.alertTypes || [] },
    $or: [
      { effectiveUntil: { $exists: false } },
      { effectiveUntil: { $gt: new Date() } },
    ],
  };

  // Add location filter if user has location
  if (user.location?.coordinates && user.location.coordinates[0] !== 0) {
    query['targetArea.coordinates'] = {
      $geoWithin: {
        $centerSphere: [
          user.location.coordinates,
          (user.alertPreferences?.alertRadius || 10) / 6371, // radius in radians (km / Earth radius in km)
        ],
      },
    };
  }

  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

// Instance method to acknowledge alert
alertSchema.methods.acknowledge = async function (userId) {
  const alreadyAcknowledged = this.interactions.acknowledgedBy.some(
    (a) => a.user.toString() === userId.toString()
  );

  if (!alreadyAcknowledged) {
    this.interactions.acknowledgedBy.push({
      user: userId,
      acknowledgedAt: new Date(),
    });
    await this.save();
  }

  return this;
};

// Instance method for safe check-in
alertSchema.methods.safeCheckIn = async function (userId, status, message, location) {
  // Remove existing check-in from this user
  this.interactions.safeCheckIns = this.interactions.safeCheckIns.filter(
    (c) => c.user.toString() !== userId.toString()
  );

  // Add new check-in
  this.interactions.safeCheckIns.push({
    user: userId,
    status,
    message,
    location: location
      ? {
          type: 'Point',
          coordinates: location,
        }
      : undefined,
    checkedInAt: new Date(),
  });

  await this.save();
  return this;
};

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
