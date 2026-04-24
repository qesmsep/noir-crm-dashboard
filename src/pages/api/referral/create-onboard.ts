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

    // Create a placeholder waitlist entry with the agreement_token
    // This allows the onboard flow to validate the token
    // Using placeholder values for required fields that will be updated during onboarding
    const { data: waitlistEntry, error: waitlistError } = await supabase
      .from('waitlist')
      .insert({
        agreement_token: applicationToken,
        agreement_token_created_at: new Date().toISOString(),
        application_expires_at: expiresAt.toISOString(),
        referred_by_member_id: referrer.member_id,
        referral_code: referralCode.toUpperCase(),
        status: 'pending',
        form_step: 0,
        // Placeholder values for required fields (will be replaced during onboarding)
        first_name: 'FirstName',
        last_name: 'LastName',
        email: 'youremailaddress@gmail.com',
        phone: '913.555.1234'
      })
      .select()
      .single();

    if (waitlistError) {
      console.error('Error creating waitlist entry:', waitlistError);
      return res.status(500).json({ error: 'Failed to create onboarding session' });
    }

    // Track the referral click in referral_clicks table (for analytics)
    const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    const { data: clickEntry, error: clickError } = await supabase
      .from('referral_clicks')
      .insert({
        referral_code: referralCode.toUpperCase(),
        referred_by_member_id: referrer.member_id,
        clicked_at: new Date().toISOString(),
        ip_address: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        user_agent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
        converted: false,
        waitlist_id: waitlistEntry.id
      })
      .select()
      .single();

    if (clickError) {
      console.error('Error tracking referral click:', clickError);
      // Don't fail the request if click tracking fails - continue anyway
    }

    const onboardUrl = `/onboard/${applicationToken}`;

    return res.status(200).json({
      success: true,
      onboardUrl,
      token: applicationToken,
      clickId: clickEntry?.id || null,
      waitlistId: waitlistEntry.id,
      referrerName: `${referrer.first_name} ${referrer.last_name}`,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Error creating referral onboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
