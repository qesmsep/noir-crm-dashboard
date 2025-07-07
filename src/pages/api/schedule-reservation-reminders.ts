import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { DateTime } from 'luxon';

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

    // Get business timezone from settings
    let businessTimezone = 'America/Chicago';
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('timezone')
      .single();
    if (!settingsError && settings?.timezone) {
      businessTimezone = settings.timezone;
    }

    // Convert reservation time to business timezone for calculations
    const reservationDateTime = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone(businessTimezone);
    const now = DateTime.now().setZone(businessTimezone);

    // Schedule reminders for each template
    console.log(`Processing ${templates.length} templates:`, templates.map(t => `${t.name} (${t.reminder_type})`));
    
    for (const template of templates) {
      console.log(`\n--- Processing template: ${template.name} (${template.reminder_type}) ---`);
      let scheduledTimeUTC: string | null = null;
      let shouldSendImmediately = false;

      if (template.reminder_type === 'day_of') {
        // Schedule for the day of the reservation at the specified time in business timezone
        // send_time format: "HH:MM" (e.g., "10:05", "14:30")
        const [hours, minutes] = template.send_time.split(':').map(Number);
        const scheduledLocal = reservationDateTime.set({ 
          hour: hours, 
          minute: minutes || 0, 
          second: 0, 
          millisecond: 0 
        });
        scheduledTimeUTC = scheduledLocal.toUTC().toISO();

        // Check if this is a same-day reservation and the scheduled time has already passed
        const isSameDay = reservationDateTime.hasSame(now, 'day');
        console.log(`Day-of reminder check:`, {
          template: template.name,
          reservationDate: reservationDateTime.toFormat('yyyy-MM-dd'),
          currentDate: now.toFormat('yyyy-MM-dd'),
          isSameDay,
          scheduledLocal: scheduledLocal.toFormat('HH:mm'),
          currentTime: now.toFormat('HH:mm'),
          scheduledLocalPassed: scheduledLocal < now
        });
        
        if (isSameDay && scheduledLocal < now) {
          shouldSendImmediately = true;
          scheduledTimeUTC = now.toUTC().toISO();
          console.log(`✅ Scheduling immediate send for day-of reminder: ${template.name}`);
        }
      } else if (template.reminder_type === 'hour_before') {
        // Schedule for X hours and Y minutes before the reservation in business timezone
        // send_time format: "H:M" or "H" (e.g., "1:30", "2:00", "1")
        const timeParts = template.send_time.split(':');
        const hoursBefore = parseInt(timeParts[0]);
        const minutesBefore = timeParts.length > 1 ? parseInt(timeParts[1]) : 0;
        
        const scheduledLocal = reservationDateTime.minus({ 
          hours: hoursBefore, 
          minutes: minutesBefore 
        });
        scheduledTimeUTC = scheduledLocal.toUTC().toISO();

        // Check if the scheduled time has already passed
        if (scheduledLocal < now) {
          shouldSendImmediately = true;
          scheduledTimeUTC = now.toUTC().toISO();
        }
      } else {
        continue; // Skip unknown reminder types
      }

      // Only schedule if the time hasn't passed or if we should send immediately
      const shouldSchedule = scheduledTimeUTC && (shouldSendImmediately || DateTime.fromISO(scheduledTimeUTC) > DateTime.utc());
      console.log(`Scheduling decision for ${template.name}:`, {
        shouldSendImmediately,
        scheduledTimeUTC,
        scheduledTimeUTC_parsed: DateTime.fromISO(scheduledTimeUTC).toISO(),
        currentUTC: DateTime.utc().toISO(),
        timeNotPassed: DateTime.fromISO(scheduledTimeUTC) > DateTime.utc(),
        shouldSchedule
      });
      
      if (shouldSchedule) {
        // Create message content with placeholders
        let messageContent = template.message_template;
        messageContent = messageContent.replace(/\{\{first_name\}\}/g, reservation.first_name || 'Guest');
        messageContent = messageContent.replace(/\{\{reservation_time\}\}/g,
          reservationDateTime.toFormat('hh:mm a'));
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
            scheduled_for: scheduledTimeUTC
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error scheduling reminder:', insertError);
          console.error('Insert data:', {
            reservation_id: reservation.id,
            template_id: template.id,
            customer_name: `${reservation.first_name || ''} ${reservation.last_name || ''}`.trim() || 'Guest',
            customer_phone: reservation.phone,
            message_content: messageContent,
            scheduled_for: scheduledTimeUTC
          });
        } else {
          scheduledReminders.push(scheduledReminder);
          console.log(`✅ Successfully scheduled reminder: ${template.name} (${template.reminder_type}) for ${scheduledTimeUTC}`);
          
          // If this should be sent immediately, trigger the processing
          if (shouldSendImmediately) {
            console.log(`⚡ Scheduling immediate send for template: ${template.name}`);
            // The reminder will be picked up by the next processing cycle
          }
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