// api/getStripeData.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const { customerId } = req.query;
    // Fetch customer and their latest subscription
    const customer = await stripe.customers.retrieve(customerId);
    const subsList = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1
    });
    const subscription = subsList.data[0] || null;

    res.status(200).json({
      customer,
      subscription: {
        status: subscription?.status,
        current_period_end: subscription?.current_period_end
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};