const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Verification = require('../models/Verification');
const { protect, generateToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const { verifyFirebaseToken } = require('../config/firebase');

/**
 * ============================================
 * AUTHENTICATION ROUTES (/api/auth)
 * ============================================
 */

/**
 * @route   POST /api/auth/firebase-verify
 * @desc    Verify Firebase token and create/login user
 * @access  Public
 */
router.post('/firebase-verify', async (req, res) => {
  try {
    const { firebaseToken } = req.body;

    if (!firebaseToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase token is required',
      });
    }

    // Verify the Firebase token
    let decodedToken;
    try {
      decodedToken = await verifyFirebaseToken(firebaseToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Firebase token',
      });
    }

    const { uid, email, phone_number, name, picture } = decodedToken;

    // Check if user exists by Firebase UID, email, or phone
    let user = await User.findOne({
      $or: [
        { firebaseUid: uid },
        ...(email ? [{ email: email.toLowerCase() }] : []),
        ...(phone_number ? [{ phone: phone_number }] : [])
      ]
    });

    if (user) {
      // Update Firebase UID if not set
      if (!user.firebaseUid) {
        user.firebaseUid = uid;
        if (phone_number && !user.phone) {
          user.phone = phone_number;
        }
        user.isVerified = true; // Firebase verified
        await user.save();
      }
    } else {
      // Create new user from Firebase data
      const nameParts = (name || 'User').split(' ');
      user = await User.create({
        firebaseUid: uid,
        firstName: nameParts[0] || 'User',
        lastName: nameParts.slice(1).join(' ') || '',
        email: email?.toLowerCase() || `${uid}@firebase.local`,
        phone: phone_number || undefined,
        password: crypto.randomBytes(32).toString('hex'), // Random password for Firebase users
        isVerified: true, // Firebase verified
        avatar: picture ? { url: picture } : undefined,
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      message: 'Firebase authentication successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified: user.isVerified,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Firebase verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during Firebase verification',
    });
  }
});

/**
 * @route   POST /api/auth/register
 * @desc    Create new user account
 * @access  Public
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, location } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide firstName, lastName, email, and password',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phone,
      location: location || undefined,
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Create verification record and send email
    await Verification.createEmailVerification(user._id, user.email, user.firstName);

    // Generate JWT token with full payload {userId, role, email}
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
});

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email with 6-digit code
 * @access  Public
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and verification code',
      });
    }

    // Find the user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    // Find pending verification
    const verification = await Verification.findOne({
      user: user._id,
      type: 'email',
      status: 'pending',
      code: code,
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
      });
    }

    // Check if expired
    if (new Date() > verification.expiresAt) {
      verification.status = 'expired';
      await verification.save();
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    // Check max attempts
    if (verification.attempts >= verification.maxAttempts) {
      verification.status = 'expired';
      await verification.save();
      return res.status(400).json({
        success: false,
        message: 'Too many attempts. Please request a new code.',
      });
    }

    // Increment attempts
    verification.attempts += 1;
    verification.lastAttemptAt = new Date();

    // Mark verification as approved
    verification.status = 'approved';
    verification.verifiedAt = new Date();
    await verification.save();

    // Update user as verified
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification',
    });
  }
});

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification code
 * @access  Public
 */
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        message: 'If an account exists, a verification code has been sent',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    // Create new verification and send email
    await Verification.createEmailVerification(user._id, user.email, user.firstName);

    res.json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user, return JWT token
 * @access  Public
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user and include password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await user.incrementLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.updateOne({
        $set: { loginAttempts: 0, lastLogin: new Date() },
        $unset: { lockUntil: 1 },
      });
    } else {
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate tokens with full payload {userId, role, email}
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          location: user.location,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private (JWT required)
 */
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        location: user.location,
        alertPreferences: user.alertPreferences,
        emergencyContacts: user.emergencyContacts,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   PATCH /api/auth/update-location
 * @desc    Update user's last known location
 * @access  Private (JWT required)
 */
router.patch('/update-location', protect, async (req, res) => {
  try {
    const { lat, lng, address, city, state, country, zipCode } = req.body;

    // Validate coordinates
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide lat and lng coordinates',
      });
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180',
      });
    }

    const locationUpdate = {
      'location.type': 'Point',
      'location.coordinates': [parseFloat(lng), parseFloat(lat)], // GeoJSON format: [longitude, latitude]
    };

    // Add optional address fields if provided
    if (address) locationUpdate['location.address'] = address;
    if (city) locationUpdate['location.city'] = city;
    if (state) locationUpdate['location.state'] = state;
    if (country) locationUpdate['location.country'] = country;
    if (zipCode) locationUpdate['location.zipCode'] = zipCode;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: locationUpdate },
      { new: true, runValidators: true }
    ).select('-password');

    // Emit socket event for location update
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user._id}`).emit('locationUpdated', {
        coordinates: [parseFloat(lng), parseFloat(lat)],
      });
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        location: user.location,
      },
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    // Generate new tokens with full payload
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists, a password reset link has been sent',
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // TODO: Send password reset email with resetToken

    res.json({
      success: true,
      message: 'If an account exists, a password reset link has been sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    const authToken = generateToken(user);

    res.json({
      success: true,
      message: 'Password reset successful',
      token: authToken,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;
