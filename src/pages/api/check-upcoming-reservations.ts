import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { DateTime } from 'luxon';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  console.log('🔍 Checking for upcoming reservations and missed reminders...');

  try {
    // Get business timezone from settings
    let businessTimezone = 'America/Chicago';
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('timezone')
      .single();
    if (!settingsError && settings?.timezone) {
      businessTimezone = settings.timezone;
    }

    const now = DateTime.now().setZone(businessTimezone);
    const today = now.startOf('day');
    const tomorrow = today.plus({ days: 1 });

    // Get all confirmed reservations for today and tomorrow
    const { data: upcomingReservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', 'confirmed')
      .gte('start_time', today.toUTC().toISO())
      .lt('start_time', tomorrow.plus({ days: 1 }).toUTC().toISO())
      .order('start_time', { ascending: true });

    if (reservationsError) {
      console.error('Error fetching upcoming reservations:', reservationsError);
      return res.status(500).json({ error: 'Failed to fetch upcoming reservations' });
    }

    if (!upcomingReservations || upcomingReservations.length === 0) {
      console.log('✅ No upcoming reservations found');
      return res.status(200).json({ message: 'No upcoming reservations found' });
    }

    console.log(`📅 Found ${upcomingReservations.length} upcoming reservations`);

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
      console.log('✅ No active reminder templates found');
      return res.status(200).json({ message: 'No active reminder templates found' });
    }

    const results = {
      reservations_checked: 0,
      reminders_scheduled: 0,
      immediate_sends: 0,
      errors: [] as string[]
    };

    // Check each reservation for missed reminders
    for (const reservation of upcomingReservations) {
      try {
        results.reservations_checked++;

        const reservationDateTime = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone(businessTimezone);
        const isSameDay = reservationDateTime.hasSame(now, 'day');

        // Check if any reminders are already scheduled for this reservation
        const { data: existingReminders, error: existingError } = await supabase
          .from('scheduled_reservation_reminders')
          .select('template_id')
          .eq('reservation_id', reservation.id);

        if (existingError) {
          console.error('Error checking existing reminders:', existingError);
          results.errors.push(`Failed to check existing reminders for reservation ${reservation.id}`);
          continue;
        }

        const scheduledTemplateIds = existingReminders?.map(r => r.template_id) || [];

        // Check each template
        for (const template of templates) {
          // Skip if already scheduled
          if (scheduledTemplateIds.includes(template.id)) {
            continue;
          }

          let scheduledTimeUTC: string | null = null;
          let shouldSendImmediately = false;

          if (template.reminder_type === 'day_of') {
            // Check if this is a day-of reminder that should have been sent
            const [hours, minutes] = template.send_time.split(':').map(Number);
            const scheduledLocal = reservationDateTime.set({ 
              hour: hours, 
              minute: minutes || 0, 
              second: 0, 
              millisecond: 0 
            });

            // If same-day reservation and scheduled time has passed, send immediately
            if (isSameDay && scheduledLocal < now) {
              shouldSendImmediately = true;
              scheduledTimeUTC = now.toUTC().toISO();
            } else {
              scheduledTimeUTC = scheduledLocal.toUTC().toISO();
            }
          } else if (template.reminder_type === 'hour_before') {
            // Check if this is an hour-before reminder that should have been sent
            const timeParts = template.send_time.split(':');
            const hoursBefore = parseInt(timeParts[0]);
            const minutesBefore = timeParts.length > 1 ? parseInt(timeParts[1]) : 0;
            
            const scheduledLocal = reservationDateTime.minus({ 
              hours: hoursBefore, 
              minutes: minutesBefore 
            });

            // If scheduled time has passed, send immediately
            if (scheduledLocal < now) {
              shouldSendImmediately = true;
              scheduledTimeUTC = now.toUTC().toISO();
            } else {
              scheduledTimeUTC = scheduledLocal.toUTC().toISO();
            }
          }

          // Only schedule if the time hasn't passed or if we should send immediately
          if (scheduledTimeUTC && (DateTime.fromISO(scheduledTimeUTC) > DateTime.utc() || shouldSendImmediately)) {
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
              results.errors.push(`Failed to schedule reminder for reservation ${reservation.id}: ${insertError.message}`);
            } else {
              results.reminders_scheduled++;
              if (shouldSendImmediately) {
                results.immediate_sends++;
                console.log(`⚡ Scheduled immediate send for ${reservation.first_name} (${template.name})`);
              } else {
                console.log(`📅 Scheduled reminder for ${reservation.first_name} at ${DateTime.fromISO(scheduledTimeUTC).setZone(businessTimezone).toFormat('hh:mm a')} (${template.name})`);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing reservation:', error);
        results.errors.push(`Failed to process reservation ${reservation.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🎉 Check complete: ${results.reservations_checked} reservations checked, ${results.reminders_scheduled} reminders scheduled, ${results.immediate_sends} immediate sends`);

    res.status(200).json({
      message: 'Upcoming reservations check complete',
      results
    });

  } catch (error) {
    console.error('Error checking upcoming reservations:', error);
    res.status(500).json({ error: 'Failed to check upcoming reservations' });
  }
} 