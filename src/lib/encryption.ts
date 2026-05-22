import crypto from 'crypto';

// Validate and load encryption key at module initialization
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY_HEX) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

if (ENCRYPTION_KEY_HEX.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
}

// Test that it's valid hex
if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY_HEX)) {
  throw new Error('ENCRYPTION_KEY must contain only hexadecimal characters');
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES-GCM requires 16-byte IV
const AUTH_TAG_LENGTH = 16; // GCM authentication tag length

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns: base64-encoded string in format: iv:authTag:encrypted
 *
 * @param plaintext - The string to encrypt (e.g., Stripe secret key)
 * @returns Encrypted string in format "iv:authTag:ciphertext" (all base64)
 * @throws Error if plaintext is empty or encryption fails
 */
export function encrypt(plaintext: string): string {
  if (!plaintext || plaintext.trim() === '') {
    throw new Error('Cannot encrypt empty string');
  }

  try {
    // Generate random IV for each encryption (never reuse IVs!)
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag (provides integrity check)
    const authTag = cipher.getAuthTag();

    // Combine: iv:authTag:encrypted (all base64-encoded)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error: any) {
    console.error('Encryption failed:', error.message);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts an encrypted string (format: iv:authTag:encrypted)
 * Returns: original plaintext string
 *
 * @param encryptedData - Encrypted string in format "iv:authTag:ciphertext"
 * @returns Decrypted plaintext string
 * @throws Error if data is invalid or decryption fails
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid encrypted data: must be a non-empty string');
  }

  if (!encryptedData.includes(':')) {
    throw new Error('Invalid encrypted data format: missing separators');
  }

  try {
    // Split into components
    const [ivBase64, authTagBase64, encryptedBase64] = encryptedData.split(':');

    if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new Error('Malformed encrypted data: missing components');
    }

    // Decode from base64
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    // Validate IV length
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }

    // Validate auth tag length
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error: any) {
    console.error('Decryption failed:', error.message);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Masks a sensitive string, showing only last N characters
 * Example: "sk_live_abc123xyz789" -> "sk_live_••••••••z789"
 *
 * @param key - The key to mask
 * @param lastCharsCount - Number of characters to show at the end (default: 4)
 * @returns Masked string
 */
export function maskKey(key: string, lastCharsCount: number = 4): string {
  if (!key || typeof key !== 'string') {
    return '••••••••';
  }

  if (key.length <= lastCharsCount) {
    return '••••••••';
  }

  // Keep the prefix (e.g., "sk_live_", "pk_test_", "whsec_")
  const underscoreIndex = key.indexOf('_');
  const secondUnderscoreIndex = underscoreIndex >= 0 ? key.indexOf('_', underscoreIndex + 1) : -1;
  const prefixEndIndex = secondUnderscoreIndex >= 0 ? secondUnderscoreIndex + 1 : 0;

  const prefix = key.substring(0, prefixEndIndex);
  const masked = '•'.repeat(Math.max(0, key.length - prefix.length - lastCharsCount));
  const lastChars = key.slice(-lastCharsCount);

  return `${prefix}${masked}${lastChars}`;
}

/**
 * Validates Stripe key format
 *
 * @param key - The Stripe key to validate
 * @param type - The expected key type
 * @returns true if valid, false otherwise
 */
export function validateStripeKey(key: string, type: 'secret' | 'publishable' | 'webhook'): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  const patterns = {
    secret: /^sk_(live|test)_[A-Za-z0-9]{24,}$/,
    publishable: /^pk_(live|test)_[A-Za-z0-9]{24,}$/,
    webhook: /^whsec_[A-Za-z0-9]{32,}$/
  };

  return patterns[type].test(key);
}

/**
 * Generates a new encryption key (for initial setup or rotation)
 * Returns: 64-character hex string (32 bytes)
 *
 * Usage: node -e "console.log(require('./src/lib/encryption').generateEncryptionKey())"
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
