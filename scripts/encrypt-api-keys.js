#!/usr/bin/env node

/**
 * Script to encrypt existing API keys in the database
 * Run this after applying the migration to encrypt sensitive settings
 */

const { createClient } = require('@supabase/supabase-js');
const { encrypt } = require('../src/lib/crypto');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// List of setting keys that should be encrypted
const SENSITIVE_KEYS = [
  'anthropic_api_key',
  'openai_api_key',
  'stripe_secret_key',
  'stripe_webhook_secret',
  'aws_secret_access_key',
  'sendgrid_api_key',
  'twilio_auth_token'
];

async function encryptApiKeys() {
  console.log('🔐 Starting API key encryption...\n');

  try {
    // Fetch all active settings that should be encrypted
    const { data: settings, error: fetchError } = await supabase
      .from('system_settings')
      .select('id, setting_key, setting_value, is_encrypted')
      .in('setting_key', SENSITIVE_KEYS)
      .eq('is_active', true)
      .eq('is_encrypted', false);

    if (fetchError) {
      throw new Error(`Failed to fetch settings: ${fetchError.message}`);
    }

    if (!settings || settings.length === 0) {
      console.log('✅ No unencrypted API keys found');
      return;
    }

    console.log(`Found ${settings.length} unencrypted sensitive settings:\n`);

    let successCount = 0;
    let errorCount = 0;

    // Encrypt each setting
    for (const setting of settings) {
      try {
        console.log(`  Encrypting: ${setting.setting_key}...`);

        // Skip if already encrypted
        if (setting.is_encrypted) {
          console.log(`    ⚠️  Already encrypted, skipping`);
          continue;
        }

        // Skip empty values
        if (!setting.setting_value || setting.setting_value.trim() === '') {
          console.log(`    ⚠️  Empty value, skipping`);
          continue;
        }

        // Encrypt the value
        const encryptedValue = await encrypt(setting.setting_value);

        // Update the database
        const { error: updateError } = await supabase
          .from('system_settings')
          .update({
            setting_value: encryptedValue,
            is_encrypted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', setting.id);

        if (updateError) {
          throw new Error(`Failed to update: ${updateError.message}`);
        }

        console.log(`    ✅ Successfully encrypted`);
        successCount++;

      } catch (error) {
        console.error(`    ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Encryption Summary:');
    console.log(`  ✅ Successfully encrypted: ${successCount}`);
    if (errorCount > 0) {
      console.log(`  ❌ Failed: ${errorCount}`);
    }
    console.log('='.repeat(50));

    // Check encryption status
    const { data: statusData } = await supabase
      .from('v_encryption_status')
      .select('*')
      .single();

    if (statusData) {
      console.log('\nCurrent Encryption Status:');
      console.log(`  🔐 Encrypted settings: ${statusData.encrypted_count}`);
      console.log(`  🔓 Unencrypted settings: ${statusData.unencrypted_count}`);

      if (statusData.unencrypted_sensitive_count > 0) {
        console.log(`  ⚠️  Unencrypted sensitive settings: ${statusData.unencrypted_sensitive_count}`);
        console.log(`     Keys: ${statusData.unencrypted_sensitive_keys.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
encryptApiKeys()
  .then(() => {
    console.log('\n✅ Encryption process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
