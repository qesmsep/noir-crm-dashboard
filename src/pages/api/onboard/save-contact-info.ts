import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[SAVE CONTACT INFO] Request received:', { method: req.method });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    token,
    first_name,
    last_name,
    email,
    phone,
    address,
    city,
    state,
    zip_code,
    photo_url,
    date_of_birth,
    company,
    city_state,
    how_did_you_hear,
    why_noir
  } = req.body;

  console.log('[SAVE CONTACT INFO] Parsed data:', {
    hasToken: !!token,
    hasFirstName: !!first_name,
    hasLastName: !!last_name,
    hasEmail: !!email,
    hasPhone: !!phone,
    hasAddress: !!address,
    hasCity: !!city,
    hasState: !!state,
    hasZipCode: !!zip_code,
    hasPhoto: !!photo_url,
    hasDateOfBirth: !!date_of_birth,
    hasCompany: !!company,
    hasCityState: !!city_state,
    hasHowDidYouHear: !!how_did_you_hear,
    hasWhyNoir: !!why_noir
  });

  if (!token || !first_name || !last_name || !email || !phone || !address || !city || !state || !zip_code) {
    console.log('[SAVE CONTACT INFO] Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Find waitlist entry by token (try both application_token and agreement_token)
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .or(`application_token.eq.${token},agreement_token.eq.${token}`)
      .single();

    if (waitlistError || !waitlist) {
      console.error('[SAVE CONTACT INFO] Waitlist lookup error:', waitlistError);
      return res.status(404).json({ error: 'Invalid token' });
    }

    console.log('[SAVE CONTACT INFO] Waitlist found:', { id: waitlist.id });

    // Update waitlist with contact info, address, and intake fields
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        first_name,
        last_name,
        email,
        phone,
        address,
        city,
        state,
        zip_code,
        photo_url,
        date_of_birth,
        company,
        city_state,
        how_did_you_hear,
        why_noir
      })
      .eq('id', waitlist.id);

    if (updateError) {
      console.error('[SAVE CONTACT INFO] Update error:', updateError);
      throw updateError;
    }

    console.log('[SAVE CONTACT INFO] Contact info saved successfully');

    return res.status(200).json({
      success: true,
      message: 'Contact information saved successfully'
    });

  } catch (error: any) {
    console.error('Save contact info error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
