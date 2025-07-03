import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await createPaymentIntent(req, res);
      case 'PUT':
        return await confirmPayment(req, res);
      default:
        res.setHeader('Allow', ['POST', 'PUT']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Payment API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function createPaymentIntent(req: NextApiRequest, res: NextApiResponse) {
  const { application_id, email, first_name, last_name } = req.body;

  if (!application_id || !email) {
    return res.status(400).json({ error: 'Application ID and email are required' });
  }

  try {
    // Get application details
    const { data: application, error: appError } = await supabase
      .from('member_applications')
      .select('*')
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get payment settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from('membership_payment_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError || !paymentSettings) {
      return res.status(400).json({ error: 'Payment settings not configured' });
    }

    // Create or get Stripe customer
    let customer;
    if (application.stripe_customer_id) {
      customer = await stripe.customers.retrieve(application.stripe_customer_id);
    } else {
      customer = await stripe.customers.create({
        email,
        name: `${first_name} ${last_name}`,
        metadata: {
          application_id,
          type: 'membership_application'
        }
      });

      // Update application with customer ID
      await supabase
        .from('member_applications')
        .update({ stripe_customer_id: customer.id })
        .eq('id', application_id);
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentSettings.membership_fee,
      currency: paymentSettings.currency,
      customer: customer.id,
      metadata: {
        application_id,
        type: 'membership_fee'
      },
      description: 'Membership Application Fee'
    });

    // Update application with payment intent ID
    await supabase
      .from('member_applications')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_amount: paymentSettings.membership_fee,
        status: 'payment_pending'
      })
      .eq('id', application_id);

    return res.status(200).json({
      client_secret: paymentIntent.client_secret,
      amount: paymentSettings.membership_fee,
      currency: paymentSettings.currency
    });

  } catch (error: any) {
    console.error('Stripe error:', error);
    return res.status(400).json({ error: error.message });
  }
}

async function confirmPayment(req: NextApiRequest, res: NextApiResponse) {
  const { payment_intent_id } = req.body;

  if (!payment_intent_id) {
    return res.status(400).json({ error: 'Payment intent ID is required' });
  }

  try {
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status === 'succeeded') {
      // Update application status
      const { data: application, error } = await supabase
        .from('member_applications')
        .update({
          status: 'payment_completed',
          payment_completed_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', payment_intent_id)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        status: 'succeeded',
        application
      });
    } else {
      return res.status(400).json({
        status: paymentIntent.status,
        error: 'Payment not completed'
      });
    }

  } catch (error: any) {
    console.error('Payment confirmation error:', error);
    return res.status(400).json({ error: error.message });
  }
}