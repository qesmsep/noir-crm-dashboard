import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PUT /api/accounts/update-credit-card-fee
 *
 * Updates the credit_card_fee_enabled setting for an account
 *
 * Body:
 *   - account_id: UUID
 *   - enabled: boolean
 *
 * Returns:
 *   - success: boolean
 *   - credit_card_fee_enabled: boolean
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, enabled } = req.body;

  if (!account_id || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'account_id and enabled (boolean) are required' });
  }

  try {
    const { error } = await supabase
      .from('accounts')
      .update({ credit_card_fee_enabled: enabled })
      .eq('account_id', account_id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      credit_card_fee_enabled: enabled,
    });
  } catch (error: any) {
    console.error('Error updating credit card fee setting:', error);
    return res.status(500).json({ error: error.message });
  }
}
