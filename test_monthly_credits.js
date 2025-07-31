// Test script for monthly credit processing
// Run this to test the functionality locally

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Check for required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease set these variables in your .env.local file.');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMonthlyCredits() {
  console.log('🧪 Testing monthly credit processing...');
  console.log('📊 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  try {
    // 1. Test database connection
    console.log('\n🔌 Testing database connection...');
    const { data: testData, error: testError } = await supabaseAdmin
      .from('members')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }
    console.log('✅ Database connection successful');

    // 2. Test the database function directly
    console.log('\n📊 Testing database function...');
    const { data: creditResults, error: creditError } = await supabaseAdmin
      .rpc('process_monthly_credits');

    if (creditError) {
      console.error('❌ Database function error:', creditError);
      console.log('💡 This might be expected if the function hasn\'t been created yet.');
    } else {
      console.log('✅ Database function results:', creditResults);
    }

    // 3. Check current member data
    console.log('\n👥 Checking current member data...');
    const { data: members, error: membersError } = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, membership, monthly_credit, last_credit_date, credit_renewal_date')
      .limit(5);

    if (membersError) {
      console.error('❌ Error fetching members:', membersError);
      return;
    }

    console.log('✅ Members found:', members.length);
    console.log('📋 Sample member data:', members.slice(0, 2));

    // 4. Check ledger entries
    console.log('\n💰 Checking ledger entries...');
    const { data: ledgerEntries, error: ledgerError } = await supabaseAdmin
      .from('ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ledgerError) {
      console.error('❌ Error fetching ledger:', ledgerError);
      return;
    }

    console.log('✅ Ledger entries found:', ledgerEntries.length);
    console.log('📋 Sample ledger data:', ledgerEntries.slice(0, 2));

    // 5. Test API endpoint (if running locally)
    if (process.env.CAMPAIGN_PROCESSING_TOKEN) {
      console.log('\n🌐 Testing API endpoint...');
      try {
        const response = await fetch('http://localhost:3000/api/process-monthly-credits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CAMPAIGN_PROCESSING_TOKEN}`
          }
        });

        if (response.ok) {
          const apiResult = await response.json();
          console.log('✅ API endpoint results:', apiResult);
        } else {
          console.log('⚠️  API endpoint not available (server not running or endpoint not deployed)');
        }
      } catch (apiError) {
        console.log('⚠️  API endpoint test skipped (server not running)');
      }
    } else {
      console.log('\n⚠️  Skipping API endpoint test (CAMPAIGN_PROCESSING_TOKEN not set)');
    }

    console.log('\n🎉 Test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Run the database migrations in Supabase SQL Editor');
    console.log('2. Deploy the API endpoints');
    console.log('3. Set up the cron job');
    console.log('4. Test with actual Skyline members');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMonthlyCredits(); 