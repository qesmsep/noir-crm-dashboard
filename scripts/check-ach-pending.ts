import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-12-18.acacia',
});

async function checkACH() {
  console.log('🔍 Checking ACH pending transactions...');
  console.log('');

  const achAccounts = [
    '0b873687-bebf-4e02-8f1f-7290b7542b7d', // Rodney Thomas
    '1867b499-cb8c-4544-ba24-fd4640f46d54', // Ka'Von Johnson
  ];

  for (const accountId of achAccounts) {
    const { data: account } = await supabase
      .from('accounts')
      .select('*')
      .eq('account_id', accountId)
      .single();

    if (!account) continue;

    const { data: member } = await supabase
      .from('members')
      .select('first_name, last_name, member_id')
      .eq('account_id', accountId)
      .eq('member_type', 'primary')
      .single();

    console.log('Account:', member?.first_name, member?.last_name);
    console.log('  ID:', accountId);
    console.log('  Status:', account.subscription_status);
    console.log('  Last billing:', account.last_billing_attempt);

    // Get payment intent from Stripe
    const charges = await stripe.charges.list({
      customer: account.stripe_customer_id,
      limit: 10,
    });

    const billingDate = new Date(account.last_billing_attempt).toISOString().split('T')[0];
    const achCharge = charges.data.find(c => {
      const chargeDate = new Date(c.created * 1000).toISOString().split('T')[0];
      return chargeDate === billingDate;
    });

    if (achCharge) {
      console.log('  Stripe charge:', achCharge.id);
      console.log('    Status:', achCharge.status);
      console.log('    Amount: $' + (achCharge.amount / 100));
      console.log('    Payment Intent:', achCharge.payment_intent);
      console.log('    Payment method:', achCharge.payment_method_details?.type);

      // Get the payment intent for more details
      if (achCharge.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(achCharge.payment_intent as string);
        console.log('  Payment Intent details:');
        console.log('    Status:', pi.status);
        console.log('    Created:', new Date(pi.created * 1000).toISOString());
      }
    } else {
      console.log('  ℹ️  No charge found for billing date');
    }

    // Check ledger
    const { data: ledger } = await supabase
      .from('ledger')
      .select('*')
      .eq('account_id', accountId)
      .eq('date', billingDate);

    console.log('  Ledger entries on', billingDate, ':', ledger?.length || 0);
    if (ledger && ledger.length > 0) {
      ledger.forEach(e => {
        console.log('    -', e.type, '$' + e.amount, e.note);
      });
    }

    console.log('');
  }
}

checkACH();
