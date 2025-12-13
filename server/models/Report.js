const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    // Reporter information (optional for anonymous reports)
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    // Report details
    title: {
      type: String,
      required: [true, 'Report title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Report description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    // Encrypted sensitive data (stored as encrypted string)
    sensitiveData: {
      type: String, // AES-256 encrypted
    },
    // Category and type
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'emergency',
        'crime',
        'accident',
        'fire',
        'medical',
        'natural_disaster',
        'infrastructure',
        'suspicious_activity',
        'traffic',
        'weather',
        'public_safety',
        'other',
      ],
    },
    subcategory: {
      type: String,
      trim: true,
    },
    severity: {
      type: String,
      required: [true, 'Severity is required'],
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    // Location
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Location coordinates are required'],
      },
      address: String,
      landmark: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    // Media attachments
    media: [{
      url: {
        type: String,
        required: true,
      },
      publicId: String,
      type: {
        type: String,
        enum: ['image', 'video'],
        required: true,
      },
      thumbnail: String,
      caption: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    // Status and workflow
    status: {
      type: String,
      enum: [
        'pending',
        'verified',
        'in_progress',
        'resolved',
        'rejected',
        'duplicate',
        'escalated',
      ],
      default: 'pending',
    },
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedAt: Date,
    // Verification
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending_verification', 'verified', 'false_report'],
      default: 'unverified',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: Date,
    verificationNotes: String,
    // Community votes (for credibility)
    votes: {
      up: {
        type: Number,
        default: 0,
      },
      down: {
        type: Number,
        default: 0,
      },
      voters: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        vote: {
          type: String,
          enum: ['up', 'down'],
        },
        votedAt: {
          type: Date,
          default: Date.now,
        },
      }],
    },
    // Comments/Updates
    updates: [{
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      content: {
        type: String,
        required: true,
        maxlength: 1000,
      },
      isOfficial: {
        type: Boolean,
        default: false,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    // Related reports
    relatedReports: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    }],
    // Alert generated from this report
    generatedAlert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
    },
    // Timestamps for workflow
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolutionNotes: String,
    // Analytics
    viewCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    // Tags for search
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    // Expiry for time-sensitive reports
    expiresAt: Date,
    isExpired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
reportSchema.index({ 'location.coordinates': '2dsphere' });
reportSchema.index({ category: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ severity: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ reporter: 1 });
reportSchema.index({ tags: 1 });
reportSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
});

// Virtual for vote score
reportSchema.virtual('voteScore').get(function () {
  return this.votes.up - this.votes.down;
});

// Virtual for credibility score
reportSchema.virtual('credibilityScore').get(function () {
  const voteScore = this.votes.up - this.votes.down;
  const totalVotes = this.votes.up + this.votes.down;

  if (totalVotes === 0) return 50; // Neutral

  const voteRatio = voteScore / totalVotes;
  let score = 50 + (voteRatio * 25);

  // Add bonus for verification
  if (this.verificationStatus === 'verified') {
    score += 25;
  } else if (this.verificationStatus === 'false_report') {
    score = 0;
  }

  return Math.min(100, Math.max(0, score));
});

// Pre-save middleware
reportSchema.pre('save', function (next) {
  // Auto-set priority based on severity
  if (this.isModified('severity') && !this.isModified('priority')) {
    const severityPriority = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
    };
    this.priority = severityPriority[this.severity] || 3;
  }

  // Auto-generate tags from category and subcategory
  if (this.isModified('category') || this.isModified('subcategory')) {
    const autoTags = [this.category];
    if (this.subcategory) {
      autoTags.push(this.subcategory.toLowerCase());
    }
    this.tags = [...new Set([...this.tags, ...autoTags])];
  }

  next();
});

// Static method to find nearby reports
reportSchema.statics.findNearby = function (coordinates, maxDistance = 10000, filters = {}) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates,
        },
        $maxDistance: maxDistance, // in meters
      },
    },
    isExpired: { $ne: true },
    ...filters,
  });
};

// Instance method to add vote
reportSchema.methods.addVote = async function (userId, voteType) {
  // Check if user already voted
  const existingVoteIndex = this.votes.voters.findIndex(
    (v) => v.user.toString() === userId.toString()
  );

  if (existingVoteIndex !== -1) {
    const existingVote = this.votes.voters[existingVoteIndex];

    // Same vote - remove it
    if (existingVote.vote === voteType) {
      this.votes[voteType]--;
      this.votes.voters.splice(existingVoteIndex, 1);
    } else {
      // Different vote - change it
      this.votes[existingVote.vote]--;
      this.votes[voteType]++;
      this.votes.voters[existingVoteIndex].vote = voteType;
      this.votes.voters[existingVoteIndex].votedAt = new Date();
    }
  } else {
    // New vote
    this.votes[voteType]++;
    this.votes.voters.push({
      user: userId,
      vote: voteType,
      votedAt: new Date(),
    });
  }

  return this.save();
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
