import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Get statistics for the last 7 days
      const days = parseInt(req.query.days as string) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: stats, error: statsError } = await supabase
        .from('scheduled_reservation_reminders')
        .select('status')
        .gte('created_at', startDate.toISOString());

      if (statsError) throw statsError;

      const statsData = {
        total: stats?.length || 0,
        pending: stats?.filter(s => s.status === 'pending').length || 0,
        sent: stats?.filter(s => s.status === 'sent').length || 0,
        failed: stats?.filter(s => s.status === 'failed').length || 0,
        cancelled: stats?.filter(s => s.status === 'cancelled').length || 0
      };

      res.status(200).json({ stats: statsData });
    } catch (error) {
      console.error('Error fetching reservation reminder stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  } else if (req.method === 'POST') {
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
            .eq('id', reminder.id);

          if (updateError) {
            console.error('Error updating reminder status:', updateError);
            results.errors.push(`Failed to update reminder ${reminder.id}: ${updateError.message}`);
          } else {
            results.successful++;
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
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 