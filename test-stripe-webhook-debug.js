const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testStripeWebhook() {
  console.log('🔍 Testing Stripe Webhook Logic Step by Step...\n');

  // Test data - simulate a real Stripe checkout session
  const testSession = {
    id: 'cs_test_' + Math.random().toString(36).substr(2, 9),
    customer: 'cus_test_' + Math.random().toString(36).substr(2, 9),
    client_reference_id: '0d22b3f2-b9a6-4627-83a1-46b2cd03b649', // Use a real account_id from your DB
    amount_total: 10000 // $100.00 in cents
  };

  console.log('📋 Test Session Data:');
  console.log('  Session ID:', testSession.id);
  console.log('  Customer ID:', testSession.customer);
  console.log('  Account ID:', testSession.client_reference_id);
  console.log('  Amount:', `$${testSession.amount_total / 100}\n`);

  try {
    // Step 1: Check if account_id exists
    console.log('1️⃣ Checking if account_id exists in members table...');
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('member_id, first_name, last_name, member_type, status, account_id')
      .eq('account_id', testSession.client_reference_id);

    if (membersError) {
      console.log('❌ Error querying members:', membersError.message);
      return;
    }

    console.log(`✅ Found ${members.length} members for account_id:`, testSession.client_reference_id);
    members.forEach((member, index) => {
      console.log(`   Member ${index + 1}:`, {
        member_id: member.member_id,
        name: `${member.first_name} ${member.last_name}`,
        type: member.member_type,
        status: member.status
      });
    });

    // Step 2: Find primary member
    console.log('\n2️⃣ Finding primary member...');
    const primaryMember = members.find(m => m.member_type === 'primary');
    
    if (!primaryMember) {
      console.log('❌ No primary member found!');
      return;
    }

    console.log('✅ Primary member found:', {
      member_id: primaryMember.member_id,
      name: `${primaryMember.first_name} ${primaryMember.last_name}`,
      status: primaryMember.status
    });

    // Step 3: Test account upsert
    console.log('\n3️⃣ Testing account upsert...');
    const { data: upsertData, error: upsertError } = await supabase
      .from('accounts')
      .upsert({ 
        account_id: testSession.client_reference_id, 
        stripe_customer_id: testSession.customer 
      }, { 
        onConflict: 'account_id' 
      })
      .select();

    if (upsertError) {
      console.log('❌ Account upsert error:', upsertError.message);
      return;
    }

    console.log('✅ Account upsert successful:', upsertData);

    // Step 4: Test member status update
    console.log('\n4️⃣ Testing member status update...');
    const { data: updateData, error: updateError } = await supabase
      .from('members')
      .update({ 
        status: 'active', 
        stripe_customer_id: testSession.customer 
      })
      .eq('account_id', testSession.client_reference_id)
      .or('status.eq.pending,status.is.null')
      .select('member_id, first_name, last_name, status, stripe_customer_id');

    if (updateError) {
      console.log('❌ Member update error:', updateError.message);
      return;
    }

    console.log('✅ Member update successful:', updateData);

    // Step 5: Test ledger entry creation
    console.log('\n5️⃣ Testing ledger entry creation...');
    const paymentAmount = testSession.amount_total / 100;
    const paymentDate = new Date().toISOString().split('T')[0];
    const ledgerNote = 'Noir Membership Dues';

    const { data: ledgerData, error: ledgerError } = await supabase
      .from('ledger')
      .insert({
        member_id: primaryMember.member_id,
        account_id: testSession.client_reference_id,
        type: 'payment',
        amount: paymentAmount,
        note: ledgerNote,
        date: paymentDate
      })
      .select();

    if (ledgerError) {
      console.log('❌ Ledger insert error:', ledgerError.message);
      return;
    }

    console.log('✅ Ledger entry created:', ledgerData);

    // Step 6: Verify final state
    console.log('\n6️⃣ Verifying final state...');
    
    // Check accounts table
    const { data: finalAccount, error: accountCheckError } = await supabase
      .from('accounts')
      .select('*')
      .eq('account_id', testSession.client_reference_id)
      .single();

    if (accountCheckError) {
      console.log('❌ Error checking final account state:', accountCheckError.message);
    } else {
      console.log('✅ Final account state:', finalAccount);
    }

    // Check members table
    const { data: finalMembers, error: membersCheckError } = await supabase
      .from('members')
      .select('member_id, first_name, last_name, status, stripe_customer_id')
      .eq('account_id', testSession.client_reference_id);

    if (membersCheckError) {
      console.log('❌ Error checking final members state:', membersCheckError.message);
    } else {
      console.log('✅ Final members state:', finalMembers);
    }

    // Check ledger table
    const { data: finalLedger, error: ledgerCheckError } = await supabase
      .from('ledger')
      .select('*')
      .eq('account_id', testSession.client_reference_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (ledgerCheckError) {
      console.log('❌ Error checking final ledger state:', ledgerCheckError.message);
    } else {
      console.log('✅ Final ledger state:', finalLedger);
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testStripeWebhook(); 