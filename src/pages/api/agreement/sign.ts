import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, signer_name, signer_email, signature_data, agreement_id } = req.body;

  if (!token || !signer_name || !signer_email || !signature_data || !agreement_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate signature is not empty (basic check)
  if (signature_data.length < 100) {
    return res.status(400).json({ error: 'Invalid signature data' });
  }

  try {
    // Get waitlist entry by token
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('application_token', token)
      .single();

    if (waitlistError || !waitlist) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    // Check if already signed
    if (waitlist.agreement_signed_at) {
      return res.status(400).json({ error: 'Agreement already signed' });
    }

    // Get IP address and user agent from request
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Create signature record
    const { data: signature, error: signatureError } = await supabase
      .from('agreement_signatures')
      .insert({
        waitlist_id: waitlist.id,
        agreement_id,
        signer_name,
        signer_email,
        signature_data,
        signature_type: 'electronic',
        ip_address: ipAddress,
        user_agent: userAgent
      })
      .select()
      .single();

    if (signatureError) throw signatureError;

    // Update waitlist entry
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        agreement_signed_at: new Date().toISOString(),
        status: 'approved' // Move to approved status after signing
      })
      .eq('id', waitlist.id);

    if (updateError) throw updateError;

    // Send SMS notification (optional)
    try {
      await sendSignatureConfirmationSMS(waitlist.phone, waitlist.first_name);
    } catch (smsError) {
      console.error('Failed to send SMS:', smsError);
      // Don't fail the request if SMS fails
    }

    return res.status(200).json({
      success: true,
      signature_id: signature.id,
      message: 'Agreement signed successfully'
    });

  } catch (error: any) {
    console.error('Agreement signing error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// Helper function to send confirmation SMS
async function sendSignatureConfirmationSMS(phone: string, firstName: string): Promise<void> {
  const message = `Hi ${firstName}! Your membership agreement has been signed. Next step: Complete payment to activate your membership. You'll receive a link shortly. 🖤`;

  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sendText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phone,
      message
    })
  });
}
