require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTransactionAttachments() {
  console.log('🔍 Testing Transaction Attachments Setup...\n');

  try {
    // 1. Check if transaction_attachments table exists
    console.log('1. Checking transaction_attachments table...');
    const { data: tableData, error: tableError } = await supabase
      .from('transaction_attachments')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ Table does not exist or error:', tableError.message);
      console.log('💡 You need to run the migration first!');
    } else {
      console.log('✅ transaction_attachments table exists');
    }

    // 2. Check if storage bucket exists
    console.log('\n2. Checking transaction-attachments storage bucket...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.log('❌ Error checking buckets:', bucketError.message);
    } else {
      const transactionBucket = buckets.find(bucket => bucket.id === 'transaction-attachments');
      if (transactionBucket) {
        console.log('✅ transaction-attachments bucket exists');
        console.log('   - Public:', transactionBucket.public);
        console.log('   - File size limit:', transactionBucket.file_size_limit);
        console.log('   - Allowed MIME types:', transactionBucket.allowed_mime_types);
      } else {
        console.log('❌ transaction-attachments bucket does not exist');
        console.log('💡 You need to run the migration first!');
      }
    }

    // 3. Check if ledger table exists and has sample data
    console.log('\n3. Checking ledger table...');
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('ledger')
      .select('id, member_id, account_id')
      .limit(1);

    if (ledgerError) {
      console.log('❌ Error accessing ledger table:', ledgerError.message);
    } else if (ledgerData && ledgerData.length > 0) {
      console.log('✅ ledger table exists with data');
      console.log('   Sample ledger entry:', ledgerData[0]);
    } else {
      console.log('⚠️  ledger table exists but has no data');
    }

    // 4. Test storage upload (if bucket exists)
    console.log('\n4. Testing storage upload...');
    const testFileName = `test/${Date.now()}_test.pdf`;
    const testContent = Buffer.from('Test PDF content');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('transaction-attachments')
      .upload(testFileName, testContent, {
        contentType: 'application/pdf',
      });

    if (uploadError) {
      console.log('❌ Storage upload failed:', uploadError.message);
    } else {
      console.log('✅ Storage upload successful');
      
      // Clean up test file
      await supabase.storage
        .from('transaction-attachments')
        .remove([testFileName]);
      console.log('✅ Test file cleaned up');
    }

    // 5. Test database insert (if table exists)
    console.log('\n5. Testing database insert...');
    if (!tableError) {
      const testData = {
        ledger_id: ledgerData?.[0]?.id || '00000000-0000-0000-0000-000000000000',
        member_id: ledgerData?.[0]?.member_id || '00000000-0000-0000-0000-000000000000',
        account_id: ledgerData?.[0]?.account_id || '00000000-0000-0000-0000-000000000000',
        file_name: 'test.pdf',
        file_url: 'https://example.com/test.pdf',
        file_size: 1024,
      };

      const { data: insertData, error: insertError } = await supabase
        .from('transaction_attachments')
        .insert(testData)
        .select()
        .single();

      if (insertError) {
        console.log('❌ Database insert failed:', insertError.message);
      } else {
        console.log('✅ Database insert successful');
        
        // Clean up test record
        await supabase
          .from('transaction_attachments')
          .delete()
          .eq('id', insertData.id);
        console.log('✅ Test record cleaned up');
      }
    }

    console.log('\n📋 Summary:');
    if (tableError) {
      console.log('❌ Database migration needs to be run');
    } else {
      console.log('✅ Database setup is ready');
    }
    
    if (!buckets?.find(b => b.id === 'transaction-attachments')) {
      console.log('❌ Storage bucket needs to be created');
    } else {
      console.log('✅ Storage setup is ready');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTransactionAttachments(); 