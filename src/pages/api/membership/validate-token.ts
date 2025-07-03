import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // Validate token and get waitlist data
    const { data, error } = await supabase
      .rpc('get_waitlist_by_token', {
        token_param: token as string
      });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    const waitlistData = data[0];

    if (!waitlistData.is_valid) {
      return res.status(400).json({ 
        error: 'Application link has expired',
        expired: true,
        expires_at: waitlistData.application_expires_at
      });
    }

    // Mark the link as opened (first time only)
    await supabase.rpc('mark_application_link_opened', {
      token_param: token as string
    });

    // Return the waitlist data for pre-filling
    return res.status(200).json({
      valid: true,
      waitlist_data: {
        id: waitlistData.id,
        first_name: waitlistData.first_name,
        last_name: waitlistData.last_name,
        email: waitlistData.email,
        phone: waitlistData.phone,
        company: waitlistData.company,
        referral: waitlistData.referral,
        how_did_you_hear: waitlistData.how_did_you_hear,
        why_noir: waitlistData.why_noir,
        occupation: waitlistData.occupation,
        industry: waitlistData.industry
      },
      expires_at: waitlistData.application_expires_at
    });

  } catch (error: any) {
    console.error('Token validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}