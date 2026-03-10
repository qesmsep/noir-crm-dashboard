import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    // Validate referral code and get referrer info
    const { data: referrer, error: referrerError } = await supabase
      .from('members')
      .select('member_id, first_name, last_name, referral_code')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (referrerError || !referrer) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    // Generate a unique application token
    const applicationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Don't create waitlist entry yet - we'll create it when they submit the form
    // For now, just pass the referral info in the URL
    const onboardUrl = `/onboard/${applicationToken}?ref=${referralCode.toUpperCase()}&refId=${referrer.member_id}`;

    return res.status(200).json({
      success: true,
      onboardUrl,
      token: applicationToken,
      referrerName: `${referrer.first_name} ${referrer.last_name}`,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Error creating referral onboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
