// /api/stripeWebhook.js

import { buffer } from 'micro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const config = {
  api: {
    bodyParser: false, // Stripe requires the raw body
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    // Handle new member signup payments
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Get the client reference ID (account_id) from the session
      const accountId = session.client_reference_id;
      
      // Ignore if no account ID
      if (!accountId) {
        return res.json({ received: true });
      }

      // Find the account
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('account_id', accountId)
        .limit(1)
        .single();

      // Ignore if no account found
      if (accountError || !account) {
        return res.json({ received: true });
      }

      // Get the primary member for this account
      const { data: primaryMember, error: memberError } = await supabase
        .from('members')
        .select('member_id')
        .eq('account_id', account.account_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (memberError || !primaryMember) {
        return res.json({ received: true });
      }

      // Update the account with the Stripe customer ID
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ stripe_customer_id: session.customer })
        .eq('account_id', account.account_id);

      if (updateError) {
        console.error('Error updating account with Stripe customer ID:', updateError);
        return res.status(500).json({ error: 'Failed to update account' });
      }

      // Add the payment to the ledger
      const { error: ledgerError } = await supabase
        .from('ledger')
        .insert({
          account_id: account.account_id,
          member_id: primaryMember.member_id,
          amount: session.amount_total / 100, // Convert from cents to dollars
          type: 'payment',
          note: 'Initial membership payment',
          date: new Date().toISOString(),
          stripe_checkout_session_id: session.id
        });

      if (ledgerError) {
        console.error('Error adding payment to ledger:', ledgerError);
        return res.status(500).json({ error: 'Failed to update ledger' });
      }

      return res.json({ success: true });
    }

    // Handle subscription renewal events
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      
      // Only process subscription invoices
      if (invoice.subscription) {
        // Get the customer ID from the invoice
        const customerId = invoice.customer;
        
        // Find the account with this Stripe customer ID
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('account_id')
          .eq('stripe_customer_id', customerId)
          .limit(1)
          .single();

        if (accountError || !account) {
          return res.json({ received: true });
        }

        // Get the primary member for this account to associate with the payment
        const { data: primaryMember, error: memberError } = await supabase
          .from('members')
          .select('member_id')
          .eq('account_id', account.account_id)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (memberError || !primaryMember) {
          return res.json({ received: true });
        }

        // Add the payment to the ledger
        const { error: ledgerError } = await supabase
          .from('ledger')
          .insert({
            account_id: account.account_id,
            member_id: primaryMember.member_id,
            amount: invoice.amount_paid / 100, // Convert from cents to dollars
            type: 'payment',
            note: `Subscription renewal payment for ${new Date(invoice.period_start * 1000).toLocaleDateString()} - ${new Date(invoice.period_end * 1000).toLocaleDateString()}`,
            date: new Date().toISOString(),
            stripe_invoice_id: invoice.id
          });

        if (ledgerError) {
          console.error('Error adding payment to ledger:', ledgerError);
          return res.status(500).json({ error: 'Failed to update ledger' });
        }

        return res.json({ success: true });
      }
    }

    // Handle manual payment events
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Get the customer ID from the payment intent
      const customerId = paymentIntent.customer;
      
      // Ignore payments without a customer ID
      if (!customerId) {
        return res.json({ received: true });
      }

      // Try to find the account with this Stripe customer ID
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('stripe_customer_id', customerId)
        .limit(1)
        .single();

      // Ignore payments from non-members
      if (accountError || !account) {
        return res.json({ received: true });
      }

      // Get the primary member for this account to associate with the payment
      const { data: primaryMember, error: memberError } = await supabase
        .from('members')
        .select('member_id')
        .eq('account_id', account.account_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (memberError || !primaryMember) {
        return res.json({ received: true });
      }

      // Add the payment to the ledger
      const { error: ledgerError } = await supabase
        .from('ledger')
        .insert({
          account_id: account.account_id,
          member_id: primaryMember.member_id,
          amount: paymentIntent.amount / 100, // Convert from cents to dollars
          type: 'payment',
          note: `Manual payment${paymentIntent.description ? `: ${paymentIntent.description}` : ''}`,
          date: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent.id
        });

      if (ledgerError) {
        console.error('Error adding payment to ledger:', ledgerError);
        return res.status(500).json({ error: 'Failed to update ledger' });
      }

      return res.json({ success: true });
    }

    // Return a 200 response for all other events
    res.json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}