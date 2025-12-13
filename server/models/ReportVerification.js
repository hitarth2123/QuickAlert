const mongoose = require('mongoose');

/**
 * ReportVerification Schema - Track verification votes per report
 * Separate from user Verification (email/phone/identity verification)
 */
const reportVerificationSchema = new mongoose.Schema(
  {
    // Report being verified
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      required: [true, 'Report ID is required'],
    },
    // User who verified
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    // Vote type
    vote: {
      type: String,
      enum: ['confirm', 'deny'],
      required: [true, 'Vote is required'],
    },
    // User's location when voting (for proximity verification)
    userLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'User location coordinates are required'],
      },
    },
    // Distance from report when verified (in km)
    distanceFromReport: {
      type: Number,
    },
    // Timestamp
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
    // Additional metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      deviceType: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index - one vote per user per report
reportVerificationSchema.index({ reportId: 1, userId: 1 }, { unique: true });

// Additional indexes
reportVerificationSchema.index({ reportId: 1 });
reportVerificationSchema.index({ userId: 1 });
reportVerificationSchema.index({ vote: 1 });
reportVerificationSchema.index({ verifiedAt: -1 });
reportVerificationSchema.index({ 'userLocation.coordinates': '2dsphere' });

// Static: Add or update verification vote
reportVerificationSchema.statics.addVote = async function (reportId, userId, vote, userCoords, distanceKm, metadata = {}) {
  const Report = mongoose.model('Report');
  
  // Check if user already voted
  const existingVote = await this.findOne({ reportId, userId });
  
  if (existingVote) {
    // Update existing vote
    const oldVote = existingVote.vote;
    existingVote.vote = vote;
    existingVote.userLocation.coordinates = userCoords;
    existingVote.distanceFromReport = distanceKm;
    existingVote.verifiedAt = new Date();
    existingVote.metadata = { ...existingVote.metadata, ...metadata };
    await existingVote.save();
    
    // Update report counts if vote changed
    if (oldVote !== vote) {
      const update = {};
      if (oldVote === 'confirm') {
        update.$inc = { verificationCount: -1 };
        update.$pull = { verifiedBy: userId };
      }
      if (vote === 'confirm') {
        update.$inc = { ...update.$inc, verificationCount: 1 };
        update.$addToSet = { verifiedBy: userId };
      }
      await Report.findByIdAndUpdate(reportId, update);
    }
    
    return { vote: existingVote, isNew: false, changed: oldVote !== vote };
  }
  
  // Create new vote
  const newVote = await this.create({
    reportId,
    userId,
    vote,
    userLocation: {
      type: 'Point',
      coordinates: userCoords,
    },
    distanceFromReport: distanceKm,
    metadata,
  });
  
  // Update report
  if (vote === 'confirm') {
    await Report.findByIdAndUpdate(reportId, {
      $inc: { verificationCount: 1 },
      $addToSet: { verifiedBy: userId },
    });
  }
  
  return { vote: newVote, isNew: true, changed: true };
};

// Static: Get votes for a report
reportVerificationSchema.statics.getVotesForReport = async function (reportId) {
  const votes = await this.find({ reportId })
    .populate('userId', 'firstName lastName')
    .sort({ verifiedAt: -1 });
  
  const confirms = votes.filter(v => v.vote === 'confirm').length;
  const denies = votes.filter(v => v.vote === 'deny').length;
  
  return {
    votes,
    confirms,
    denies,
    total: votes.length,
  };
};

// Static: Check if user voted on report
reportVerificationSchema.statics.getUserVote = async function (reportId, userId) {
  return this.findOne({ reportId, userId });
};

// Static: Get user's verification history
reportVerificationSchema.statics.getUserVerifications = async function (userId, limit = 50) {
  return this.find({ userId })
    .populate('reportId', 'title category status')
    .sort({ verifiedAt: -1 })
    .limit(limit);
};

// Static: Auto-verify report if threshold reached
reportVerificationSchema.statics.checkAutoVerify = async function (reportId, threshold = 3) {
  const Report = mongoose.model('Report');
  
  const confirms = await this.countDocuments({ reportId, vote: 'confirm' });
  
  if (confirms >= threshold) {
    await Report.findByIdAndUpdate(reportId, {
      $set: {
        status: 'verified',
        verificationStatus: 'verified',
        verifiedAt: new Date(),
      },
    });
    return true;
  }
  
  return false;
};

// Static: Remove user's vote
reportVerificationSchema.statics.removeVote = async function (reportId, userId) {
  const Report = mongoose.model('Report');
  
  const vote = await this.findOneAndDelete({ reportId, userId });
  
  if (vote && vote.vote === 'confirm') {
    await Report.findByIdAndUpdate(reportId, {
      $inc: { verificationCount: -1 },
      $pull: { verifiedBy: userId },
    });
  }
  
  return vote;
};

const ReportVerification = mongoose.model('ReportVerification', reportVerificationSchema);

module.exports = ReportVerification;
