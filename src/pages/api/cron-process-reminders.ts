import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow POST and GET requests (GET for testing)
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Verify this is a legitimate Vercel cron request
  // Vercel cron jobs automatically add these headers
  const isVercelCron = req.headers['x-vercel-cron'] === '1' || 
                      req.headers['user-agent']?.includes('Vercel') ||
                      req.headers['x-vercel-deployment-url'];

  if (!isVercelCron) {
    // For manual testing, allow with a secret token
    let token: string | undefined;
    
    // Check Authorization header (for POST requests)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Check query parameter (for GET requests)
    if (!token && req.method === 'GET') {
      token = req.query.token as string;
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - Only Vercel cron jobs or authorized tokens allowed' });
    }
    
    if (token !== 'cron-secret-token-2024') {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  try {
    // Get pending reminders that are due to be sent
    const now = new Date().toISOString();
    const { data: pendingReminders, error: fetchError } = await supabase
      .from('scheduled_reservation_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      console.error('Error fetching pending reminders:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch pending reminders' });
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return res.status(200).json({ message: 'No pending reminders to process' });
    }

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each pending reminder
    for (const reminder of pendingReminders) {
      try {
        // Format phone number
        let formattedPhone = reminder.customer_phone;
        if (!formattedPhone.startsWith('+')) {
          const digits = formattedPhone.replace(/\D/g, '');
          if (digits.length === 10) {
            formattedPhone = '+1' + digits;
          } else if (digits.length === 11 && digits.startsWith('1')) {
            formattedPhone = '+' + digits;
          } else {
            formattedPhone = '+' + digits;
          }
        }

        // Send SMS using OpenPhone API
        const smsResponse = await fetch('https://api.openphone.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.OPENPHONE_API_KEY!,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            to: [formattedPhone],
            from: process.env.OPENPHONE_PHONE_NUMBER_ID!,
            content: reminder.message_content
          })
        });

        if (!smsResponse.ok) {
          const errorText = await smsResponse.text();
          throw new Error(`SMS API returned ${smsResponse.status}: ${errorText}`);
        }

        const smsResult = await smsResponse.json();

        // Update reminder status
        const { error: updateError } = await supabase
          .from('scheduled_reservation_reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            openphone_message_id: smsResult.id || null
          })
          .eq('id', reminder.id);

        if (updateError) {
          console.error('Error updating reminder status:', updateError);
          results.errors.push(`Failed to update reminder ${reminder.id}: ${updateError.message}`);
        } else {
          results.successful++;
          console.log(`✅ Successfully sent reminder to ${formattedPhone}: ${reminder.message_content}`);
        }

        results.processed++;

      } catch (error) {
        console.error('Error processing reminder:', error);

        // Update reminder status to failed
        const { error: updateError } = await supabase
          .from('scheduled_reservation_reminders')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', reminder.id);

        if (updateError) {
          console.error('Error updating failed reminder status:', updateError);
        }

        results.failed++;
        results.errors.push(`Failed to send reminder ${reminder.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    res.status(200).json({
      message: `Processed ${results.processed} reminders`,
      processed: results.processed,
      successful: results.successful,
      failed: results.failed,
      errors: results.errors
    });

  } catch (error) {
    console.error('Error processing reservation reminders:', error);
    res.status(500).json({ error: 'Failed to process reminders' });
  }
} 