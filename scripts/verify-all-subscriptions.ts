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

async function verifyAllSubscriptions() {
  console.log('\n🔍 Verifying all account subscriptions before Stripe cancellation...\n');

  // Get all accounts with Stripe subscriptions
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_id, stripe_subscription_id, stripe_customer_id, subscription_status, next_billing_date, monthly_dues, payment_method_type, payment_method_last4')
    .not('stripe_subscription_id', 'is', null);

  if (error || !accounts) {
    console.error('❌ Error fetching accounts:', error);
    return;
  }

  console.log(`Found ${accounts.length} accounts with Stripe subscriptions\n`);

  const issues: any[] = [];
  const warnings: any[] = [];
  let validCount = 0;

  for (const account of accounts) {
    const accountIssues: string[] = [];
    const accountWarnings: string[] = [];

    // Check 1: Subscription status should be valid
    const validStatuses = ['active', 'trialing', 'paused', 'past_due', 'canceled'];
    if (!validStatuses.includes(account.subscription_status)) {
      accountIssues.push(`Invalid subscription_status: "${account.subscription_status}"`);
    }

    // Check 2: Monthly dues should be > 0 for active/trialing subscriptions
    if (['active', 'trialing'].includes(account.subscription_status)) {
      if (!account.monthly_dues || account.monthly_dues <= 0) {
        accountIssues.push(`Missing or invalid monthly_dues: $${account.monthly_dues}`);
      }
    }

    // Check 3: Next billing date should be set for active/trialing subscriptions
    if (['active', 'trialing'].includes(account.subscription_status)) {
      if (!account.next_billing_date) {
        accountIssues.push('Missing next_billing_date');
      }
    }

    // Check 4: Payment method should be on file
    if (['active', 'trialing'].includes(account.subscription_status)) {
      if (!account.payment_method_type || !account.payment_method_last4) {
        accountWarnings.push('No payment method on file');
      }
    }

    // Check 5: Verify against Stripe
    try {
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

      // Compare status
      if (subscription.status === 'canceled' && account.subscription_status !== 'canceled') {
        accountWarnings.push(`Stripe says "canceled" but DB says "${account.subscription_status}"`);
      }

      // Compare amounts (convert Stripe to dollars)
      let stripeAmount = 0;
      subscription.items.data.forEach(item => {
        if (item.price.unit_amount) {
          stripeAmount += (item.price.unit_amount / 100) * (item.quantity || 1);
        }
      });

      if (Math.abs(stripeAmount - (account.monthly_dues || 0)) > 0.01) {
        accountWarnings.push(`Amount mismatch: Stripe=$${stripeAmount}, DB=$${account.monthly_dues}`);
      }

    } catch (err: any) {
      if (err.message?.includes('No such subscription')) {
        accountIssues.push('Stripe subscription no longer exists');
      } else {
        accountWarnings.push(`Stripe API error: ${err.message}`);
      }
    }

    // Record issues and warnings
    if (accountIssues.length > 0) {
      issues.push({
        account_id: account.account_id,
        subscription_id: account.stripe_subscription_id,
        status: account.subscription_status,
        monthly_dues: account.monthly_dues,
        next_billing_date: account.next_billing_date,
        issues: accountIssues,
      });
    } else if (accountWarnings.length > 0) {
      warnings.push({
        account_id: account.account_id,
        subscription_id: account.stripe_subscription_id,
        status: account.subscription_status,
        warnings: accountWarnings,
      });
    } else {
      validCount++;
    }
  }

  // Print results
  console.log('\n📊 VERIFICATION RESULTS:\n');
  console.log(`✅ Valid accounts: ${validCount}`);
  console.log(`⚠️  Accounts with warnings: ${warnings.length}`);
  console.log(`❌ Accounts with issues: ${issues.length}`);
  console.log('');

  if (issues.length > 0) {
    console.log('\n❌ CRITICAL ISSUES (must fix before canceling Stripe):\n');
    issues.forEach((issue, index) => {
      console.log(`[${index + 1}] Account: ${issue.account_id}`);
      console.log(`    Subscription: ${issue.subscription_id}`);
      console.log(`    Status: ${issue.status}`);
      console.log(`    Monthly Dues: $${issue.monthly_dues}`);
      console.log(`    Next Billing: ${issue.next_billing_date}`);
      console.log(`    Issues:`);
      issue.issues.forEach((i: string) => console.log(`      - ${i}`));
      console.log('');
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (review before canceling Stripe):\n');
    warnings.forEach((warning, index) => {
      console.log(`[${index + 1}] Account: ${warning.account_id}`);
      console.log(`    Subscription: ${warning.subscription_id}`);
      console.log(`    Status: ${warning.status}`);
      console.log(`    Warnings:`);
      warning.warnings.forEach((w: string) => console.log(`      - ${w}`));
      console.log('');
    });
  }

  // Summary
  console.log('\n📋 SUMMARY:\n');
  if (issues.length === 0) {
    console.log('✅ All accounts have valid subscription data');
    console.log('✅ Safe to proceed with Stripe subscription cancellation');
    if (warnings.length > 0) {
      console.log(`⚠️  Note: ${warnings.length} accounts have warnings - review them first`);
    }
  } else {
    console.log(`❌ ${issues.length} accounts have critical issues`);
    console.log('❌ DO NOT cancel Stripe subscriptions until issues are fixed');
  }
  console.log('');
}

verifyAllSubscriptions().then(() => process.exit(0));
