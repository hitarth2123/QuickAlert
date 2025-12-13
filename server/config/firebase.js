const admin = require('firebase-admin');

/**
 * Firebase Admin Configuration for QuickAlert
 * Used for verifying Firebase tokens on the backend
 */

// Initialize Firebase Admin
// Option 1: Using service account JSON file (recommended for production)
// Option 2: Using environment variables (used here)

let firebaseAdmin = null;

const initializeFirebaseAdmin = () => {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      firebaseAdmin = admin.apps[0];
      return firebaseAdmin;
    }

    // Initialize with service account or environment variables
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Parse service account from environment variable (JSON string)
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Use individual environment variables
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        }),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      // Try default credentials (for Google Cloud environments)
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    }

    console.log('[Firebase Admin] ✓ Initialized successfully');
    return firebaseAdmin;
  } catch (error) {
    console.error('[Firebase Admin] ✗ Initialization failed:', error.message);
    console.log('[Firebase Admin] ℹ Running without Firebase verification');
    return null;
  }
};

/**
 * Verify Firebase ID token
 * @param {string} idToken - Firebase ID token from client
 * @returns {Promise<DecodedIdToken>} Decoded token with user info
 */
const verifyFirebaseToken = async (idToken) => {
  if (!firebaseAdmin) {
    initializeFirebaseAdmin();
  }

  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('[Firebase] Token verification failed:', error.message);
    throw error;
  }
};

/**
 * Get Firebase user by UID
 * @param {string} uid - Firebase user UID
 * @returns {Promise<UserRecord>}
 */
const getFirebaseUser = async (uid) => {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  return admin.auth().getUser(uid);
};

/**
 * Get Firebase user by email
 * @param {string} email - User email
 * @returns {Promise<UserRecord>}
 */
const getFirebaseUserByEmail = async (email) => {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  return admin.auth().getUserByEmail(email);
};

/**
 * Get Firebase user by phone number
 * @param {string} phoneNumber - Phone number with country code
 * @returns {Promise<UserRecord>}
 */
const getFirebaseUserByPhone = async (phoneNumber) => {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  return admin.auth().getUserByPhoneNumber(phoneNumber);
};

module.exports = {
  initializeFirebaseAdmin,
  verifyFirebaseToken,
  getFirebaseUser,
  getFirebaseUserByEmail,
  getFirebaseUserByPhone,
  admin
};
