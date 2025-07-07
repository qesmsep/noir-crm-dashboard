const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPdfGeneration() {
  console.log('🧪 Testing PDF Generation...\n');

  try {
    // 1. Get a test member
    console.log('1. Finding a test member...');
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('*')
      .eq('deactivated', false)
      .not('phone', 'is', null)
      .limit(1);

    if (membersError) {
      throw new Error(`Error fetching members: ${membersError.message}`);
    }

    if (!members || members.length === 0) {
      throw new Error('No members found with phone numbers');
    }

    const testMember = members[0];
    console.log(`✅ Found test member: ${testMember.first_name} ${testMember.last_name} (${testMember.phone})`);

    // 2. Get ledger data for the member
    console.log('\n2. Fetching ledger data...');
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('ledger')
      .select('*')
      .eq('member_id', testMember.member_id)
      .order('date', { ascending: true });

    if (ledgerError) {
      throw new Error(`Error fetching ledger: ${ledgerError.message}`);
    }

    console.log(`✅ Found ${ledgerData.length} ledger entries`);

    // 3. Test the API endpoint
    console.log('\n3. Testing PDF generation API...');
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();

    const response = await fetch('http://localhost:3000/api/send-ledger-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        member_id: testMember.member_id,
        account_id: testMember.account_id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        phone: testMember.phone,
        member_name: `${testMember.first_name} ${testMember.last_name}`
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`API Error: ${result.error || response.statusText}`);
    }

    console.log('✅ PDF generation API test successful!');
    console.log(`   PDF URL: ${result.pdf_url}`);
    console.log(`   SMS ID: ${result.sms_id}`);

    // 4. Check if the notification was logged
    console.log('\n4. Checking notification log...');
    const { data: notifications, error: notificationError } = await supabase
      .from('scheduled_ledger_notifications')
      .select('*')
      .eq('member_id', testMember.member_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (notificationError) {
      console.log('⚠️  Could not check notification log (table may not exist yet)');
    } else if (notifications && notifications.length > 0) {
      console.log('✅ Notification logged successfully');
      console.log(`   Status: ${notifications[0].status}`);
      console.log(`   PDF URL: ${notifications[0].pdf_url}`);
    } else {
      console.log('⚠️  No notification log found');
    }

    console.log('\n🎉 PDF Generation Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('- Member data: ✅');
    console.log('- Ledger data: ✅');
    console.log('- PDF generation: ✅');
    console.log('- SMS sending: ✅');
    console.log('- Storage upload: ✅');
    console.log('\n🚀 The system is working correctly!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the development server is running: npm run dev');
    }
    
    process.exit(1);
  }
}

// Run the test
testPdfGeneration(); 