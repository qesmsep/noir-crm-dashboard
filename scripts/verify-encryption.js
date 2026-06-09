#!/usr/bin/env node

/**
 * Script to verify encryption configuration
 * Checks that encryption is properly set up and working
 */

const crypto = require('crypto');

console.log('🔐 Verifying Encryption Configuration\n');
console.log('='.repeat(50));

// Check environment
const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`Environment: ${nodeEnv}`);

// Check encryption key
const encryptionKey = process.env.ENCRYPTION_KEY;

if (!encryptionKey) {
  if (nodeEnv === 'production') {
    console.error('❌ CRITICAL: ENCRYPTION_KEY is not set in production!');
    console.error('   This will cause the application to fail.');
    console.error('   Generate a key using: openssl rand -hex 32');
    process.exit(1);
  } else {
    console.warn('⚠️  WARNING: ENCRYPTION_KEY is not set');
    console.warn('   Using auto-generated development key');
    console.warn('   Set ENCRYPTION_KEY for production use');
  }
} else {
  console.log('✅ ENCRYPTION_KEY is set');

  // Validate key format
  if (!/^[0-9a-f]{64}$/i.test(encryptionKey)) {
    console.error('❌ ERROR: ENCRYPTION_KEY has invalid format');
    console.error('   Must be a 64-character hex string');
    console.error('   Generate a valid key using: openssl rand -hex 32');
    process.exit(1);
  } else {
    console.log('✅ ENCRYPTION_KEY format is valid');
  }
}

console.log('\n' + '='.repeat(50));
console.log('Testing Encryption/Decryption\n');

// Test encryption/decryption
try {
  // Import the crypto module (this would be your actual crypto module in production)
  const testKey = encryptionKey || crypto.createHash('sha256').update('development-key').digest('hex');

  // Test data
  const testData = 'sk_test_1234567890abcdef';
  console.log(`Test data: ${testData}`);

  // Simulate encryption
  const salt = crypto.randomBytes(64);
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(testKey, salt, 100000, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(testData, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  const encryptedText = combined.toString('base64');

  console.log(`✅ Encryption successful`);
  console.log(`   Encrypted length: ${encryptedText.length} characters`);

  // Simulate decryption
  const combinedDecrypt = Buffer.from(encryptedText, 'base64');
  const saltDecrypt = combinedDecrypt.slice(0, 64);
  const ivDecrypt = combinedDecrypt.slice(64, 80);
  const tagDecrypt = combinedDecrypt.slice(80, 96);
  const encryptedDecrypt = combinedDecrypt.slice(96);
  const keyDecrypt = crypto.pbkdf2Sync(testKey, saltDecrypt, 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyDecrypt, ivDecrypt);
  decipher.setAuthTag(tagDecrypt);
  const decrypted = Buffer.concat([
    decipher.update(encryptedDecrypt),
    decipher.final()
  ]).toString('utf8');

  if (decrypted === testData) {
    console.log('✅ Decryption successful');
    console.log('   Data integrity verified');
  } else {
    console.error('❌ Decryption failed: data mismatch');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Encryption/Decryption test failed:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(50));
console.log('Database Encryption Status Check\n');

// Check database for unencrypted sensitive settings
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Cannot check database: Supabase configuration missing');
} else {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  (async () => {
    try {
      // Check for unencrypted sensitive settings
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('key, is_encrypted')
        .or('key.like.%api_key%,key.like.%secret%,key.like.%token%');

      if (error) {
        console.warn('⚠️  Could not query database:', error.message);
      } else if (settings) {
        const unencrypted = settings.filter(s => !s.is_encrypted);

        if (unencrypted.length > 0) {
          console.warn(`⚠️  Found ${unencrypted.length} unencrypted sensitive settings:`);
          unencrypted.forEach(s => {
            console.warn(`   - ${s.key}`);
          });
          console.warn('\n   Run: node scripts/encrypt-api-keys.js to encrypt them');
        } else {
          console.log('✅ All sensitive settings are encrypted');
        }

        // Show summary
        const encrypted = settings.filter(s => s.is_encrypted);
        console.log(`\nSummary:`);
        console.log(`   Total sensitive settings: ${settings.length}`);
        console.log(`   Encrypted: ${encrypted.length}`);
        console.log(`   Unencrypted: ${unencrypted.length}`);
      }
    } catch (err) {
      console.error('❌ Database check failed:', err.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('Verification Complete\n');

    if (encryptionKey || nodeEnv !== 'production') {
      console.log('✅ Encryption configuration is valid');
      if (!encryptionKey && nodeEnv !== 'production') {
        console.log('   (Using development key - set ENCRYPTION_KEY for production)');
      }
    } else {
      console.error('❌ Encryption configuration needs attention');
      process.exit(1);
    }
  })();
}
