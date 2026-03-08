import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixStacySubscription() {
  const subscriptionId = 'sub_1T84DeFdjSPifIH5xBf0jHKW';
  const accountId = 'f1cb6f0d-8753-44de-a02e-c4015f46f077';

  console.log('\n🔧 Fixing Stacy\'s subscription...\n');

  try {
    // End the trial immediately by updating trial_end to now
    console.log('📋 Ending trial and activating subscription in Stripe...');
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      trial_end: 'now',
    });

    console.log('✅ Stripe subscription updated:', {
      id: subscription.id,
      status: subscription.status,
      trial_end: subscription.trial_end,
    });

    // Update the database to reflect active status
    console.log('\n💾 Updating database...');
    const { data, error } = await supabase
      .from('accounts')
      .update({
        subscription_status: subscription.status,
        subscription_start_date: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        next_renewal_date: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      })
      .eq('account_id', accountId)
      .select();

    if (error) {
      console.error('❌ Error updating database:', error);
    } else {
      console.log('✅ Database updated successfully:', data);
    }

    console.log('\n✨ Done! Stacy\'s subscription should now be active.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

fixStacySubscription().then(() => process.exit(0));
