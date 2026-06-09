import crypto from 'crypto';
import { promisify } from 'util';

/**
 * Crypto utility for encrypting/decrypting sensitive data
 * Uses AES-256-GCM for encryption with authentication
 */

const pbkdf2 = promisify(crypto.pbkdf2);

// Get encryption key from environment or generate one for development
const getEncryptionKey = (): string => {
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

  return envKey;
};

// Lazy-loaded encryption key (only initialized when actually encrypting/decrypting)
let ENCRYPTION_KEY: string | null = null;

const IV_LENGTH = 16; // For AES, this is always 16
const TAG_LENGTH = 16; // GCM authentication tag length
const SALT_LENGTH = 64; // Salt length for key derivation

/**
 * Get or initialize the encryption key (lazy-loaded to prevent module load crashes)
 */
function ensureEncryptionKey(): string {
  if (!ENCRYPTION_KEY) {
    ENCRYPTION_KEY = getEncryptionKey();
  }
  return ENCRYPTION_KEY;
}

/**
 * Derives a key from the encryption key and salt
 * Uses async pbkdf2 to avoid blocking the event loop
 * Iterations: 210,000 (meets NIST SP 800-132 2023 recommendation)
 */
async function deriveKey(salt: Buffer): Promise<Buffer> {
  return pbkdf2(ensureEncryptionKey(), salt, 210000, 32, 'sha256');
}

/**
 * Encrypts sensitive data (like API keys)
 */
export async function encrypt(text: string): Promise<string> {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from salt (async to avoid blocking event loop)
    const key = await deriveKey(salt);

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Encrypt the text
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);

    // Get the authentication tag
    const tag = cipher.getAuthTag();

    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);

    // Return as base64 string
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts sensitive data (like API keys)
 */
export async function decrypt(encryptedText: string): Promise<string> {
  try {
    // Decode from base64
    const combined = Buffer.from(encryptedText, 'base64');

    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derive key from salt (async to avoid blocking event loop)
    const key = await deriveKey(salt);

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
