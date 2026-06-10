#!/usr/bin/env node
/**
 * Check Supabase Storage Buckets
 * This script lists all storage buckets and their contents
 *
 * Purpose: Debug utility to verify that menu files exist in Supabase Storage
 * Created during investigation of "no menu pages available" issue (June 2026)
 * Kept for future debugging of storage bucket issues
 *
 * Usage: node check-storage-buckets.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBuckets() {
  console.log('🔍 Checking Supabase Storage Buckets...\n');

  try {
    // List all buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      return;
    }

    if (!buckets || buckets.length === 0) {
      console.log('📦 No storage buckets found');
      return;
    }

    console.log(`📦 Found ${buckets.length} bucket(s):\n`);

    for (const bucket of buckets) {
      console.log(`\n🗂️  Bucket: "${bucket.name}"`);
      console.log(`   ID: ${bucket.id}`);
      console.log(`   Public: ${bucket.public}`);
      console.log(`   Created: ${bucket.created_at}`);

      // Try to list files in the bucket
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.id)
        .list('', { limit: 100 });

      if (filesError) {
        console.log(`   ⚠️  Error listing files: ${filesError.message}`);
        continue;
      }

      if (!files || files.length === 0) {
        console.log(`   📁 Empty bucket`);
        continue;
      }

      console.log(`   📁 Files/Folders (${files.length}):`);
      for (const file of files) {
        if (file.id) {
          console.log(`      📄 ${file.name} (${Math.round(file.metadata?.size / 1024)}KB)`);
        } else {
          console.log(`      📂 ${file.name}/`);

          // If it's a folder, list contents
          const { data: folderFiles } = await supabase.storage
            .from(bucket.id)
            .list(file.name, { limit: 100 });

          if (folderFiles && folderFiles.length > 0) {
            console.log(`         Contents (${folderFiles.length} files):`);
            for (const subFile of folderFiles.slice(0, 5)) {
              if (subFile.id) {
                console.log(`         📄 ${subFile.name} (${Math.round(subFile.metadata?.size / 1024)}KB)`);
              }
            }
            if (folderFiles.length > 5) {
              console.log(`         ... and ${folderFiles.length - 5} more files`);
            }
          }
        }
      }
    }

    // Check specifically for menu-related files
    console.log('\n\n🔍 Checking for menu-related files in all buckets...\n');

    for (const bucket of buckets) {
      // Check for noirkc folder
      const { data: noirFiles } = await supabase.storage
        .from(bucket.id)
        .list('noirkc', { limit: 100 });

      if (noirFiles && noirFiles.length > 0) {
        console.log(`✅ Found ${noirFiles.length} files in "${bucket.id}/noirkc/"`);
        noirFiles.slice(0, 3).forEach(f => console.log(`   - ${f.name}`));
      }

      // Check for rooftopkc folder
      const { data: rooftopFiles } = await supabase.storage
        .from(bucket.id)
        .list('rooftopkc', { limit: 100 });

      if (rooftopFiles && rooftopFiles.length > 0) {
        console.log(`✅ Found ${rooftopFiles.length} files in "${bucket.id}/rooftopkc/"`);
        rooftopFiles.slice(0, 3).forEach(f => console.log(`   - ${f.name}`));
      }

      // Check for menu folder
      const { data: menuFiles } = await supabase.storage
        .from(bucket.id)
        .list('menu', { limit: 100 });

      if (menuFiles && menuFiles.length > 0) {
        console.log(`✅ Found ${menuFiles.length} items in "${bucket.id}/menu/"`);
        menuFiles.slice(0, 3).forEach(f => console.log(`   - ${f.name}`));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBuckets();
