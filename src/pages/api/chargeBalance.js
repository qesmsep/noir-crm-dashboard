// api/chargeBalance.js

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, custom_amount, custom_description, custom_date } = req.body;
  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  // 1) Fetch stripe_customer_id and credit_card_fee_enabled from accounts
  const { data: acct, error: acctErr } = await supabase
    .from('accounts')
    .select('stripe_customer_id, credit_card_fee_enabled')
    .eq('account_id', account_id)
    .single();
  if (acctErr || !acct || !acct.stripe_customer_id) {
    return res.status(400).json({ error: 'Stripe customer not found for account' });
  }
  const stripe_customer_id = acct.stripe_customer_id;
  const credit_card_fee_enabled = acct.credit_card_fee_enabled || false;

  // 2) Get the primary member_id for this account
  const { data: primaryMember, error: pmErr } = await supabase
    .from('members')
    .select('member_id')
    .eq('account_id', account_id)
    .eq('member_type', 'primary')
    .single();
  if (pmErr || !primaryMember || !primaryMember.member_id) {
    return res.status(400).json({ error: 'Primary member not found for account' });
  }
  const member_id = primaryMember.member_id;

  // 3) Determine a default payment method:
  let defaultPaymentMethodId = null;
  // 3a) Try invoice_settings.default_payment_method
  try {
    const stripeCustomer = await stripe.customers.retrieve(stripe_customer_id);
    defaultPaymentMethodId = stripeCustomer.invoice_settings.default_payment_method;
  } catch (err) {
    console.error('Error retrieving Stripe customer:', err);
  }
  // 3b) If still none, check active subscription
  if (!defaultPaymentMethodId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: stripe_customer_id,
        status: 'active',
        limit: 1,
      });
      if (subs.data.length > 0) {
        const sub = subs.data[0];
        defaultPaymentMethodId = sub.default_payment_method || sub.default_source || null;
      }
    } catch (err) {
      console.error('Error listing subscriptions:', err);
    }
  }
  // 3c) If still none, list attached payment methods (cards or bank accounts)
  if (!defaultPaymentMethodId) {
    try {
      // Try cards first
      const cardList = await stripe.paymentMethods.list({
        customer: stripe_customer_id,
        type: 'card',
        limit: 1,
      });
      if (cardList.data.length > 0) {
        defaultPaymentMethodId = cardList.data[0].id;
      } else {
        // Try bank accounts if no cards
        const bankList = await stripe.paymentMethods.list({
          customer: stripe_customer_id,
          type: 'us_bank_account',
          limit: 1,
        });
        if (bankList.data.length > 0) {
          defaultPaymentMethodId = bankList.data[0].id;
        }
      }
    } catch (err) {
      console.error('Error listing payment methods:', err);
    }
  }
  if (!defaultPaymentMethodId) {
    return res.status(400).json({ error: 'No default payment method found' });
  }

  // 4) Determine amount to charge
  let baseAmount; // in cents
  let chargeDescription;

  if (custom_amount && Number(custom_amount) > 0) {
    // Use custom amount for one-off charge
    baseAmount = Math.round(Number(custom_amount) * 100);
    chargeDescription = custom_description || 'Custom charge';
  } else {
    // Use existing balance logic
    const { data: ledgerRows, error: ledgerErr } = await supabase
      .from('ledger')
      .select('amount')
      .eq('account_id', account_id);
    if (ledgerErr) {
      return res.status(500).json({ error: ledgerErr.message });
    }
    const balance = (ledgerRows || []).reduce((sum, t) => sum + Number(t.amount), 0);
    if (balance >= 0) {
      return res.status(400).json({ error: 'No outstanding balance' });
    }
    baseAmount = Math.round(Math.abs(balance) * 100);
    chargeDescription = 'Balance charged via Stripe';
  }

  // 4b) Check payment method type and calculate credit card fee
  let creditCardFee = 0;
  let isCard = false;

  if (credit_card_fee_enabled) {
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId);
      isCard = paymentMethod.type === 'card';

      if (isCard) {
        // Apply 4% credit card processing fee
        creditCardFee = Math.round(baseAmount * 0.04);
        console.log(`Applying 4% credit card fee: $${(creditCardFee / 100).toFixed(2)} to base amount: $${(baseAmount / 100).toFixed(2)}`);
      }
    } catch (err) {
      console.error('Error retrieving payment method type:', err);
      // If we can't determine the type, proceed without fee
    }
  }

  const amountToCharge = baseAmount + creditCardFee;

  // 4c) Get full payment method details to check type
  let paymentMethod;
  try {
    paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId);
  } catch (err) {
    console.error('Error retrieving payment method:', err);
    return res.status(400).json({ error: 'Failed to retrieve payment method' });
  }

  // 5) Create & confirm a PaymentIntent
  let intent;
  try {
    const paymentIntentParams = {
      amount: amountToCharge,
      currency: 'usd',
      customer: stripe_customer_id,
      payment_method: defaultPaymentMethodId,
      payment_method_types: ['card', 'us_bank_account'], // Allow both cards and ACH
      confirm: true,
      description: chargeDescription,
      expand: ['charges'],
    };

    // For ACH payments, provide mandate data and remove off_session
    if (paymentMethod.type === 'us_bank_account') {
      // Provide mandate acceptance data
      paymentIntentParams.mandate_data = {
        customer_acceptance: {
          type: 'online',
          online: {
            ip_address: '0.0.0.0', // Server-initiated payment
            user_agent: 'Noir Membership Billing System',
          },
        },
      };
    } else {
      // For cards, use off_session
      paymentIntentParams.off_session = true;
    }

    intent = await stripe.paymentIntents.create(paymentIntentParams);
  } catch (err) {
    console.error('Stripe charge failed:', err);
    return res.status(500).json({ error: 'Stripe charge failed', details: err.message });
  }

  // 6) Log payment in ledger (include both account_id and member_id)
  const transactionDate = custom_date || new Date().toISOString().split('T')[0];
  const baseAmountDollars = baseAmount / 100;
  const creditCardFeeDollars = creditCardFee / 100;

  // Check for duplicate payment by payment intent ID first
  const { data: existingPayment } = await supabase
    .from('ledger')
    .select('id')
    .eq('stripe_payment_intent_id', intent.id)
    .limit(1)
    .single();

  if (existingPayment) {
    console.log('Duplicate payment detected for payment intent:', intent.id);
    return res.status(200).json({ success: true, message: 'Payment already recorded' });
  }

  // Record the base payment (positive amount) - reduces outstanding balance
  const { error: insertErr } = await supabase
    .from('ledger')
    .insert({
      account_id,
      member_id,
      type: 'payment',
      amount: baseAmountDollars,
      note: chargeDescription,
      date: transactionDate,
      stripe_payment_intent_id: intent.id // Prevent webhook duplicate
    });

  if (insertErr) {
    console.error('Failed to update ledger:', insertErr);
    return res.status(500).json({ error: 'Failed to update ledger', details: insertErr.message });
  }

  // If credit card fee was applied, record it as a separate charge
  if (creditCardFee > 0) {
    const { error: feeErr } = await supabase
      .from('ledger')
      .insert({
        account_id,
        member_id,
        type: 'purchase',
        amount: -creditCardFeeDollars, // Negative = charge
        note: '4% Credit Card Processing Fee',
        date: transactionDate,
      });

    if (feeErr) {
      console.error('Failed to record credit card fee:', feeErr);
      // Don't fail the entire transaction if fee recording fails
    }
  }

  return res.status(200).json({
    success: true,
    paymentIntent: intent,
    baseAmount: baseAmountDollars,
    creditCardFee: creditCardFeeDollars,
    totalCharged: (amountToCharge / 100)
  });
}