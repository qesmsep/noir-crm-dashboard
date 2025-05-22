import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { member_id, first_name, last_name, email } = req.body;

  if (!member_id || !email) {
    res.status(400).json({ error: 'Missing member_id or email' });
    return;
  }

  // Set up Supabase admin client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Try to find an existing Stripe customer by email
    const customers = await stripe.customers.list({
      email,
      limit: 1
    });

    let customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      // 2. Create Stripe customer
      customer = await stripe.customers.create({
        email,
        name: `${first_name || ''} ${last_name || ''}`.trim()
      });
    }

    // 3. Update the member's stripe_customer_id and status in Supabase
    const { error } = await supabase
      .from('members')
      .update({ stripe_customer_id: customer.id, status: 'active' })
      .eq('member_id', member_id);

    if (error) {
      res.status(500).json({ error: 'Failed to update Supabase', details: error.message });
      return;
    }

    res.status(200).json({ success: true, stripe_customer: customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}