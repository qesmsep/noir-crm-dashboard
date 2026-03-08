import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

async function deleteAccount() {
  const accountId = '173c39ba-4d82-4764-8f5c-e8d11c620a55';

  console.log('\n🗑️  Deleting account 173c39ba-4d82-4764-8f5c-e8d11c620a55...\n');

  // Get account details first
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (!account) {
    console.log('❌ Account not found');
    return;
  }

  console.log('📋 Account to delete:');
  console.log(`   Account ID: ${account.account_id}`);
  console.log(`   Stripe Customer: ${account.stripe_customer_id}`);
  console.log(`   Stripe Subscription: ${account.stripe_subscription_id}`);
  console.log(`   Status: ${account.subscription_status}`);
  console.log('');

  // Check for members
  const { data: members } = await supabase
    .from('members')
    .select('member_id, first_name, last_name')
    .eq('account_id', accountId);

  if (members && members.length > 0) {
    console.log('⚠️  Found members on this account:');
    members.forEach(m => {
      console.log(`   - ${m.first_name} ${m.last_name} (${m.member_id})`);
    });
    console.log('   Deleting members first...');

    // Delete members
    const { error: memberDeleteError } = await supabase
      .from('members')
      .delete()
      .eq('account_id', accountId);

    if (memberDeleteError) {
      console.error('❌ Error deleting members:', memberDeleteError);
      return;
    }
    console.log('✅ Members deleted');
    console.log('');
  } else {
    console.log('✅ No members found on account');
    console.log('');
  }

  // Cancel Stripe subscription if exists
  if (account.stripe_subscription_id) {
    try {
      console.log('🔧 Canceling Stripe subscription...');
      await stripe.subscriptions.cancel(account.stripe_subscription_id);
      console.log('✅ Stripe subscription canceled');
    } catch (err: any) {
      if (err.message?.includes('No such subscription')) {
        console.log('⚠️  Stripe subscription already deleted');
      } else {
        console.error('❌ Error canceling Stripe subscription:', err.message);
      }
    }
    console.log('');
  }

  // Delete subscription_events first
  console.log('🔧 Deleting subscription events...');
  const { error: eventsDeleteError } = await supabase
    .from('subscription_events')
    .delete()
    .eq('account_id', accountId);

  if (eventsDeleteError) {
    console.error('❌ Error deleting subscription events:', eventsDeleteError);
    // Continue anyway
  } else {
    console.log('✅ Subscription events deleted');
  }
  console.log('');

  // Delete ledger entries
  console.log('🔧 Deleting ledger entries...');
  const { error: ledgerDeleteError } = await supabase
    .from('ledger')
    .delete()
    .eq('account_id', accountId);

  if (ledgerDeleteError) {
    console.error('❌ Error deleting ledger entries:', ledgerDeleteError);
    // Continue anyway
  } else {
    console.log('✅ Ledger entries deleted');
  }
  console.log('');

  // Delete the account
  const { error: accountDeleteError } = await supabase
    .from('accounts')
    .delete()
    .eq('account_id', accountId);

  if (accountDeleteError) {
    console.error('❌ Error deleting account:', accountDeleteError);
    return;
  }

  console.log('✅ Account deleted successfully');
  console.log('');
}

deleteAccount().then(() => process.exit(0));
