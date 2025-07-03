import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getWaitlistEntries(req, res);
      case 'PUT':
        return await updateWaitlistEntry(req, res);
      case 'POST':
        return await generateApplicationLink(req, res);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'POST']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Waitlist API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getWaitlistEntries(req: NextApiRequest, res: NextApiResponse) {
  const { status, page = 1, limit = 20 } = req.query;
  
  let query = supabase
    .from('waitlist')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const offset = (Number(page) - 1) * Number(limit);
  query = query.range(offset, offset + Number(limit) - 1);

  const { data, error, count } = await query;

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count
    }
  });
}

async function updateWaitlistEntry(req: NextApiRequest, res: NextApiResponse) {
  const { id, status, review_notes, reviewed_by } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: 'ID and status are required' });
  }

  const updateData: any = {
    status,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (review_notes) updateData.review_notes = review_notes;
  if (reviewed_by) updateData.reviewed_by = reviewed_by;

  const { data, error } = await supabase
    .from('waitlist')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json(data);
}

async function generateApplicationLink(req: NextApiRequest, res: NextApiResponse) {
  const { waitlist_id, expires_in_hours = 168, send_sms = true } = req.body;

  if (!waitlist_id) {
    return res.status(400).json({ error: 'Waitlist ID is required' });
  }

  try {
    // Generate application link using database function
    const { data: linkData, error: linkError } = await supabase
      .rpc('generate_application_link', {
        waitlist_entry_id: waitlist_id,
        expires_in_hours: expires_in_hours
      });

    if (linkError) {
      return res.status(400).json({ error: linkError.message });
    }

    const linkInfo = linkData[0];
    
    // Get waitlist entry details for SMS
    const { data: waitlistEntry, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('id', waitlist_id)
      .single();

    if (waitlistError) {
      return res.status(400).json({ error: waitlistError.message });
    }

    // Send SMS if requested
    if (send_sms && waitlistEntry.phone) {
      const fullUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}${linkInfo.link_url}`;
      
      const smsResult = await sendApplicationLinkSMS(
        waitlistEntry.phone,
        waitlistEntry.first_name,
        fullUrl,
        linkInfo.expires_at
      );

      if (smsResult.success) {
        // Update the sent timestamp
        await supabase
          .from('waitlist')
          .update({ application_link_sent_at: new Date().toISOString() })
          .eq('id', waitlist_id);
      }

      return res.status(200).json({
        link: linkInfo,
        sms: smsResult,
        waitlist_entry: waitlistEntry
      });
    }

    return res.status(200).json({
      link: linkInfo,
      waitlist_entry: waitlistEntry
    });

  } catch (error: any) {
    console.error('Error generating application link:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function sendApplicationLinkSMS(phone: string, firstName: string, applicationUrl: string, expiresAt: string) {
  try {
    const expiryDate = new Date(expiresAt).toLocaleDateString();
    
    const message = `Hi ${firstName}! 🎉 Great news - you've been approved to apply for membership! 

Complete your application here: ${applicationUrl}

This link expires on ${expiryDate}. Don't wait - secure your spot today!

Questions? Reply to this message or call us.`;

    // Use your existing SMS service
    const response = await fetch('/api/sendText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        message,
        type: 'membership_application_link'
      }),
    });

    if (response.ok) {
      return { success: true, message: 'SMS sent successfully' };
    } else {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Failed to send SMS' };
    }
  } catch (error: any) {
    console.error('SMS sending error:', error);
    return { success: false, error: error.message };
  }
}