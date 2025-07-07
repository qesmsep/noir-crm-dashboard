require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupStorageBucket() {
  console.log('🔧 Setting up Supabase storage bucket for ledger PDFs...');

  try {
    // Create the bucket
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('ledger-pdfs', {
      public: true,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 52428800, // 50MB limit
    });

    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('✅ Bucket "ledger-pdfs" already exists');
      } else {
        throw bucketError;
      }
    } else {
      console.log('✅ Bucket "ledger-pdfs" created successfully');
    }

    // Set up RLS policies for the bucket
    console.log('🔧 Setting up storage policies...');

    // Policy to allow authenticated users to upload PDFs
    const { error: uploadPolicyError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Allow authenticated uploads" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'ledger-pdfs');
      `
    });

    if (uploadPolicyError && !uploadPolicyError.message.includes('already exists')) {
      console.log('⚠️  Upload policy error (may already exist):', uploadPolicyError.message);
    } else {
      console.log('✅ Upload policy created');
    }

    // Policy to allow public read access to PDFs
    const { error: readPolicyError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Allow public read access" ON storage.objects
        FOR SELECT TO public
        USING (bucket_id = 'ledger-pdfs');
      `
    });

    if (readPolicyError && !readPolicyError.message.includes('already exists')) {
      console.log('⚠️  Read policy error (may already exist):', readPolicyError.message);
    } else {
      console.log('✅ Read policy created');
    }

    console.log('🎉 Storage bucket setup complete!');
    console.log('📝 Note: You can now upload PDFs to the "ledger-pdfs" bucket');

  } catch (error) {
    console.error('❌ Error setting up storage bucket:', error);
    console.log('💡 You may need to manually create the bucket in your Supabase dashboard:');
    console.log('   1. Go to Storage in your Supabase dashboard');
    console.log('   2. Create a new bucket called "ledger-pdfs"');
    console.log('   3. Set it to public');
    console.log('   4. Allow PDF file types');
  }
}

// Run the setup
setupStorageBucket(); 