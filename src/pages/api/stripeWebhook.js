// /api/stripeWebhook.js

import { buffer } from 'micro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('Received Stripe webhook event:', event.type);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    // Handle new member signup payments
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const debugInfo = {
        eventType: event.type,
        sessionId: session.id,
        customerId: session.customer,
        clientReferenceId: session.client_reference_id,
        amount: session.amount_total
      };
      console.log('Processing checkout.session.completed:', debugInfo);
      
      // Get the client reference ID (account_id) from the session
      const accountId = session.client_reference_id;
      
      // Ignore if no account ID
      if (!accountId) {
        console.log('No account ID found in session');
        return res.json({ received: true, debug: { ...debugInfo, error: 'No account ID found' } });
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
        console.log('No account found for ID:', accountId, accountError);
        return res.json({ received: true, debug: { ...debugInfo, error: 'No account found', accountError } });
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
        console.log('No primary member found for account:', accountId, memberError);
        return res.json({ received: true, debug: { ...debugInfo, error: 'No primary member found', memberError } });
      }

      // Update the account with the Stripe customer ID
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ stripe_customer_id: session.customer })
        .eq('account_id', account.account_id);

      if (updateError) {
        console.error('Error updating account with Stripe customer ID:', updateError);
        return res.status(500).json({ error: 'Failed to update account', debug: { ...debugInfo, updateError } });
      }

      // Update all members for this account: set status to 'active' and set stripe_customer_id if not already set
      const { error: memberUpdateError } = await supabase
        .from('members')
        .update({ status: 'active', stripe_customer_id: session.customer })
        .eq('account_id', account.account_id)
        .or('status.eq.pending,status.is.null');

      if (memberUpdateError) {
        console.error('Error updating members to active:', memberUpdateError);
        return res.status(500).json({ error: 'Failed to update members', debug: { ...debugInfo, memberUpdateError } });
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
        return res.status(500).json({ error: 'Failed to update ledger', debug: { ...debugInfo, ledgerError } });
      }

      // Send welcome SMS to the primary member
      try {
        const { data: memberForSMS, error: smsMemberError } = await supabase
          .from('members')
          .select('first_name, phone')
          .eq('member_id', primaryMember.member_id)
          .single();

        if (!smsMemberError && memberForSMS && memberForSMS.phone) {
          const welcomeMessage = `Welcome to Noir, ${memberForSMS.first_name}! We're excited to have you as a member. We will be in touch very soon with more information, and please reach out to this number with any questions. Thank you.`;
          
          // Send SMS using OpenPhone API
          const smsResponse = await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              to: [memberForSMS.phone],
              from: process.env.OPENPHONE_PHONE_NUMBER_ID,
              content: welcomeMessage
            })
          });

          if (smsResponse.ok) {
            console.log('Welcome SMS sent successfully to:', memberForSMS.phone);
          } else {
            console.error('Failed to send welcome SMS:', await smsResponse.text());
          }
        }
      } catch (smsError) {
        console.error('Error sending welcome SMS:', smsError);
        // Don't fail the webhook if SMS fails
      }

      console.log('Successfully processed payment for account:', accountId);
      return res.json({ success: true, debug: debugInfo });
    }

    // Handle subscription renewal events
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      console.log('Processing invoice.paid:', {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        amount: invoice.amount_paid
      });
      
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
          console.log('No account found for customer ID:', customerId, accountError);
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
          console.log('No primary member found for account:', account.account_id, memberError);
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

        console.log('Successfully processed subscription renewal for account:', account.account_id);
        return res.json({ success: true });
      }
    }

    // Handle manual payment events
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      console.log('Processing payment_intent.succeeded:', {
        paymentIntentId: paymentIntent.id,
        customerId: paymentIntent.customer,
        amount: paymentIntent.amount
      });
      
      // Get the customer ID from the payment intent
      const customerId = paymentIntent.customer;
      
      // Ignore payments without a customer ID
      if (!customerId) {
        console.log('No customer ID found in payment intent');
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
        console.log('No account found for customer ID:', customerId, accountError);
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
        console.log('No primary member found for account:', account.account_id, memberError);
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

      console.log('Successfully processed manual payment for account:', account.account_id);
      return res.json({ success: true });
    }

    // Return a 200 response for all other events
    console.log('Received unhandled event type:', event.type);
    res.json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}