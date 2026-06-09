import crypto from 'crypto';

/**
 * Crypto utility for encrypting/decrypting sensitive data
 * Uses AES-256-GCM for encryption with authentication
 *
 * IMPORTANT: ENCRYPTION_KEY environment variable is required in all environments.
 * It must be a 32-byte (256-bit) hex string generated via: openssl rand -hex 32
 *
 * Since the key is already 256 bits of cryptographically secure randomness,
 * no key derivation function (PBKDF2) is needed. We use the key directly with
 * a fresh random IV for each encryption operation.
 *
 * See SECURITY_SETUP.md for configuration instructions.
 */

// Get encryption key from environment (required in all environments)
const getEncryptionKey = (): Buffer => {
  const envKey = process.env.ENCRYPTION_KEY;

  if (process.env.NODE_ENV === 'production' && !envKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required in production. ' +
      'Generate one using: openssl rand -hex 32'
    );
  }

  if (!envKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. ' +
      'Generate one using: openssl rand -hex 32\n' +
      'Add it to your .env.local file for development.'
    );
  }

  // Validate the key format
  if (!/^[0-9a-f]{64}$/i.test(envKey)) {
    throw new Error(
      'ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters). ' +
      'Generate one using: openssl rand -hex 32'
    );
  }

  // Convert hex string to Buffer for direct use
  return Buffer.from(envKey, 'hex');
};

// Lazy-loaded encryption key (only initialized when actually encrypting/decrypting)
let ENCRYPTION_KEY: Buffer | null = null;

const IV_LENGTH = 16; // For AES-256-GCM, this is always 16 bytes
const TAG_LENGTH = 16; // GCM authentication tag length

/**
 * Get or initialize the encryption key (lazy-loaded to prevent module load crashes)
 * Returns the raw 32-byte key buffer ready for use with AES-256.
 */
function ensureEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    ENCRYPTION_KEY = getEncryptionKey();
  }
  return ENCRYPTION_KEY;
}

/**
 * Encrypts sensitive data (like API keys)
 * Uses AES-256-GCM with a fresh random IV for each encryption.
 * No KDF is needed since ENCRYPTION_KEY is already 256 bits of secure randomness.
 */
export function encrypt(text: string): string {
  try {
    // Get the raw 32-byte encryption key
    const key = ensureEncryptionKey();

    // Generate fresh random IV for this encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Encrypt the text
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);

    // Get the authentication tag
    const tag = cipher.getAuthTag();

    // Combine iv, tag, and encrypted data (no salt needed)
    const combined = Buffer.concat([iv, tag, encrypted]);

    // Return as base64 string
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts sensitive data (like API keys)
 *
 * WARNING: Data encrypted with the old PBKDF2-based format cannot be decrypted
 * with this function. If you have existing encrypted data, you must decrypt it
 * with the old code before deploying this change, then re-encrypt it.
 */
export function decrypt(encryptedText: string): string {
  try {
    // Get the raw 32-byte encryption key
    const key = ensureEncryptionKey();

    // Decode from base64
    const combined = Buffer.from(encryptedText, 'base64');

    // Extract components (no salt in new format)
    const iv = combined.slice(0, IV_LENGTH);
    const tag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    // Decrypt the text
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a value for comparison (one-way)
 */
export function hash(text: string): string {
  return crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto
    .randomBytes(length)
    .toString('hex');
}

/**
 * Validate that a value matches a hash (constant-time comparison)
 */
export function validateHash(text: string, hashValue: string): boolean {
  const textHash = crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(textHash, 'hex'),
      Buffer.from(hashValue, 'hex')
    );
  } catch {
    // If lengths don't match or invalid hex, return false
    return false;
  }
}
