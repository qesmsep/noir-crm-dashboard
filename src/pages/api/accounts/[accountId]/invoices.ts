import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
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

    // Fetch invoices from Stripe
    const invoicesParams: Stripe.InvoiceListParams = {
      customer: account.stripe_customer_id,
      limit,
    };

    if (status) {
      invoicesParams.status = status as Stripe.InvoiceListParams.Status;
    }

    const invoices = await stripe.invoices.list(invoicesParams);

    // Format invoices for frontend
    const formattedInvoices = invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount_due: invoice.amount_due / 100,
      amount_paid: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      created: invoice.created,
      due_date: invoice.due_date,
      paid_at: invoice.status_transitions?.paid_at,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      description: invoice.description,
      subscription_id: invoice.subscription,
      lines: invoice.lines.data.map((line) => ({
        description: line.description,
        amount: line.amount / 100,
        quantity: line.quantity,
        period: line.period
          ? {
              start: line.period.start,
              end: line.period.end,
            }
          : null,
      })),
      metadata: invoice.metadata,
    }));

    return res.json({
      invoices: formattedInvoices,
      has_more: invoices.has_more,
      total_count: invoices.data.length,
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return res.status(500).json({ error: error.message });
  }
}
