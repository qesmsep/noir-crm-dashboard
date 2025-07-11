const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWithRealWebhookData() {
  console.log('🔍 Testing with Real Webhook Data...\n');

  // Real webhook data from the event
  const session = {
    id: 'cs_live_a1J73K4HCxiGljZCMVf37Y1zXjEN6CTQKy3F4mh33GXVngdaf3rX6YmMEs',
    customer: 'cus_Sf6EurYU8KQoDI',
    client_reference_id: null, // This is null in the real event
    customer_details: {
      email: 'tim@828.life',
      phone: '+19137774488',
      name: 'Tim Wirick'
    },
    amount_total: 100 // $1.00 in cents
  };

  console.log('📋 Real Session Data:');
  console.log('  Session ID:', session.id);
  console.log('  Customer ID:', session.customer);
  console.log('  Client Reference ID:', session.client_reference_id);
  console.log('  Customer Email:', session.customer_details.email);
  console.log('  Customer Phone:', session.customer_details.phone);
  console.log('  Amount:', `$${session.amount_total / 100}\n`);

  let accountId = session.client_reference_id;
  
  // Step 1: Try to find account by phone first
  if (!accountId && session.customer_details && session.customer_details.phone) {
    console.log('1️⃣ Searching by customer phone:', session.customer_details.phone);
    
    const { data: membersByPhone, error: phoneSearchError } = await supabase
      .from('members')
      .select('account_id, member_id, first_name, last_name, status')
      .eq('phone', session.customer_details.phone)
      .eq('member_type', 'primary')
      .limit(1);
    
    if (phoneSearchError) {
      console.log('❌ Error searching by phone:', phoneSearchError.message);
    } else if (membersByPhone && membersByPhone.length > 0) {
      accountId = membersByPhone[0].account_id;
      console.log('✅ Found account by phone:', accountId);
      console.log('   Member details:', membersByPhone[0]);
    } else {
      console.log('❌ No member found with phone:', session.customer_details.phone);
    }
  }
  
  // Step 2: Try to find account by email
  if (!accountId && session.customer_details && session.customer_details.email) {
    console.log('\n2️⃣ Searching by customer email:', session.customer_details.email);
    
    const { data: membersByEmail, error: emailSearchError } = await supabase
      .from('members')
      .select('account_id, member_id, first_name, last_name, status')
      .eq('email', session.customer_details.email)
      .eq('member_type', 'primary')
      .limit(1);
    
    if (emailSearchError) {
      console.log('❌ Error searching by email:', emailSearchError.message);
    } else if (membersByEmail && membersByEmail.length > 0) {
      accountId = membersByEmail[0].account_id;
      console.log('✅ Found account by email:', accountId);
      console.log('   Member details:', membersByEmail[0]);
    } else {
      console.log('❌ No member found with email:', session.customer_details.email);
    }
  }
  
  // Step 3: If account found, test the full webhook logic
  if (accountId) {
    console.log('\n3️⃣ Testing full webhook logic with account:', accountId);
    
    // Test account upsert
    console.log('   Testing account upsert...');
    const { data: upsertData, error: upsertError } = await supabase
      .from('accounts')
      .upsert({ 
        account_id: accountId, 
        stripe_customer_id: session.customer 
      }, { 
        onConflict: 'account_id' 
      })
      .select();
    
    if (upsertError) {
      console.log('❌ Account upsert error:', upsertError.message);
    } else {
      console.log('✅ Account upsert successful:', upsertData);
    }
    
    // Test member status update
    console.log('   Testing member status update...');
    const { data: updateData, error: updateError } = await supabase
      .from('members')
      .update({ 
        status: 'active', 
        stripe_customer_id: session.customer 
      })
      .eq('account_id', accountId)
      .or('status.eq.pending,status.is.null')
      .select('member_id, first_name, last_name, status, stripe_customer_id');
    
    if (updateError) {
      console.log('❌ Member update error:', updateError.message);
    } else {
      console.log('✅ Member update successful:', updateData);
    }
    
    // Test ledger entry creation
    console.log('   Testing ledger entry creation...');
    const paymentAmount = session.amount_total / 100;
    const paymentDate = new Date().toISOString().split('T')[0];
    const ledgerNote = 'Noir Membership Dues';
    
    // Get primary member for ledger entry
    const { data: primaryMember, error: memberError } = await supabase
      .from('members')
      .select('member_id')
      .eq('account_id', accountId)
      .eq('member_type', 'primary')
      .limit(1)
      .single();
    
    if (memberError) {
      console.log('❌ Error finding primary member for ledger:', memberError.message);
    } else {
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('ledger')
        .insert({
          member_id: primaryMember.member_id,
          account_id: accountId,
          type: 'payment',
          amount: paymentAmount,
          note: ledgerNote,
          date: paymentDate
        })
        .select();
      
      if (ledgerError) {
        console.log('❌ Ledger insert error:', ledgerError.message);
      } else {
        console.log('✅ Ledger entry created:', ledgerData);
      }
    }
    
  } else {
    console.log('\n❌ No account found - webhook would be ignored');
  }
  
  console.log('\n🎉 Test completed!');
}

testWithRealWebhookData().catch(console.error); 