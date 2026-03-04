import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/accounts/[accountId]/invoices
 *
 * Fetches Stripe invoices for an account's subscription
 *
 * Query params:
 *   - limit: number (default: 20, max: 100)
 *   - status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' (optional)
 *
 * Returns:
 *   - invoices: Array of formatted invoice objects
 *   - has_more: boolean
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId } = req.query;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const status = req.query.status as string | undefined;

  if (!accountId || typeof accountId !== 'string') {
    return res.status(400).json({ error: 'account_id is required' });
  }

  try {
    // Fetch account to get stripe_customer_id
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('account_id', accountId)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.stripe_customer_id) {
      return res.json({
        invoices: [],
        has_more: false,
        message: 'No Stripe customer associated with this account',
      });
    }

    // Trim whitespace from stripe_customer_id to prevent API errors
    const stripeCustomerId = account.stripe_customer_id.trim();

    // Fetch both invoices and charges for complete transaction history
    const invoicesParams: Stripe.InvoiceListParams = {
      customer: stripeCustomerId,
      limit,
    };

    if (status) {
      invoicesParams.status = status as Stripe.InvoiceListParams.Status;
    }

    // Only fetch charges (payments), not invoices
    const charges = await stripe.charges.list({
      customer: stripeCustomerId,
      limit
    });

    // Format charges as transactions
    const formattedCharges = charges.data.map((charge) => ({
      id: charge.id,
      number: null,
      amount_due: charge.amount / 100,
      amount_paid: charge.amount_captured / 100,
      currency: charge.currency.toUpperCase(),
      status: charge.status === 'succeeded' ? 'paid' : charge.status === 'failed' ? 'uncollectible' : 'open',
      created: charge.created,
      due_date: null,
      paid_at: charge.status === 'succeeded' ? charge.created : null,
      invoice_pdf: charge.receipt_url,
      hosted_invoice_url: charge.receipt_url,
      description: charge.description || 'Payment',
      subscription_id: null,
      lines: [{
        description: charge.description || 'Subscription payment',
        amount: charge.amount / 100,
        quantity: 1,
        period: null,
      }],
      metadata: charge.metadata,
    }));

    // Sort by date (newest first)
    const allTransactions = formattedCharges.sort((a, b) => b.created - a.created);

    return res.json({
      invoices: allTransactions,
      has_more: charges.has_more,
      total_count: allTransactions.length,
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return res.status(500).json({ error: error.message });
  }
}
