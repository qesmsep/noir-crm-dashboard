// api/getStripeData.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  console.log('getStripeData invoked with:', req.query);

  try {
    const { customerId } = req.query;
    if (!customerId) {
      throw new Error('Missing customerId in query');
    }
    console.log('Retrieving Stripe customer:', customerId);

    let customer;
    try {
      customer = await stripe.customers.retrieve(customerId);
      console.log('Customer retrieved:', customer.id);
    } catch (err) {
      console.error('Error retrieving customer:', err);
      throw err;
    }

    let subscription = null;
    try {
      const subsList = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 1
      });
      subscription = subsList.data[0] || null;
      console.log('Subscription data:', subscription);
    } catch (err) {
      console.error('Error listing subscriptions:', err);
    }

    return res.status(200).json({
      customer: { id: customer.id },
      subscription: {
        status: subscription?.status || 'none',
        current_period_end: subscription?.current_period_end || null
      }
    });

  } catch (err) {
    console.error('getStripeData fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
};