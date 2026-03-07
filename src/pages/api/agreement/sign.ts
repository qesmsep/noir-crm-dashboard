import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[AGREEMENT SIGN] Request received:', { method: req.method, body: req.body ? 'present' : 'missing' });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, signer_name, signer_email, signature_data, agreement_id } = req.body;

  console.log('[AGREEMENT SIGN] Parsed data:', {
    hasToken: !!token,
    hasName: !!signer_name,
    hasEmail: !!signer_email,
    hasSignature: !!signature_data,
    hasAgreement: !!agreement_id
  });

  if (!token || !signer_name || !signer_email || !signature_data || !agreement_id) {
    console.log('[AGREEMENT SIGN] Missing fields validation failed');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate signature is not empty (basic check)
  console.log('[AGREEMENT SIGN] Signature data length:', signature_data.length);
  if (signature_data.length < 100) {
    console.log('[AGREEMENT SIGN] Signature too short');
    return res.status(400).json({ error: 'Invalid signature data' });
  }

  try {
    // Get waitlist entry by token (try both application_token and agreement_token)
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .or(`application_token.eq.${token},agreement_token.eq.${token}`)
      .single();

    if (waitlistError || !waitlist) {
      console.error('[AGREEMENT SIGN] Waitlist lookup error:', waitlistError);
      return res.status(404).json({ error: 'Invalid token' });
    }

    console.log('[AGREEMENT SIGN] Waitlist found:', { id: waitlist.id, already_signed: !!waitlist.agreement_signed_at });

    // Check if already signed - if so, update the signature and return success (idempotent)
    if (waitlist.agreement_signed_at) {
      console.log('[AGREEMENT SIGN] Agreement already signed at:', waitlist.agreement_signed_at, '- updating signature');

      // Get IP address and user agent
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      // Delete old signature(s) and create new one
      await supabase
        .from('agreement_signatures')
        .delete()
        .eq('waitlist_id', waitlist.id);

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

      return res.status(200).json({
        success: true,
        signature_id: signature.id,
        message: 'Agreement re-signed successfully',
        already_signed: true
      });
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

  // Send SMS using shared utility
  const { sendSMS } = await import('@/lib/sms');
  const result = await sendSMS({
    to: phone,
    content: message
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to send SMS');
  }
}
