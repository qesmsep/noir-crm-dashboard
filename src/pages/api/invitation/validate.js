import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Check if the token exists and is not expired
    const { data: waitlistEntry, error } = await supabase
      .from('waitlist')
      .select('*')
      .eq('application_token', token)
      .or('application_expires_at.is.null,application_expires_at.gt.now()')
      .single();

    if (error || !waitlistEntry) {
      return res.status(404).json({ error: 'Invalid or expired invitation link' });
    }

    // Check if the application has already been submitted
    if (waitlistEntry.first_name && waitlistEntry.last_name && waitlistEntry.email) {
      return res.status(400).json({ error: 'This invitation has already been used' });
    }

    return res.status(200).json({ 
      valid: true, 
      entry: {
        id: waitlistEntry.id,
        application_token: waitlistEntry.application_token
      }
    });

  } catch (error) {
    console.error('Error validating invitation token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 