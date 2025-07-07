const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPdfGenerationOnly() {
  console.log('🧪 Testing PDF Generation (No Storage)...\n');

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

    // 3. Test the PDF generation directly
    console.log('\n3. Testing PDF generation...');
    
    // Import the PDF generator
    const { LedgerPdfGenerator } = require('./src/utils/ledgerPdfGenerator');
    
    const pdfGenerator = new LedgerPdfGenerator();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();

    console.log(`   Generating PDF for period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    const pdfBuffer = await pdfGenerator.generateLedgerPdf(
      testMember.member_id, 
      testMember.account_id, 
      startDate.toISOString().split('T')[0], 
      endDate.toISOString().split('T')[0]
    );

    console.log(`✅ PDF generated successfully!`);
    console.log(`   PDF size: ${pdfBuffer.length} bytes`);
    console.log(`   PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // 4. Test SMS sending (without PDF)
    console.log('\n4. Testing SMS sending...');
    const message = `Hi ${testMember.first_name}, here's your ledger for ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}: [PDF would be attached here]`;
    
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [testMember.phone],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: message
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`SMS API error: ${errorData.message || response.statusText}`);
    }

    const smsResult = await response.json();
    console.log('✅ SMS sent successfully!');
    console.log(`   SMS ID: ${smsResult.id}`);

    console.log('\n🎉 PDF Generation Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('- Member data: ✅');
    console.log('- Ledger data: ✅');
    console.log('- PDF generation: ✅');
    console.log('- SMS sending: ✅');
    console.log('\n🚀 The core functionality is working correctly!');
    console.log('\n💡 Note: Storage upload needs to be configured in Supabase dashboard');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPdfGenerationOnly(); 