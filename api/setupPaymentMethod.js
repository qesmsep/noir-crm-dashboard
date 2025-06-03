import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, payment_method_id } = req.body;
  if (!member_id || !payment_method_id) {
    return res.status(400).json({ error: 'member_id and payment_method_id are required' });
  }

  try {
    // 1. Get Stripe customer id for member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('stripe_customer_id')
      .eq('member_id', member_id)
      .single();
    
    if (memberError || !member || !member.stripe_customer_id) {
      return res.status(400).json({ error: 'Stripe customer not found for member' });
    }

    // 2. Attach payment method to customer
    await stripe.paymentMethods.attach(payment_method_id, {
      customer: member.stripe_customer_id,
    });

    // 3. Set as default payment method
    await stripe.customers.update(member.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error setting up payment method:', err);
    res.status(500).json({ error: err.message });
  }
} 