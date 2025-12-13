const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    // User requesting verification
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Type of verification
    type: {
      type: String,
      required: [true, 'Verification type is required'],
      enum: [
        'email',
        'phone',
        'identity',
        'responder',
        'organization',
        'address',
      ],
    },
    // Verification token/code
    token: {
      type: String,
      required: true,
    },
    code: {
      type: String, // For SMS/email verification codes
    },
    // Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired', 'cancelled'],
      default: 'pending',
    },
    // Verification data
    data: {
      // For email verification
      email: String,
      // For phone verification
      phone: String,
      // For identity verification
      documentType: {
        type: String,
        enum: ['passport', 'drivers_license', 'national_id', 'other'],
      },
      documentNumber: String, // Encrypted
      documentImage: {
        url: String,
        publicId: String,
      },
      selfieImage: {
        url: String,
        publicId: String,
      },
      // For responder verification
      organization: String,
      badge: String,
      department: String,
      supervisorName: String,
      supervisorEmail: String,
      supervisorPhone: String,
      employeeId: String,
      // For organization verification
      organizationType: {
        type: String,
        enum: ['government', 'law_enforcement', 'fire_department', 'medical', 'ngo', 'other'],
      },
      registrationNumber: String,
      taxId: String,
      // For address verification
      address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
      },
      proofOfAddress: {
        url: String,
        publicId: String,
      },
    },
    // Expiry
    expiresAt: {
      type: Date,
      required: true,
    },
    // Attempt tracking
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastAttemptAt: Date,
    // Review info
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    reviewNotes: String,
    rejectionReason: String,
    // IP tracking for security
    requestIp: String,
    verificationIp: String,
    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
verificationSchema.index({ user: 1, type: 1 });
verificationSchema.index({ token: 1 });
verificationSchema.index({ code: 1 });
verificationSchema.index({ status: 1 });
verificationSchema.index({ expiresAt: 1 });
verificationSchema.index({ createdAt: -1 });

// Virtual to check if verification is expired
verificationSchema.virtual('isExpired').get(function () {
  return new Date() > this.expiresAt;
});

// Virtual to check if max attempts reached
verificationSchema.virtual('maxAttemptsReached').get(function () {
  return this.attempts >= this.maxAttempts;
});

// Pre-save middleware
verificationSchema.pre('save', function (next) {
  // Auto-expire if past expiration date
  if (this.isExpired && this.status === 'pending') {
    this.status = 'expired';
  }

  next();
});

// Static method to generate verification token
verificationSchema.statics.generateToken = function () {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

// Static method to generate verification code (6 digits)
verificationSchema.statics.generateCode = function () {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Static method to create email verification
verificationSchema.statics.createEmailVerification = async function (userId, email) {
  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Cancel any existing pending email verifications
  await this.updateMany(
    { user: userId, type: 'email', status: 'pending' },
    { status: 'cancelled' }
  );

  return this.create({
    user: userId,
    type: 'email',
    token: token,
    data: { email },
    expiresAt,
    maxAttempts: 5,
  });
};

// Static method to create phone verification
verificationSchema.statics.createPhoneVerification = async function (userId, phone, ip) {
  const code = this.generateCode();
  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Cancel any existing pending phone verifications
  await this.updateMany(
    { user: userId, type: 'phone', status: 'pending' },
    { status: 'cancelled' }
  );

  return this.create({
    user: userId,
    type: 'phone',
    token,
    code,
    data: { phone },
    expiresAt,
    maxAttempts: 3,
    requestIp: ip,
  });
};

// Static method to create responder verification
verificationSchema.statics.createResponderVerification = async function (userId, data) {
  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Cancel any existing pending responder verifications
  await this.updateMany(
    { user: userId, type: 'responder', status: 'pending' },
    { status: 'cancelled' }
  );

  return this.create({
    user: userId,
    type: 'responder',
    token,
    data,
    expiresAt,
    maxAttempts: 1, // One attempt for document verification
  });
};

// Instance method to verify with code
verificationSchema.methods.verifyCode = async function (inputCode, ip) {
  this.attempts++;
  this.lastAttemptAt = new Date();
  this.verificationIp = ip;

  if (this.isExpired) {
    this.status = 'expired';
    await this.save();
    return { success: false, message: 'Verification code has expired' };
  }

  if (this.maxAttemptsReached) {
    this.status = 'expired';
    await this.save();
    return { success: false, message: 'Maximum attempts reached' };
  }

  if (this.code !== inputCode) {
    await this.save();
    return {
      success: false,
      message: 'Invalid verification code',
      attemptsRemaining: this.maxAttempts - this.attempts,
    };
  }

  this.status = 'approved';
  this.reviewedAt = new Date();
  await this.save();

  return { success: true };
};

// Instance method to verify with token
verificationSchema.methods.verifyToken = async function (inputToken) {
  if (this.isExpired) {
    this.status = 'expired';
    await this.save();
    return { success: false, message: 'Verification link has expired' };
  }

  if (this.token !== inputToken) {
    return { success: false, message: 'Invalid verification link' };
  }

  this.status = 'approved';
  this.reviewedAt = new Date();
  await this.save();

  return { success: true };
};

// Instance method for admin review
verificationSchema.methods.review = async function (reviewerId, approved, notes, rejectionReason) {
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;

  if (approved) {
    this.status = 'approved';
  } else {
    this.status = 'rejected';
    this.rejectionReason = rejectionReason;
  }

  await this.save();
  return this;
};

const Verification = mongoose.model('Verification', verificationSchema);

module.exports = Verification;
