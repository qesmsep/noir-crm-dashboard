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

  try {
    const { memberName, memberPhone, date, time, partySize, notes } = req.body;

    if (!date || !time || !partySize) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get admin notification phone from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('admin_notification_phone')
      .single();

    if (settingsError || !settings?.admin_notification_phone) {
      console.error('No admin notification phone configured:', settingsError);
      return res.status(500).json({ error: 'Admin notification phone not configured' });
    }

    // Format phone number (add +1 if not present)
    let adminPhone = settings.admin_notification_phone;
    if (!adminPhone.startsWith('+')) {
      adminPhone = `+1${adminPhone}`;
    }

    // Format the message
    let message = `🎉 RESERVATION REQUEST\n\n`;
    message += `From: ${memberName || 'Unknown Member'}\n`;
    message += `Phone: ${memberPhone || 'No phone'}\n\n`;
    message += `📅 Date: ${date}\n`;
    message += `🕐 Time: ${time}\n`;
    message += `👥 Party Size: ${partySize}\n`;

    if (notes) {
      message += `\n📝 Notes: ${notes}`;
    }

    // Send SMS ONLY to admin/business phone
    const openPhoneResponse = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': process.env.OPENPHONE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        to: [adminPhone],
        content: message,
      }),
    });

    if (!openPhoneResponse.ok) {
      const errorData = await openPhoneResponse.json();
      console.error('OpenPhone API error:', errorData);
      throw new Error('Failed to send notification');
    }

    return res.status(200).json({
      success: true,
      message: 'Reservation request sent successfully'
    });

  } catch (error: any) {
    console.error('Error sending reservation request:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send reservation request'
    });
  }
}
