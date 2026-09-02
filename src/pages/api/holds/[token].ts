import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import {
  getHoldSettings,
  secondsRemaining,
  HOLD_EXPIRED_MESSAGE,
} from '../../../lib/holds';

/**
 * /api/holds/[token]
 *
 * GET    - how much time is left (the countdown re-syncs against this rather
 *          than trusting the browser clock)
 * PATCH  - move the hold to the payment stage, granting the extension once
 * DELETE - release the hold when the guest backs out
 *
 * The token is the only credential: it is unguessable and scoped to one hold.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = supabaseAdmin || supabase;
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'A hold token is required' });
  }

  try {
    if (req.method === 'DELETE') {
      // Releasing is idempotent: a hold that already lapsed is simply gone
      const { error } = await client
        .from('reservation_holds')
        .delete()
        .eq('hold_token', token);

      if (error) {
        console.error('Error releasing hold:', error);
        return res.status(500).json({ error: 'Could not release the hold' });
      }
      return res.status(200).json({ released: true });
    }

    const { data: hold, error: holdError } = await client
      .from('reservation_holds')
      .select('id, location_id, table_id, start_time, end_time, party_size, seats, stage, expires_at')
      .eq('hold_token', token)
      .maybeSingle();

    if (holdError) {
      console.error('Error loading hold:', holdError);
      return res.status(500).json({ error: 'Could not load the hold' });
    }

    if (!hold || new Date(hold.expires_at) <= new Date()) {
      return res.status(410).json({ error: HOLD_EXPIRED_MESSAGE, code: 'HOLD_EXPIRED' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        hold_token: token,
        table_id: hold.table_id,
        stage: hold.stage,
        expires_at: hold.expires_at,
        seconds_remaining: secondsRemaining(hold.expires_at),
      });
    }

    if (req.method === 'PATCH') {
      const { stage } = req.body || {};
      if (stage !== 'payment') {
        return res.status(400).json({ error: "Only stage 'payment' can be set" });
      }

      // The extension is granted once, so re-entering payment cannot be used
      // to keep a table indefinitely
      if (hold.stage === 'payment') {
        return res.status(200).json({
          hold_token: token,
          stage: hold.stage,
          expires_at: hold.expires_at,
          seconds_remaining: secondsRemaining(hold.expires_at),
          extended: false,
        });
      }

      const { paymentExtensionMinutes } = await getHoldSettings(client, hold.location_id);
      // Reaching payment guarantees at least the extension from now, but never
      // takes away time the guest already had - a long hold is not truncated
      // just because the extension is shorter than what remains.
      const currentExpiry = new Date(hold.expires_at);
      const fromNow = new Date(Date.now() + paymentExtensionMinutes * 60 * 1000);
      const extendedExpiry =
        paymentExtensionMinutes > 0 && fromNow > currentExpiry ? fromNow : currentExpiry;

      const { data: updated, error: updateError } = await client
        .from('reservation_holds')
        .update({
          stage: 'payment',
          expires_at: extendedExpiry.toISOString(),
          extended_at: new Date().toISOString(),
        })
        .eq('hold_token', token)
        .select('stage, expires_at')
        .single();

      if (updateError || !updated) {
        console.error('Error extending hold:', updateError);
        return res.status(500).json({ error: 'Could not extend the hold' });
      }

      return res.status(200).json({
        hold_token: token,
        stage: updated.stage,
        expires_at: updated.expires_at,
        seconds_remaining: secondsRemaining(updated.expires_at),
        extended: extendedExpiry > currentExpiry,
        extension_minutes: paymentExtensionMinutes,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Unhandled error in hold endpoint:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
