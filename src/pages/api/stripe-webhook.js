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

// Helper function to check if a ledger entry already exists
async function checkExistingLedgerEntry(stripeInvoiceId, stripePaymentIntentId) {
  if (stripeInvoiceId) {
    const { data: existingInvoice } = await supabase
      .from('ledger')
      .select('id')
      .eq('stripe_invoice_id', stripeInvoiceId)
      .single();
    if (existingInvoice) return true;
  }
  
  if (stripePaymentIntentId) {
    const { data: existingPaymentIntent } = await supabase
      .from('ledger')
      .select('id')
      .eq('stripe_payment_intent_id', stripePaymentIntentId)
      .single();
    if (existingPaymentIntent) return true;
  }
  
  return false;
}

// Helper function to check for duplicate payments by customer, amount, and date
async function checkDuplicatePayment(accountId, amount, date) {
  const { data: existingPayment } = await supabase
    .from('ledger')
    .select('id')
    .eq('account_id', accountId)
    .eq('amount', amount)
    .eq('type', 'payment')
    .eq('date', date)
    .limit(1)
    .single();
  
  return !!existingPayment;
}

// Helper function to format subscription renewal description
function formatSubscriptionDescription(invoice) {
  // The invoice period represents the period that was just paid for
  // We want to show the renewal period going forward from the payment date
  const paymentDate = new Date();
  const renewalStartDate = new Date(paymentDate);
  const renewalEndDate = new Date(paymentDate);
  
  // Set the renewal end date to one month from the payment date
  renewalEndDate.setMonth(renewalEndDate.getMonth() + 1);
  
  // Format dates to show month and day (e.g., "Jul 29 - Aug 28")
  const startFormatted = renewalStartDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  const endFormatted = renewalEndDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  return `Noir Subscription Renewal for ${startFormatted} - ${endFormatted}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Debug: Log all headers to see what we're receiving
  console.log('Webhook headers:', Object.keys(req.headers));
  console.log('Stripe signature header:', req.headers['stripe-signature']);
  console.log('Content type:', req.headers['content-type']);
  console.log('All headers:', req.headers);

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    const buf = await buffer(req);
    console.log('Raw body length:', buf.length);
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('Received Stripe webhook event:', event.type);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    console.error('Full error:', err);
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
        customerEmail: session.customer_details?.email,
        customerPhone: session.customer_details?.phone,
        amount: session.amount_total
      };
      console.log('Processing checkout.session.completed:', debugInfo);
      
      // Get the client reference ID (account_id) from the session
      let accountId = session.client_reference_id;
      
      // If no client_reference_id (e.g., payment via payment link), try to find account by customer phone first
      if (!accountId && session.customer_details && session.customer_details.phone) {
        console.log('No client_reference_id found, searching by customer phone:', session.customer_details.phone);
        
        // Find members with this phone
        const { data: membersByPhone, error: phoneSearchError } = await supabase
          .from('members')
          .select('account_id')
          .eq('phone', session.customer_details.phone)
          .eq('member_type', 'primary')
          .limit(1);
        
        if (!phoneSearchError && membersByPhone && membersByPhone.length > 0) {
          accountId = membersByPhone[0].account_id;
          console.log('Found account by phone:', accountId);
        }
      }
      
      // If still no account ID, try to find by customer email
      if (!accountId && session.customer_details && session.customer_details.email) {
        console.log('No account found by phone, searching by customer email:', session.customer_details.email);
        
        // Find members with this email
        const { data: membersByEmail, error: emailSearchError } = await supabase
          .from('members')
          .select('account_id')
          .eq('email', session.customer_details.email)
          .eq('member_type', 'primary')
          .limit(1);
        
        if (!emailSearchError && membersByEmail && membersByEmail.length > 0) {
          accountId = membersByEmail[0].account_id;
          console.log('Found account by email:', accountId);
        }
      }
      
      // Ignore if no account ID found
      if (!accountId) {
        console.log('No account ID found in session or by customer details');
        return res.json({ received: true, debug: { ...debugInfo, error: 'No account ID found' } });
      }

      // Get the primary member for this account
      const { data: primaryMember, error: memberError } = await supabase
        .from('members')
        .select('member_id, first_name, phone')
        .eq('account_id', accountId)
        .eq('member_type', 'primary')
        .limit(1)
        .single();

      if (memberError || !primaryMember) {
        console.log('No primary member found for account:', accountId, memberError);
        return res.json({ received: true, debug: { ...debugInfo, error: 'No primary member found', memberError } });
      }

      // Upsert the account with the Stripe customer ID
      const { error: upsertAccountError } = await supabase
        .from('accounts')
        .upsert({ account_id: accountId, stripe_customer_id: session.customer }, { onConflict: 'account_id' });
      if (upsertAccountError) {
        console.error('Error upserting account with Stripe customer ID:', upsertAccountError);
        return res.status(500).json({ error: 'Failed to upsert account', debug: { ...debugInfo, upsertAccountError } });
      }

      // Update all members for this account: set status to 'active' and set stripe_customer_id
      const { error: memberUpdateError } = await supabase
        .from('members')
        .update({ status: 'active', stripe_customer_id: session.customer })
        .eq('account_id', accountId)
        .or('status.eq.pending,status.is.null');
      if (memberUpdateError) {
        console.error('Error updating members to active:', memberUpdateError);
        return res.status(500).json({ error: 'Failed to update members', debug: { ...debugInfo, memberUpdateError } });
      }

      // Check if ledger entry already exists for this payment intent
      const paymentIntentId = session.payment_intent;
      if (paymentIntentId) {
        const exists = await checkExistingLedgerEntry(null, paymentIntentId);
        if (exists) {
          console.log('Ledger entry already exists for payment intent:', paymentIntentId);
          return res.json({ success: true, debug: { ...debugInfo, message: 'Ledger entry already exists' } });
        }
      }

      // Insert a ledger entry for the payment
      const paymentAmount = session.amount_total / 100; // Stripe sends amount in cents
      const paymentDate = new Date().toISOString().split('T')[0];
      const ledgerNote = 'Noir Membership Dues';
      const { error: ledgerError } = await supabase
        .from('ledger')
        .insert({
          member_id: primaryMember.member_id,
          account_id: accountId,
          type: 'payment',
          amount: paymentAmount,
          note: ledgerNote,
          date: paymentDate,
          stripe_payment_intent_id: paymentIntentId
        });
      if (ledgerError) {
        console.error('Error inserting ledger entry:', ledgerError);
        return res.status(500).json({ error: 'Failed to insert ledger entry', debug: { ...debugInfo, ledgerError } });
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
        // Check if ledger entry already exists for this invoice
        const exists = await checkExistingLedgerEntry(invoice.id, null);
        if (exists) {
          console.log('Ledger entry already exists for invoice:', invoice.id);
          return res.json({ success: true, message: 'Ledger entry already exists' });
        }

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

        // Check for duplicate payment by amount and date
        const paymentAmount = invoice.amount_paid / 100;
        const paymentDate = new Date().toISOString().split('T')[0];
        const duplicateExists = await checkDuplicatePayment(account.account_id, paymentAmount, paymentDate);
        if (duplicateExists) {
          console.log('Duplicate payment detected for account:', account.account_id, 'amount:', paymentAmount, 'date:', paymentDate);
          return res.json({ success: true, message: 'Duplicate payment detected' });
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

        // Add the payment to the ledger with updated description format
        const { error: ledgerError } = await supabase
          .from('ledger')
          .insert({
            account_id: account.account_id,
            member_id: primaryMember.member_id,
            amount: invoice.amount_paid / 100, // Convert from cents to dollars
            type: 'payment',
            note: formatSubscriptionDescription(invoice),
            date: paymentDate,
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
      
      // Check if ledger entry already exists for this payment intent
      const exists = await checkExistingLedgerEntry(null, paymentIntent.id);
      if (exists) {
        console.log('Ledger entry already exists for payment intent:', paymentIntent.id);
        return res.json({ success: true, message: 'Ledger entry already exists' });
      }
      
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

      // Check for duplicate payment by amount and date
      const paymentAmount = paymentIntent.amount / 100;
      const paymentDate = new Date().toISOString().split('T')[0];
      const duplicateExists = await checkDuplicatePayment(account.account_id, paymentAmount, paymentDate);
      if (duplicateExists) {
        console.log('Duplicate payment detected for account:', account.account_id, 'amount:', paymentAmount, 'date:', paymentDate);
        return res.json({ success: true, message: 'Duplicate payment detected' });
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
          date: paymentDate,
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