import { supabaseAdmin } from '@/lib/supabase';

interface SendSMSParams {
  to: string;
  content: string;
  memberId?: string;
  accountId?: string;
}

/**
 * Send an SMS message via OpenPhone
 */
export async function sendSMS({ to, content, memberId, accountId }: SendSMSParams): Promise<{ success: boolean; error?: string }> {
  if (!process.env.OPENPHONE_API_KEY) {
    console.error('OpenPhone API key not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!process.env.OPENPHONE_PHONE_NUMBER_ID) {
    console.error('OpenPhone phone number ID not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    // Send message using OpenPhone API
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [to],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: content
      })
    });

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse OpenPhone response as JSON:', e);
      return { success: false, error: 'Invalid response from SMS service' };
    }

    if (!response.ok) {
      const errorMsg = data.message || `Failed to send SMS: ${response.status}`;
      console.error('OpenPhone API error:', errorMsg);

      // Store failed message if we have member info
      if (memberId && accountId) {
        await supabaseAdmin
          .from('messages')
          .insert({
            member_id: memberId,
            account_id: accountId,
            content: content,
            timestamp: new Date().toISOString(),
            status: 'failed',
            error_message: JSON.stringify({ message: errorMsg })
          });
      }

      return { success: false, error: errorMsg };
    }

    // Store successful message if we have member info
    if (memberId && accountId) {
      await supabaseAdmin
        .from('messages')
        .insert({
          member_id: memberId,
          account_id: accountId,
          content: content,
          timestamp: new Date().toISOString(),
          status: 'sent'
        });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending SMS:', error);

    // Store failed message if we have member info
    if (memberId && accountId) {
      await supabaseAdmin
        .from('messages')
        .insert({
          member_id: memberId,
          account_id: accountId,
          content: content,
          timestamp: new Date().toISOString(),
          status: 'failed',
          error_message: JSON.stringify({ message: error.message })
        });
    }

    return { success: false, error: error.message };
  }
}
