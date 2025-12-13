const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password in queries by default
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s-]{10,}$/, 'Please provide a valid phone number'],
    },
    avatar: {
      url: String,
      publicId: String,
    },
    role: {
      type: String,
      enum: ['user', 'responder', 'admin', 'super_admin'],
      default: 'user',
    },
    permissions: [{
      type: String,
    }],
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Location for proximity-based alerts
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
      address: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    // Alert preferences
    alertPreferences: {
      pushEnabled: {
        type: Boolean,
        default: true,
      },
      emailEnabled: {
        type: Boolean,
        default: true,
      },
      smsEnabled: {
        type: Boolean,
        default: false,
      },
      alertRadius: {
        type: Number,
        default: 10, // km
        min: 1,
        max: 100,
      },
      alertTypes: {
        type: [String],
        default: ['emergency', 'weather', 'traffic', 'crime', 'health', 'other'],
      },
    },
    // Emergency contacts
    emergencyContacts: [{
      name: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      relationship: String,
    }],
    // Device tokens for push notifications
    deviceTokens: [{
      token: String,
      platform: {
        type: String,
        enum: ['ios', 'android', 'web'],
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,
    // Email verification
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    // Account security
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    // Responder-specific fields
    responderInfo: {
      organization: String,
      badge: String,
      department: String,
      specialization: String,
      isOnDuty: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for geospatial queries
userSchema.index({ 'location.coordinates': '2dsphere' });
userSchema.index({ email: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }

  return this.updateOne(updates);
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

  return resetToken;
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
