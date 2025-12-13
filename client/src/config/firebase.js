import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut
} from 'firebase/auth';

// Firebase configuration
// Replace these with your Firebase project credentials
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Setup invisible reCAPTCHA for phone auth
 * @param {string} buttonId - ID of the button element
 * @returns {RecaptchaVerifier}
 */
const setupRecaptcha = (buttonId) => {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA verified');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
        window.recaptchaVerifier = null;
      }
    });
  }
  return window.recaptchaVerifier;
};

/**
 * Send OTP to phone number
 * @param {string} phoneNumber - Phone number with country code (e.g., +1234567890)
 * @param {string} buttonId - ID of the button element for reCAPTCHA
 * @returns {Promise<ConfirmationResult>}
 */
const sendPhoneOTP = async (phoneNumber, buttonId = 'send-otp-button') => {
  try {
    const recaptchaVerifier = setupRecaptcha(buttonId);
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    window.confirmationResult = confirmationResult;
    return confirmationResult;
  } catch (error) {
    console.error('Error sending OTP:', error);
    // Reset reCAPTCHA on error
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
    throw error;
  }
};

/**
 * Verify phone OTP
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<UserCredential>}
 */
const verifyPhoneOTP = async (otp) => {
  if (!window.confirmationResult) {
    throw new Error('No OTP request found. Please request OTP first.');
  }
  
  try {
    const result = await window.confirmationResult.confirm(otp);
    return result;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

/**
 * Send email link for passwordless sign-in
 * @param {string} email - User's email address
 * @returns {Promise<void>}
 */
const sendEmailLink = async (email) => {
  const actionCodeSettings = {
    url: `${window.location.origin}/verify-email`,
    handleCodeInApp: true,
  };
  
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // Save email for later verification
    window.localStorage.setItem('emailForSignIn', email);
    return true;
  } catch (error) {
    console.error('Error sending email link:', error);
    throw error;
  }
};

/**
 * Complete email link sign-in
 * @param {string} email - User's email (optional, will try to get from localStorage)
 * @returns {Promise<UserCredential>}
 */
const verifyEmailLink = async (email = null) => {
  if (!isSignInWithEmailLink(auth, window.location.href)) {
    throw new Error('Invalid email link');
  }
  
  const userEmail = email || window.localStorage.getItem('emailForSignIn');
  if (!userEmail) {
    throw new Error('Email not found. Please enter your email.');
  }
  
  try {
    const result = await signInWithEmailLink(auth, userEmail, window.location.href);
    window.localStorage.removeItem('emailForSignIn');
    return result;
  } catch (error) {
    console.error('Error verifying email link:', error);
    throw error;
  }
};

/**
 * Sign in with Google
 * @returns {Promise<UserCredential>}
 */
const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

/**
 * Sign out from Firebase
 */
const firebaseSignOut = async () => {
  try {
    await signOut(auth);
    window.confirmationResult = null;
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Get Firebase ID token for backend verification
 * @returns {Promise<string>}
 */
const getFirebaseToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user signed in');
  }
  return user.getIdToken();
};

/**
 * Check if user is signed in with Firebase
 * @returns {boolean}
 */
const isFirebaseAuthenticated = () => {
  return !!auth.currentUser;
};

/**
 * Get current Firebase user
 * @returns {User|null}
 */
const getCurrentFirebaseUser = () => {
  return auth.currentUser;
};

export {
  auth,
  setupRecaptcha,
  sendPhoneOTP,
  verifyPhoneOTP,
  sendEmailLink,
  verifyEmailLink,
  signInWithGoogle,
  firebaseSignOut,
  getFirebaseToken,
  isFirebaseAuthenticated,
  getCurrentFirebaseUser,
  isSignInWithEmailLink
};
