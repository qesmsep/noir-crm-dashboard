import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

/**
 * GET /api/stripe/setup-intents/[id]
 *
 * Retrieves a Stripe SetupIntent
 *
 * Returns:
 *   - SetupIntent object with all details including Financial Connections account
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Setup Intent ID is required' });
  }

  try {
    const setupIntent = await stripe.setupIntents.retrieve(id, {
      expand: ['latest_attempt', 'latest_attempt.payment_method_details', 'payment_method'],
    });

    // Extract Financial Connections account ID if available
    let financialConnectionsAccount = null;
    if (setupIntent.latest_attempt && typeof setupIntent.latest_attempt !== 'string') {
      const attempt = setupIntent.latest_attempt as any;
      if (attempt.payment_method_details?.us_bank_account?.financial_connections_account) {
        financialConnectionsAccount = attempt.payment_method_details.us_bank_account.financial_connections_account;
      }
    }

    return res.json({
      id: setupIntent.id,
      status: setupIntent.status,
      payment_method: setupIntent.payment_method,
      financial_connections_account: financialConnectionsAccount,
      customer: setupIntent.customer,
    });
  } catch (error: any) {
    console.error('Error retrieving SetupIntent:', error);
    return res.status(500).json({ error: error.message });
  }
}
