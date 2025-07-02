import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { reservation_id } = req.body;

    if (!reservation_id) {
      return res.status(400).json({ error: 'Reservation ID is required' });
    }

    // Get the reservation details
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservation_id)
      .single();

    if (reservationError || !reservation) {
      console.error('Error fetching reservation:', reservationError);
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Get all active reminder templates
    const { data: templates, error: templatesError } = await supabase
      .from('reservation_reminder_templates')
      .select('*')
      .eq('is_active', true)
      .order('reminder_type', { ascending: true })
      .order('send_time', { ascending: true });

    if (templatesError) {
      console.error('Error fetching reminder templates:', templatesError);
      return res.status(500).json({ error: 'Failed to fetch reminder templates' });
    }

    if (!templates || templates.length === 0) {
      return res.status(200).json({ message: 'No active reminder templates found' });
    }

    const scheduledReminders: any[] = [];

    // Schedule reminders for each template
    for (const template of templates) {
      let scheduledTime: Date;

      if (template.reminder_type === 'day_of') {
        // Schedule for the day of the reservation at the specified time
        const reservationDate = new Date(reservation.start_time);
        const [hours, minutes] = template.send_time.split(':');
        scheduledTime = new Date(reservationDate);
        scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else if (template.reminder_type === 'hour_before') {
        // Schedule for X hours before the reservation
        const hoursBefore = parseInt(template.send_time);
        scheduledTime = new Date(reservation.start_time);
        scheduledTime.setHours(scheduledTime.getHours() - hoursBefore);
      } else {
        continue; // Skip unknown reminder types
      }

      // Only schedule if the time hasn't passed
      if (scheduledTime > new Date()) {
        // Create message content with placeholders
        let messageContent = template.message_template;
        messageContent = messageContent.replace(/\{\{first_name\}\}/g, reservation.first_name || 'Guest');
        messageContent = messageContent.replace(/\{\{reservation_time\}\}/g, 
          new Date(reservation.start_time).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }));
        messageContent = messageContent.replace(/\{\{party_size\}\}/g, reservation.party_size.toString());

        // Insert scheduled reminder
        const { data: scheduledReminder, error: insertError } = await supabase
          .from('scheduled_reservation_reminders')
          .insert({
            reservation_id: reservation.id,
            template_id: template.id,
            customer_name: `${reservation.first_name || ''} ${reservation.last_name || ''}`.trim() || 'Guest',
            customer_phone: reservation.phone,
            message_content: messageContent,
            scheduled_for: scheduledTime.toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error scheduling reminder:', insertError);
        } else {
          scheduledReminders.push(scheduledReminder);
        }
      }
    }

    res.status(200).json({
      message: `Scheduled ${scheduledReminders.length} reminders for reservation`,
      scheduled_reminders: scheduledReminders
    });

  } catch (error) {
    console.error('Error scheduling reservation reminders:', error);
    res.status(500).json({ error: 'Failed to schedule reminders' });
  }
} 