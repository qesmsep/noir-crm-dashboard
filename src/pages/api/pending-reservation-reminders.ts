import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { id } = req.query;

      if (id) {
        // Fetch a single reminder by ID
        const { data: reminder, error: fetchError } = await supabase
          .from('scheduled_reservation_reminders')
          .select(`
            *,
            reservations (
              id,
              first_name,
              last_name,
              phone,
              start_time,
              party_size
            ),
            reservation_reminder_templates (
              id,
              name,
              reminder_type,
              send_time
            )
          `)
          .eq('id', id)
          .eq('status', 'pending')
          .single();

        if (fetchError) {
          console.error('Error fetching reminder:', fetchError);
          return res.status(500).json({ error: 'Failed to fetch reminder' });
        }

        if (!reminder) {
          return res.status(404).json({ error: 'Reminder not found' });
        }

        res.status(200).json(reminder);
      } else {
        // Get all pending reservation reminders with related data
        const { data: pendingReminders, error: fetchError } = await supabase
          .from('scheduled_reservation_reminders')
          .select(`
            *,
            reservations (
              id,
              first_name,
              last_name,
              phone,
              start_time,
              party_size
            ),
            reservation_reminder_templates (
              id,
              name,
              reminder_type,
              send_time
            )
          `)
          .eq('status', 'pending')
          .order('scheduled_for', { ascending: true });

        if (fetchError) {
          console.error('Error fetching pending reservation reminders:', fetchError);
          return res.status(500).json({ error: 'Failed to fetch pending reminders' });
        }

        res.status(200).json({ pendingReminders: pendingReminders || [] });
      }
    } catch (error) {
      console.error('Error in pending reservation reminders API:', error);
      res.status(500).json({ error: 'Failed to fetch pending reminders' });
    }
  } else if (req.method === 'PATCH') {
    try {
      const { id, scheduled_for, message_content } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Reminder ID is required' });
      }

      // Validate that at least one field is provided to update
      if (!scheduled_for && !message_content) {
        return res.status(400).json({ error: 'At least one field (scheduled_for or message_content) is required' });
      }

      // Prepare update data
      const updateData: any = {};
      if (scheduled_for) {
        updateData.scheduled_for = scheduled_for;
      }
      if (message_content) {
        updateData.message_content = message_content;
      }

      // Update the reminder
      const { data: updatedReminder, error: updateError } = await supabase
        .from('scheduled_reservation_reminders')
        .update(updateData)
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();

      if (updateError) {
        console.error('Error updating reminder:', updateError);
        return res.status(500).json({ error: 'Failed to update reminder' });
      }

      if (!updatedReminder) {
        return res.status(404).json({ error: 'Reminder not found or not in pending status' });
      }

      res.status(200).json({ 
        message: 'Reminder updated successfully',
        reminder: updatedReminder
      });

    } catch (error) {
      console.error('Error updating reservation reminder:', error);
      res.status(500).json({ error: 'Failed to update reminder' });
    }
  } else if (req.method === 'POST') {
    try {
      const { reminder_id } = req.body;

      if (!reminder_id) {
        return res.status(400).json({ error: 'Reminder ID is required' });
      }

      // Get the specific reminder
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
        throw new Error(`SMS API returned ${smsResponse.status}`);
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
        openphone_message_id: smsResult.id 
      });

    } catch (error) {
      console.error('Error sending individual reservation reminder:', error);
      res.status(500).json({ error: 'Failed to send reminder' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PATCH', 'POST']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
} 