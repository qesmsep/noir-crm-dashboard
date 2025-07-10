import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { waitlistId } = req.body;

    if (!waitlistId) {
      return res.status(400).json({ error: 'Waitlist ID is required' });
    }

    // Generate a unique application token
    const applicationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update the waitlist entry with the application token
    const { data: updatedEntry, error } = await supabase
      .from('waitlist')
      .update({
        application_token: applicationToken,
        application_link_sent_at: new Date().toISOString(),
        application_expires_at: expiresAt.toISOString()
      })
      .eq('id', waitlistId)
      .select()
      .single();

    if (error) {
      console.error('Error generating invitation link:', error);
      return res.status(500).json({ error: 'Failed to generate invitation link' });
    }

    const invitationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invitation?token=${applicationToken}`;

    return res.status(200).json({
      success: true,
      invitationUrl,
      token: applicationToken,
      expiresAt: expiresAt.toISOString(),
      data: updatedEntry
    });

  } catch (error) {
    console.error('Error generating invitation link:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 