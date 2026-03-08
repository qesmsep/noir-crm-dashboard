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

    // Create a waitlist entry for referral (bypasses waitlist approval, goes straight to onboarding)
    const { data: onboardEntry, error: onboardError } = await supabase
      .from('waitlist')
      .insert({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        company: '',
        city_state: '',
        referral: `Referred by ${referrer.first_name} ${referrer.last_name}`,
        visit_frequency: '',
        go_to_drink: '',
        agreement_token: applicationToken,
        agreement_token_created_at: new Date().toISOString(),
        referral_code: referralCode.toUpperCase(),
        referred_by_member_id: referrer.member_id,
        status: 'approved' // Mark as approved so it bypasses waitlist
      })
      .select()
      .single();

    if (onboardError) {
      console.error('Error creating onboard entry:', onboardError);
      return res.status(500).json({ error: 'Failed to create onboard link' });
    }

    const onboardUrl = `/onboard/${applicationToken}`;

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
