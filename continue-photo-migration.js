require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create timestamp for unique file naming
const migrationTimestamp = Date.now();
const csvPath = path.join(__dirname, 'scripts', `migration-results-${migrationTimestamp}.csv`);

// Track migration progress
let totalMembers = 0;
let successCount = 0;
let errorCount = 0;
let skippedCount = 0;

// Download file from URL
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

// Upload to Supabase Storage
async function uploadToSupabase(buffer, fileName) {
  const { data, error } = await supabase.storage
    .from('member-photos')
    .upload(fileName, buffer, {
      contentType: `image/${fileName.split('.').pop()}`,
      upsert: true
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('member-photos')
    .getPublicUrl(fileName);

  return publicUrl;
}

// Process a single member
async function processMember(member) {
  const result = {
    member_id: member.member_id,
    first_name: member.first_name,
    last_name: member.last_name,
    account_id: member.account_id,
    original_url: member.photo,
    new_url: '',
    status: '',
    error: ''
  };

  try {
    // Skip if no photo URL
    if (!member.photo) {
      result.status = 'SKIPPED';
      result.error = 'No photo URL';
      skippedCount++;
      return result;
    }

    // Skip if already migrated (check if URL points to our storage)
    if (member.photo.includes('supabase.co/storage')) {
      result.status = 'ALREADY_MIGRATED';
      result.new_url = member.photo;
      skippedCount++;
      return result;
    }

    console.log(`Processing ${member.first_name} ${member.last_name}...`);

    // Download the photo
    const buffer = await downloadFile(member.photo);

    // Determine file extension from URL
    const urlParts = member.photo.split('.');
    const ext = urlParts[urlParts.length - 1].split('?')[0].toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const fileExt = validExts.includes(ext) ? ext : 'jpg';

    // Create unique filename
    const fileName = `migrated/${member.member_id}-${migrationTimestamp}.${fileExt}`;

    // Upload to Supabase
    const publicUrl = await uploadToSupabase(buffer, fileName);

    // Update member record with new URL
    const { error: updateError } = await supabase
      .from('members')
      .update({
        photo: publicUrl,
        photo_original_url: member.photo // Keep original URL for reference
      })
      .eq('member_id', member.member_id);

    if (updateError) throw updateError;

    result.new_url = publicUrl;
    result.status = 'SUCCESS';
    successCount++;

    console.log(`✓ Successfully migrated photo for ${member.first_name} ${member.last_name}`);
  } catch (error) {
    result.status = 'ERROR';
    result.error = error.message;
    errorCount++;
    console.error(`✗ Failed for ${member.first_name} ${member.last_name}:`, error.message);
  }

  return result;
}

// Main migration function
async function runMigration() {
  console.log('🚀 Starting photo migration...\n');

  try {
    // First, check if photo_original_url column exists
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'members'
            AND column_name = 'photo_original_url'
          ) THEN
            ALTER TABLE members ADD COLUMN photo_original_url TEXT;
          END IF;
        END $$;
      `
    }).single();

    if (alterError && !alterError.message.includes('already exists')) {
      console.log('Note: Could not add photo_original_url column. It may need to be added manually.');
    }

    // Fetch all members with external photo URLs
    const { data: members, error } = await supabase
      .from('members')
      .select('member_id, account_id, first_name, last_name, photo')
      .not('photo', 'is', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    totalMembers = members.length;
    console.log(`Found ${totalMembers} members with photos\n`);

    // Filter out already migrated photos
    const membersToMigrate = members.filter(m =>
      m.photo && !m.photo.includes('supabase.co/storage')
    );

    console.log(`${membersToMigrate.length} photos need migration`);
    console.log(`${members.length - membersToMigrate.length} photos already migrated\n`);

    if (membersToMigrate.length === 0) {
      console.log('✅ All photos are already migrated!');
      return;
    }

    // Initialize CSV file
    const csvHeader = 'member_id,first_name,last_name,account_id,original_url,new_url,status,error\n';
    fs.writeFileSync(csvPath, csvHeader);

    // Process members in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < membersToMigrate.length; i += batchSize) {
      const batch = membersToMigrate.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(processMember));

      // Write results to CSV
      results.forEach(result => {
        const csvLine = `"${result.member_id}","${result.first_name}","${result.last_name}","${result.account_id}","${result.original_url}","${result.new_url}","${result.status}","${result.error}"\n`;
        fs.appendFileSync(csvPath, csvLine);
      });

      console.log(`Progress: ${Math.min(i + batchSize, membersToMigrate.length)}/${membersToMigrate.length}`);
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`Total members checked: ${totalMembers}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped (already migrated or no photo): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`\nResults saved to: ${csvPath}`);

  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration().then(() => {
  console.log('\n✅ Migration complete!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});