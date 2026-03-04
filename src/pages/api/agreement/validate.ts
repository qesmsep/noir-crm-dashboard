import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // Get waitlist entry by application token
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('application_token', token)
      .single();

    if (waitlistError || !waitlist) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    // Check if token is expired
    if (waitlist.application_expires_at) {
      const expiresAt = new Date(waitlist.application_expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: 'Token has expired' });
      }
    }

    // Check if already signed
    if (waitlist.agreement_signed_at) {
      return res.status(400).json({ error: 'Agreement already signed' });
    }

    // Get active agreement
    const { data: agreement, error: agreementError } = await supabase
      .from('agreements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (agreementError || !agreement) {
      return res.status(404).json({ error: 'No active agreement found' });
    }

    return res.status(200).json({
      waitlist: {
        id: waitlist.id,
        first_name: waitlist.first_name,
        last_name: waitlist.last_name,
        email: waitlist.email,
        phone: waitlist.phone,
        selected_membership: waitlist.selected_membership
      },
      agreement: {
        id: agreement.id,
        title: agreement.title,
        content: agreement.content
      }
    });

  } catch (error: any) {
    console.error('Agreement validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
