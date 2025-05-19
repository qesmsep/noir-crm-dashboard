import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { stripe_customer_id } = req.body;

  if (!stripe_customer_id) {
    return res.status(400).json({ error: 'stripe_customer_id is required' });
  }

  try {
    // Get subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: stripe_customer_id,
      status: 'all',
      limit: 1,
    });

    const subscription = subscriptions.data[0];

    // Get last payment if available
    let last_payment = null;
    if (subscription && subscription.latest_invoice) {
      const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
      last_payment = invoice.status === 'paid' ? invoice.paid_at : null;
    }

    res.status(200).json({
      status: subscription ? subscription.status : 'none',
      next_renewal: subscription ? subscription.current_period_end : null,
      last_payment,
      subscription_id: subscription ? subscription.id : null,
      plan: subscription && subscription.items.data[0]
        ? subscription.items.data[0].plan.nickname
        : null,
    });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
}