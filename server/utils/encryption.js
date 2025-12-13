const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const SALT_LENGTH = 64; // 64 bytes for salt

/**
 * Get encryption key from environment or derive from password
 * @returns {Buffer} 32-byte encryption key
 */
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // If key is already 32 bytes (64 hex chars), use directly
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // Otherwise, derive a 32-byte key using PBKDF2
  const salt = process.env.ENCRYPTION_SALT || 'quickalert-default-salt';
  return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
};

/**
 * Encrypt plaintext data using AES-256-GCM
 * @param {string} plaintext - The data to encrypt
 * @returns {string} Base64 encoded encrypted data (iv:authTag:ciphertext)
 */
const encrypt = (plaintext) => {
  if (!plaintext) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine iv, authTag, and ciphertext
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex'),
    ]);

    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt encrypted data using AES-256-GCM
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @returns {string} Decrypted plaintext
 */
const decrypt = (encryptedData) => {
  if (!encryptedData) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract iv, authTag, and ciphertext
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Hash data using SHA-256
 * @param {string} data - Data to hash
 * @returns {string} Hex encoded hash
 */
const hash = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Hash data with a salt using PBKDF2
 * @param {string} data - Data to hash
 * @param {string} salt - Optional salt (will be generated if not provided)
 * @returns {Object} Object containing hash and salt
 */
const hashWithSalt = (data, salt = null) => {
  const usedSalt = salt || crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hashedData = crypto.pbkdf2Sync(data, usedSalt, 100000, 64, 'sha256').toString('hex');

  return {
    hash: hashedData,
    salt: usedSalt,
  };
};

/**
 * Verify hashed data
 * @param {string} data - Original data to verify
 * @param {string} hashedData - Previously hashed data
 * @param {string} salt - Salt used for hashing
 * @returns {boolean} True if data matches
 */
const verifyHash = (data, hashedData, salt) => {
  const { hash: newHash } = hashWithSalt(data, salt);
  return crypto.timingSafeEqual(Buffer.from(newHash), Buffer.from(hashedData));
};

/**
 * Generate a random token
 * @param {number} length - Length of token in bytes
 * @returns {string} Hex encoded random token
 */
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a random numeric code
 * @param {number} length - Number of digits
 * @returns {string} Random numeric code
 */
const generateNumericCode = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

/**
 * Encrypt object (converts to JSON string first)
 * @param {Object} obj - Object to encrypt
 * @returns {string} Encrypted string
 */
const encryptObject = (obj) => {
  return encrypt(JSON.stringify(obj));
};

/**
 * Decrypt to object (parses JSON after decryption)
 * @param {string} encryptedData - Encrypted object data
 * @returns {Object} Decrypted object
 */
const decryptObject = (encryptedData) => {
  const decrypted = decrypt(encryptedData);
  return decrypted ? JSON.parse(decrypted) : null;
};

/**
 * Create HMAC signature
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key (uses env var if not provided)
 * @returns {string} HMAC signature
 */
const createHmac = (data, secret = null) => {
  const key = secret || process.env.HMAC_SECRET || process.env.JWT_SECRET;
  return crypto.createHmac('sha256', key).update(data).digest('hex');
};

/**
 * Verify HMAC signature
 * @param {string} data - Original data
 * @param {string} signature - HMAC signature to verify
 * @param {string} secret - Secret key
 * @returns {boolean} True if signature is valid
 */
const verifyHmac = (data, signature, secret = null) => {
  const expectedSignature = createHmac(data, secret);
  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
};

/**
 * Mask sensitive data (e.g., show last 4 characters)
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of characters to show at end
 * @param {string} maskChar - Character to use for masking
 * @returns {string} Masked string
 */
const maskSensitiveData = (data, visibleChars = 4, maskChar = '*') => {
  if (!data || data.length <= visibleChars) {
    return maskChar.repeat(data?.length || 4);
  }

  const maskedLength = data.length - visibleChars;
  return maskChar.repeat(maskedLength) + data.slice(-visibleChars);
};

/**
 * Generate a secure random password
 * @param {number} length - Password length
 * @returns {string} Random password
 */
const generateSecurePassword = (length = 16) => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = lowercase + uppercase + numbers + symbols;

  let password = '';

  // Ensure at least one of each type
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += symbols[crypto.randomInt(symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => crypto.randomInt(3) - 1)
    .join('');
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  hashWithSalt,
  verifyHash,
  generateToken,
  generateNumericCode,
  encryptObject,
  decryptObject,
  createHmac,
  verifyHmac,
  maskSensitiveData,
  generateSecurePassword,
  ALGORITHM,
};
