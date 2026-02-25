import { buffer } from 'micro';
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const config = {
  api: {
    bodyParser: false, // Stripe requires raw body for signature verification
  },
};

/**
 * Stripe Webhook Handler for Subscription Events
 * Handles: subscription created, updated, deleted, paused, resumed
 * Updates: members table + subscription_events audit log
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔔 Stripe Subscription Webhook received');

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.log('❌ Missing Stripe signature');
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature - use dedicated subscription webhook secret
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS || process.env.STRIPE_WEBHOOK_SECRET;
    console.log('🔐 Using webhook secret:', webhookSecret ? `${webhookSecret.slice(0, 10)}...` : 'MISSING');

    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      webhookSecret!
    );

    console.log('✅ Webhook signature verified');
    console.log('📦 Event type:', event.type);
    console.log('📦 Event ID:', event.id);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Check for duplicate event (idempotency)
  console.log('🔍 Checking for duplicate event...');
  const { data: existingEvent } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single();

  if (existingEvent) {
    console.log(`⚠️ Duplicate event ${event.id}, skipping`);
    return res.json({ received: true, duplicate: true });
  }

  // Store webhook event
  console.log('💾 Storing webhook event in database...');
  const { error: insertError } = await supabase.from('stripe_webhook_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object as any,
    processed: false
  });

  if (insertError) {
    console.error('❌ Failed to store webhook event:', insertError);
  } else {
    console.log('✅ Webhook event stored');
  }

  try {
    console.log('⚙️ Processing webhook event...');
    await processWebhookEvent(event);

    // Mark as processed
    console.log('✅ Marking event as processed');
    await supabase
      .from('stripe_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);

    console.log('✅ Webhook processing complete');
    return res.json({ received: true });
  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);

    // Log error but return 200 to prevent Stripe retries
    await supabase
      .from('stripe_webhook_events')
      .update({ error_message: error.message })
      .eq('stripe_event_id', event.id);

    return res.json({ received: true, error: error.message });
  }
}

async function processWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.paused':
      await handleSubscriptionPaused(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.resumed':
      await handleSubscriptionResumed(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('📝 Handling subscription.created event');
  console.log('   Subscription ID:', subscription.id);
  console.log('   Customer ID:', subscription.customer);
  console.log('   Status:', subscription.status);

  const member = await findMemberByStripeCustomer(subscription.customer as string);
  if (!member) {
    console.error('❌ Member not found for customer:', subscription.customer);
    return;
  }

  console.log('✅ Found member:', member.member_id, member.first_name, member.last_name);

  const price = subscription.items.data[0]?.price;
  const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
  const mrr = price?.recurring?.interval === 'year' ? amount / 12 : amount;

  console.log('💰 New subscription MRR: $', mrr);

  // Get payment method details
  const paymentMethodInfo = await getPaymentMethodInfo(subscription.default_payment_method as string);

  // Update member with subscription info
  console.log('💾 Creating subscription for member...');
  const { error: updateError } = await supabase
    .from('members')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_start_date: new Date(subscription.created * 1000).toISOString(),
      next_renewal_date: (subscription as any).current_period_end
        ? new Date((subscription as any).current_period_end * 1000).toISOString()
        : null,
      monthly_dues: mrr,
      ...paymentMethodInfo,
    })
    .eq('member_id', member.member_id);

  if (updateError) {
    console.error('❌ Failed to update member:', updateError);
    throw updateError;
  } else {
    console.log('✅ Member subscription created successfully');
  }

  // Log subscription event
  console.log('📊 Logging subscription event...');
  const { error: logError } = await supabase.from('subscription_events').insert({
    member_id: member.member_id,
    event_type: 'subscribe',
    stripe_subscription_id: subscription.id,
    stripe_event_id: subscription.id,
    new_plan: price?.product as string,
    new_mrr: mrr,
    effective_date: new Date(subscription.created * 1000).toISOString(),
    metadata: { stripe_status: subscription.status }
  });

  if (logError) {
    console.error('❌ Failed to log subscription event:', logError);
  } else {
    console.log('✅ Subscription event logged');
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('📝 Handling subscription.updated event');
  console.log('   Subscription ID:', subscription.id);
  console.log('   Customer ID:', subscription.customer);
  console.log('   Status:', subscription.status);

  const member = await findMemberByStripeCustomer(subscription.customer as string);
  if (!member) {
    console.log('❌ Member not found, skipping update');
    return;
  }

  console.log('✅ Found member:', member.member_id, member.first_name, member.last_name);

  const price = subscription.items.data[0]?.price;
  const newAmount = price?.unit_amount ? price.unit_amount / 100 : 0;
  const newMrr = price?.recurring?.interval === 'year' ? newAmount / 12 : newAmount;

  const oldMrr = Number(member.monthly_dues) || 0;

  console.log('💰 Price change: $', oldMrr, '→ $', newMrr);

  // Determine event type
  let eventType: 'upgrade' | 'downgrade' | 'reactivate' | 'cancel' = 'upgrade';
  if (newMrr > oldMrr) eventType = 'upgrade';
  else if (newMrr < oldMrr) eventType = 'downgrade';
  else if (subscription.cancel_at_period_end) eventType = 'cancel';
  else if (member.subscription_status === 'canceled') eventType = 'reactivate';

  console.log('🏷️ Event type:', eventType);

  // Get payment method details if payment method changed
  const paymentMethodInfo = await getPaymentMethodInfo(subscription.default_payment_method as string);

  // Build update object
  const updateData: any = {
    stripe_subscription_id: subscription.id, // Always update subscription ID
    subscription_status: subscription.status,
    subscription_cancel_at: subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null,
    next_renewal_date: (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000).toISOString()
      : null,
    monthly_dues: newMrr,
    ...paymentMethodInfo,
  };

  // Set subscription_start_date if missing (in case subscription.created never fired)
  if (!member.subscription_start_date && subscription.created) {
    updateData.subscription_start_date = new Date(subscription.created * 1000).toISOString();
    console.log('📅 Setting missing subscription_start_date');
  }

  // Update member
  console.log('💾 Updating member record...');
  const { error: updateError } = await supabase
    .from('members')
    .update(updateData)
    .eq('member_id', member.member_id);

  if (updateError) {
    console.error('❌ Failed to update member:', updateError);
  } else {
    console.log('✅ Member updated successfully');
  }

  // Log event if significant change
  if (newMrr !== oldMrr || subscription.cancel_at_period_end) {
    console.log('📊 Logging subscription event...');
    const { error: logError } = await supabase.from('subscription_events').insert({
      member_id: member.member_id,
      event_type: eventType,
      stripe_subscription_id: subscription.id,
      previous_mrr: oldMrr,
      new_mrr: newMrr,
      effective_date: new Date().toISOString(),
      metadata: {
        cancel_at_period_end: subscription.cancel_at_period_end,
        stripe_status: subscription.status
      }
    });

    if (logError) {
      console.error('❌ Failed to log subscription event:', logError);
    } else {
      console.log('✅ Subscription event logged');
    }
  } else {
    console.log('ℹ️ No significant change, skipping event log');
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('📝 Handling subscription.deleted event');
  console.log('   Subscription ID:', subscription.id);
  console.log('   Customer ID:', subscription.customer);

  const member = await findMemberByStripeCustomer(subscription.customer as string);
  if (!member) {
    console.log('❌ Member not found, skipping delete');
    return;
  }

  console.log('✅ Found member:', member.member_id, member.first_name, member.last_name);

  const previousMrr = Number(member.monthly_dues) || 0;
  console.log('💰 Canceling subscription with MRR: $', previousMrr);

  // Clear all subscription fields
  console.log('💾 Clearing subscription data from member...');
  const { error: updateError } = await supabase
    .from('members')
    .update({
      subscription_status: 'canceled',
      subscription_canceled_at: new Date().toISOString(),
      stripe_subscription_id: null,
      subscription_start_date: null,
      subscription_cancel_at: null,
      next_renewal_date: null,
      monthly_dues: 0,
      payment_method_type: null,
      payment_method_last4: null,
      payment_method_brand: null,
    })
    .eq('member_id', member.member_id);

  if (updateError) {
    console.error('❌ Failed to update member:', updateError);
  } else {
    console.log('✅ Subscription data cleared successfully');
  }

  // Log subscription event
  console.log('📊 Logging subscription cancellation event...');
  const { error: logError } = await supabase.from('subscription_events').insert({
    member_id: member.member_id,
    event_type: 'cancel',
    stripe_subscription_id: subscription.id,
    previous_mrr: previousMrr,
    new_mrr: 0,
    effective_date: new Date().toISOString(),
  });

  if (logError) {
    console.error('❌ Failed to log subscription event:', logError);
  } else {
    console.log('✅ Subscription cancellation logged');
  }
}

async function handleSubscriptionPaused(subscription: Stripe.Subscription) {
  console.log('📝 Handling subscription.paused event');
  console.log('   Subscription ID:', subscription.id);
  console.log('   Customer ID:', subscription.customer);

  const member = await findMemberByStripeCustomer(subscription.customer as string);
  if (!member) {
    console.log('❌ Member not found, skipping pause');
    return;
  }

  console.log('✅ Found member:', member.member_id, member.first_name, member.last_name);

  const previousMrr = Number(member.monthly_dues) || 0;
  console.log('⏸️ Pausing subscription with MRR: $', previousMrr);

  // Update member
  console.log('💾 Updating member record...');
  const { error: updateError } = await supabase
    .from('members')
    .update({
      stripe_subscription_id: subscription.id, // Ensure subscription ID is set
      subscription_status: 'paused',
    })
    .eq('member_id', member.member_id);

  if (updateError) {
    console.error('❌ Failed to update member:', updateError);
  } else {
    console.log('✅ Member updated successfully');
  }

  // Log subscription event
  console.log('📊 Logging subscription pause event...');
  const { error: logError } = await supabase.from('subscription_events').insert({
    member_id: member.member_id,
    event_type: 'pause',
    stripe_subscription_id: subscription.id,
    previous_mrr: previousMrr,
    new_mrr: 0,
    effective_date: new Date().toISOString(),
  });

  if (logError) {
    console.error('❌ Failed to log subscription event:', logError);
  } else {
    console.log('✅ Subscription pause logged');
  }
}

async function handleSubscriptionResumed(subscription: Stripe.Subscription) {
  console.log('📝 Handling subscription.resumed event');
  console.log('   Subscription ID:', subscription.id);
  console.log('   Customer ID:', subscription.customer);

  const member = await findMemberByStripeCustomer(subscription.customer as string);
  if (!member) {
    console.log('❌ Member not found, skipping resume');
    return;
  }

  console.log('✅ Found member:', member.member_id, member.first_name, member.last_name);

  const price = subscription.items.data[0]?.price;
  const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
  const mrr = price?.recurring?.interval === 'year' ? amount / 12 : amount;

  console.log('▶️ Resuming subscription with MRR: $', mrr);

  // Get payment method details (may have changed)
  const paymentMethodInfo = await getPaymentMethodInfo(subscription.default_payment_method as string);

  // Update member
  console.log('💾 Updating member record...');
  const { error: updateError } = await supabase
    .from('members')
    .update({
      stripe_subscription_id: subscription.id, // Ensure subscription ID is set
      subscription_status: 'active',
      monthly_dues: mrr,
      next_renewal_date: (subscription as any).current_period_end
        ? new Date((subscription as any).current_period_end * 1000).toISOString()
        : null,
      ...paymentMethodInfo,
    })
    .eq('member_id', member.member_id);

  if (updateError) {
    console.error('❌ Failed to update member:', updateError);
  } else {
    console.log('✅ Member updated successfully');
  }

  // Log subscription event
  console.log('📊 Logging subscription resume event...');
  const { error: logError } = await supabase.from('subscription_events').insert({
    member_id: member.member_id,
    event_type: 'resume',
    stripe_subscription_id: subscription.id,
    new_mrr: mrr,
    effective_date: new Date().toISOString(),
  });

  if (logError) {
    console.error('❌ Failed to log subscription event:', logError);
  } else {
    console.log('✅ Subscription resume logged');
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('📝 Handling invoice.payment_failed event');
  console.log('   Invoice ID:', invoice.id);
  console.log('   Customer ID:', invoice.customer);
  console.log('   Amount Due:', invoice.amount_due);

  if (!invoice.subscription) {
    console.log('ℹ️ Invoice not associated with subscription, skipping');
    return;
  }

  console.log('   Subscription ID:', invoice.subscription);

  const member = await findMemberByStripeCustomer(invoice.customer as string);
  if (!member) {
    console.log('❌ Member not found, skipping payment failure update');
    return;
  }

  console.log('✅ Found member:', member.member_id, member.first_name, member.last_name);
  console.log('⚠️ Payment failed for subscription');

  // Update member status to past_due
  console.log('💾 Updating member status to past_due...');
  const { error: updateError } = await supabase
    .from('members')
    .update({ subscription_status: 'past_due' })
    .eq('member_id', member.member_id);

  if (updateError) {
    console.error('❌ Failed to update member:', updateError);
  } else {
    console.log('✅ Member status updated to past_due');
  }

  // Log subscription event
  console.log('📊 Logging payment failure event...');
  const { error: logError } = await supabase.from('subscription_events').insert({
    member_id: member.member_id,
    event_type: 'payment_failed',
    stripe_subscription_id: invoice.subscription as string,
    effective_date: new Date().toISOString(),
    metadata: { invoice_id: invoice.id, amount: invoice.amount_due }
  });

  if (logError) {
    console.error('❌ Failed to log subscription event:', logError);
  } else {
    console.log('✅ Payment failure logged');
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('📝 Handling invoice.payment_succeeded event');
  console.log('   Invoice ID:', invoice.id);
  console.log('   Customer ID:', invoice.customer);
  console.log('   Amount Paid:', invoice.amount_paid);

  if (!invoice.subscription) {
    console.log('ℹ️ Invoice not associated with subscription, skipping');
    return;
  }

  console.log('   Subscription ID:', invoice.subscription);

  const member = await findMemberByStripeCustomer(invoice.customer as string);
  if (!member) {
    console.log('❌ Member not found, skipping payment success update');
    return;
  }

  console.log('✅ Found member:', member.member_id, member.first_name, member.last_name);

  // Update subscription status to active if it was past_due
  if (member.subscription_status === 'past_due') {
    console.log('💾 Updating member status from past_due to active...');
    const { error: updateError } = await supabase
      .from('members')
      .update({ subscription_status: 'active' })
      .eq('member_id', member.member_id);

    if (updateError) {
      console.error('❌ Failed to update member:', updateError);
    } else {
      console.log('✅ Member status updated to active');
    }
  } else {
    console.log('ℹ️ Member status already active, no update needed');
  }
}

async function findMemberByStripeCustomer(customerId: string): Promise<any | null> {
  console.log('🔍 Looking up member with Stripe customer ID:', customerId);

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !data) {
    console.error(`❌ Member not found for Stripe customer: ${customerId}`, error);
    return null;
  }

  console.log(`✅ Found member: ${data.first_name} ${data.last_name} (${data.member_id})`);
  return data;
}

async function getPaymentMethodInfo(paymentMethodId: string | null | undefined): Promise<{
  payment_method_type?: string;
  payment_method_last4?: string;
  payment_method_brand?: string;
}> {
  if (!paymentMethodId) return {};

  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.type === 'card' && paymentMethod.card) {
      return {
        payment_method_type: 'card',
        payment_method_last4: paymentMethod.card.last4,
        payment_method_brand: paymentMethod.card.brand,
      };
    } else if (paymentMethod.type === 'us_bank_account' && paymentMethod.us_bank_account) {
      return {
        payment_method_type: 'us_bank_account',
        payment_method_last4: paymentMethod.us_bank_account.last4 || undefined,
        payment_method_brand: paymentMethod.us_bank_account.bank_name || undefined,
      };
    }
  } catch (error) {
    console.error('Failed to fetch payment method:', error);
  }

  return {};
}
