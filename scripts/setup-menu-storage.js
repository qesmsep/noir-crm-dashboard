#!/usr/bin/env node
/**
 * Setup Menu Storage in Supabase
 *
 * This script creates the menu-images storage bucket in Supabase
 * and uploads any existing local menu images.
 *
 * Usage: node scripts/setup-menu-storage.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n   Please add these to your .env.local file');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupMenuStorage() {
  console.log('🚀 Setting up menu storage in Supabase...\n');

  try {
    // Step 1: Create the bucket
    console.log('📦 Creating menu-images bucket...');
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('menu-images', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      throw bucketError;
    }
    console.log('   ✅ Bucket ready\n');

    // Step 2: Upload existing local menu files if they exist
    const menuDir = path.join(process.cwd(), 'public', 'menu');
    if (fs.existsSync(menuDir)) {
      console.log('📤 Uploading existing menu images...\n');

      const locations = fs.readdirSync(menuDir).filter(f =>
        fs.statSync(path.join(menuDir, f)).isDirectory()
      );

      for (const location of locations) {
        const locationDir = path.join(menuDir, location);
        const files = fs.readdirSync(locationDir).filter(f =>
          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f)
        );

        if (files.length > 0) {
          console.log(`   📁 ${location}:`);
          for (const file of files) {
            const filePath = path.join(locationDir, file);
            const fileContent = fs.readFileSync(filePath);
            const storagePath = `${location}/${file}`;

            const { error: uploadError } = await supabase.storage
              .from('menu-images')
              .upload(storagePath, fileContent, {
                contentType: `image/${path.extname(file).substring(1)}`,
                upsert: true
              });

            if (uploadError) {
              console.log(`      ⚠️  ${file}: ${uploadError.message}`);
            } else {
              console.log(`      ✅ ${file}`);
            }
          }
        }
      }
      console.log('\n');
    }

    // Step 3: Display instructions
    console.log('✨ Setup complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. The menu storage system is now active');
    console.log('   2. Upload/delete operations will use Supabase Storage in production');
    console.log('   3. Local development will continue using the filesystem');
    console.log('   4. All existing menu images have been uploaded to Supabase\n');

    console.log('🔗 View your storage bucket at:');
    console.log(`   ${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '.supabase.com')}/project/_/storage/buckets/menu-images\n`);

  } catch (error) {
    console.error('❌ Error setting up menu storage:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupMenuStorage();