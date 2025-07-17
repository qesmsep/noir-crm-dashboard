require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInvoicePaidWebhook() {
  console.log('🔍 Testing Invoice Paid Webhook Event...\n');

  // Real invoice.paid event data
  const event = {
    id: "evt_1RjmfYFdjSPifIH5HOcKdEjk",
    type: "invoice.paid",
    data: {
      object: {
        id: "in_1RjmfWFdjSPifIH5rL6fpm5g",
        customer: "cus_Sf6tpKJF2QkYmn",
        customer_email: "hello@skylineandco.com",
        customer_phone: "+19137774488",
        customer_name: "Tim Wirick",
        amount_paid: 100,
        currency: "usd",
        subscription: "sub_1RjmfWFdjSPifIH5BO0VqTYk",
        payment_intent: "pi_3RjmfUFdjSPifIH50GDsYQeq",
        charge: "ch_3RjmfUFdjSPifIH50Zgq8U2C",
        lines: {
          data: [
            {
              description: "1 × Noir Host Membership (at $1.00 / month)",
              amount: 100,
              price: {
                id: "price_1RMH5WFdjSPifIH5XJ1fb6fq",
                nickname: "Host Member"
              }
            }
          ]
        }
      }
    }
  };

  console.log('📋 Invoice Data:');
  console.log('  Customer ID:', event.data.object.customer);
  console.log('  Customer Email:', event.data.object.customer_email);
  console.log('  Customer Phone:', event.data.object.customer_phone);
  console.log('  Amount Paid:', `$${event.data.object.amount_paid / 100}`);
  console.log('  Subscription ID:', event.data.object.subscription);
  console.log('  Payment Intent:', event.data.object.payment_intent);

  // Step 1: Find account by Stripe customer ID
  console.log('\n1️⃣ Searching by Stripe customer ID:', event.data.object.customer);
  const { data: accountsByCustomer, error: customerSearchError } = await supabase
    .from('accounts')
    .select('account_id')
    .eq('stripe_customer_id', event.data.object.customer)
    .limit(1);

  if (customerSearchError) {
    console.error('❌ Error searching by customer ID:', customerSearchError);
    return;
  }

  let accountId = null;
  if (accountsByCustomer && accountsByCustomer.length > 0) {
    accountId = accountsByCustomer[0].account_id;
    console.log('✅ Found account by customer ID:', accountId);
  } else {
    console.log('❌ No account found by customer ID');
  }

  // Step 2: If no account found by customer ID, try by phone
  if (!accountId && event.data.object.customer_phone) {
    console.log('\n2️⃣ Searching by customer phone:', event.data.object.customer_phone);
    const { data: membersByPhone, error: phoneSearchError } = await supabase
      .from('members')
      .select('account_id')
      .eq('phone', event.data.object.customer_phone)
      .eq('member_type', 'primary')
      .limit(1);

    if (!phoneSearchError && membersByPhone && membersByPhone.length > 0) {
      accountId = membersByPhone[0].account_id;
      console.log('✅ Found account by phone:', accountId);
    } else {
      console.log('❌ No account found by phone');
    }
  }

  // Step 3: If still no account, try by email
  if (!accountId && event.data.object.customer_email) {
    console.log('\n3️⃣ Searching by customer email:', event.data.object.customer_email);
    const { data: membersByEmail, error: emailSearchError } = await supabase
      .from('members')
      .select('account_id')
      .eq('email', event.data.object.customer_email)
      .eq('member_type', 'primary')
      .limit(1);

    if (!emailSearchError && membersByEmail && membersByEmail.length > 0) {
      accountId = membersByEmail[0].account_id;
      console.log('✅ Found account by email:', accountId);
    } else {
      console.log('❌ No account found by email');
    }
  }

  if (!accountId) {
    console.log('\n❌ No account found - cannot process payment');
    return;
  }

  // Step 4: Get the primary member for this account
  console.log('\n4️⃣ Getting primary member for account:', accountId);
  const { data: primaryMember, error: memberError } = await supabase
    .from('members')
    .select('member_id, first_name, phone')
    .eq('account_id', accountId)
    .eq('member_type', 'primary')
    .limit(1)
    .single();

  if (memberError || !primaryMember) {
    console.log('❌ No primary member found for account:', accountId, memberError);
    return;
  }

  console.log('✅ Found primary member:', primaryMember.first_name);

  // Step 5: Update account with Stripe customer ID if not already set
  console.log('\n5️⃣ Updating account with Stripe customer ID...');
  const { error: upsertAccountError } = await supabase
    .from('accounts')
    .upsert({ account_id: accountId, stripe_customer_id: event.data.object.customer }, { onConflict: 'account_id' });
  
  if (upsertAccountError) {
    console.error('❌ Error upserting account:', upsertAccountError);
    return;
  }
  console.log('✅ Account updated with Stripe customer ID');

  // Step 6: Update member status to active
  console.log('\n6️⃣ Updating member status to active...');
  const { error: memberUpdateError } = await supabase
    .from('members')
    .update({ status: 'active', stripe_customer_id: event.data.object.customer })
    .eq('account_id', accountId)
    .or('status.eq.pending,status.is.null');
  
  if (memberUpdateError) {
    console.error('❌ Error updating members:', memberUpdateError);
    return;
  }
  console.log('✅ Member status updated to active');

  // Step 7: Insert ledger entry for the payment
  console.log('\n7️⃣ Creating ledger entry...');
  const paymentAmount = event.data.object.amount_paid / 100; // Stripe sends amount in cents
  const paymentDate = new Date().toISOString().split('T')[0];
  const ledgerNote = 'Noir Membership Dues - Subscription Renewal';
  
  const { data: ledgerEntry, error: ledgerError } = await supabase
    .from('ledger')
    .insert({
      member_id: primaryMember.member_id,
      account_id: accountId,
      type: 'payment',
      amount: paymentAmount,
      note: ledgerNote,
      date: paymentDate,
      stripe_payment_intent_id: event.data.object.payment_intent,
      stripe_invoice_id: event.data.object.id
    })
    .select();

  if (ledgerError) {
    console.error('❌ Error inserting ledger entry:', ledgerError);
    return;
  }
  console.log('✅ Ledger entry created:', ledgerEntry[0]);

  console.log('\n🎉 Invoice paid webhook processed successfully!');
  console.log('   Account:', accountId);
  console.log('   Member:', primaryMember.first_name);
  console.log('   Amount:', `$${paymentAmount}`);
  console.log('   Payment Intent:', event.data.object.payment_intent);
}

testInvoicePaidWebhook().catch(console.error); 