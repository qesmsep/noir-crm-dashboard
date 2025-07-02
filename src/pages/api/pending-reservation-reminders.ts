import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Get pending reminders with reservation and template details
      const { data: pendingReminders, error } = await supabase
        .from('scheduled_reservation_reminders')
        .select(`
          *,
          reservation:reservations(
            id,
            first_name,
            last_name,
            phone,
            start_time,
            party_size,
            status
          ),
          template:reservation_reminder_templates(
            id,
            name,
            reminder_type,
            send_time
          )
        `)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });

      if (error) {
        console.error('Error fetching pending reminders:', error);
        return res.status(500).json({ error: 'Failed to fetch pending reminders' });
      }

      res.status(200).json({ pendingReminders: pendingReminders || [] });
    } catch (error) {
      console.error('Error in pending-reservation-reminders API:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { reminder_id } = req.body;

      if (!reminder_id) {
        return res.status(400).json({ error: 'Reminder ID is required' });
      }

      // Get the reminder details
      const { data: reminder, error: fetchError } = await supabase
        .from('scheduled_reservation_reminders')
        .select('*')
        .eq('id', reminder_id)
        .eq('status', 'pending')
        .single();

      if (fetchError || !reminder) {
        return res.status(404).json({ error: 'Reminder not found or already processed' });
      }

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
        const errorData = await smsResponse.json();
        throw new Error(`SMS API returned ${smsResponse.status}: ${JSON.stringify(errorData)}`);
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
        .eq('id', reminder_id);

      if (updateError) {
        console.error('Error updating reminder status:', updateError);
        return res.status(500).json({ error: 'Failed to update reminder status' });
      }

      res.status(200).json({
        message: 'Reminder sent successfully',
        reminder_id,
        openphone_message_id: smsResult.id
      });

    } catch (error) {
      console.error('Error sending individual reminder:', error);

      // Update reminder status to failed
      const { reminder_id } = req.body;
      if (reminder_id) {
        await supabase
          .from('scheduled_reservation_reminders')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', reminder_id);
      }

      res.status(500).json({ 
        error: 'Failed to send reminder',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 