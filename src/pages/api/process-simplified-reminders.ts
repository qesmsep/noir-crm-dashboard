import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { DateTime } from 'luxon';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    console.log('🔄 Starting simplified reminder processing...');
    
    // Get business timezone
    let businessTimezone = 'America/Chicago';
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('timezone')
      .single();
    if (!settingsError && settings?.timezone) {
      businessTimezone = settings.timezone;
    }

    const now = DateTime.now().setZone(businessTimezone);
    console.log(`⏰ Current time (${businessTimezone}): ${now.toFormat('yyyy-MM-dd HH:mm:ss')}`);

    // Get all active templates
    const { data: templates, error: templatesError } = await supabase
      .from('reservation_reminder_templates')
      .select('*')
      .eq('is_active', true);

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }

    if (!templates || templates.length === 0) {
      console.log('ℹ️ No active templates found');
      return res.status(200).json({ message: 'No active templates found', processed: 0 });
    }

    console.log(`📋 Found ${templates.length} active templates`);

    // Get upcoming reservations (within next 7 days)
    const sevenDaysFromNow = now.plus({ days: 7 }).toISO();
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .gte('start_time', now.toISO())
      .lte('start_time', sevenDaysFromNow)
      .order('start_time', { ascending: true });

    if (reservationsError) {
      console.error('Error fetching reservations:', reservationsError);
      return res.status(500).json({ error: 'Failed to fetch reservations' });
    }

    if (!reservations || reservations.length === 0) {
      console.log('ℹ️ No upcoming reservations found');
      return res.status(200).json({ message: 'No upcoming reservations found', processed: 0 });
    }

    console.log(`📅 Found ${reservations.length} upcoming reservations`);

    let processedCount = 0;
    const results = {
      sent: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    };

    // Process each template for each reservation
    for (const template of templates) {
      console.log(`\n🔍 Processing template: ${template.name}`);
      
      for (const reservation of reservations) {
        const reservationTime = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone(businessTimezone);
        
        // Destructure send_time, quantity, time_unit, proximity
        const { send_time, quantity, time_unit, proximity } = template;

        // Calculate target time based on template settings
        let targetTime: DateTime;
        if (template.send_time) {
          const [hourStr, minuteStr] = template.send_time.split(':');
          const sendHour = parseInt(hourStr, 10);
          const sendMinute = parseInt(minuteStr, 10);
          targetTime = reservationTime.startOf('day').set({ hour: sendHour, minute: sendMinute });
        } else if (template.quantity === 0) {
          targetTime = reservationTime.startOf('day');
        } else {
          targetTime = template.proximity === 'before'
            ? reservationTime.minus({ [template.time_unit]: template.quantity })
            : reservationTime.plus({ [template.time_unit]: template.quantity });
        }

        // Check if current time is within 15 minutes of target time
        const timeDiff = Math.abs(now.diff(targetTime, 'minutes').minutes);
        const shouldSend = timeDiff <= 15;

        console.log(`  📅 Reservation: ${reservation.first_name} at ${reservationTime.toFormat('MM/dd HH:mm')}`);
        console.log(`  ⏰ Target time: ${targetTime.toFormat('MM/dd HH:mm')} (${template.quantity} ${template.time_unit} ${template.proximity})`);
        console.log(`  ⏱️ Time diff: ${timeDiff.toFixed(1)} minutes (should send: ${shouldSend})`);

        if (shouldSend) {
          try {
            // Check if we've already sent this template for this reservation recently
            const { data: existingMessages, error: checkError } = await supabase
              .from('scheduled_reservation_reminders')
              .select('id, created_at')
              .eq('reservation_id', reservation.id)
              .eq('template_id', template.id)
              .gte('created_at', now.minus({ hours: 1 }).toISO())
              .limit(1);

            if (checkError) {
              console.error('Error checking existing messages:', checkError);
              results.errors++;
              continue;
            }

            if (existingMessages && existingMessages.length > 0) {
              console.log(`  ⏭️ Already sent recently, skipping`);
              results.skipped++;
              continue;
            }

            // Create message content with placeholders
            let messageContent = template.message_template;
            messageContent = messageContent.replace(/\{\{first_name\}\}/g, reservation.first_name || 'Guest');
            messageContent = messageContent.replace(/\{\{reservation_time\}\}/g, reservationTime.toFormat('hh:mm a'));
            messageContent = messageContent.replace(/\{\{party_size\}\}/g, reservation.party_size.toString());

            // Format phone number
            let formattedPhone = reservation.phone;
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
                content: messageContent
              })
            });

            if (!smsResponse.ok) {
              throw new Error(`SMS API returned ${smsResponse.status}`);
            }

            const smsResult = await smsResponse.json();

            // Record the sent message
            const { error: insertError } = await supabase
              .from('scheduled_reservation_reminders')
              .insert({
                reservation_id: reservation.id,
                template_id: template.id,
                customer_name: `${reservation.first_name || ''} ${reservation.last_name || ''}`.trim() || 'Guest',
                customer_phone: reservation.phone,
                message_content: messageContent,
                scheduled_for: targetTime.toISO(),
                sent_at: now.toISO(),
                status: 'sent',
                openphone_message_id: smsResult.id || null
              });

            if (insertError) {
              console.error('Error recording sent message:', insertError);
            }

            console.log(`  ✅ Message sent successfully to ${reservation.first_name}`);
            results.sent++;
            processedCount++;

          } catch (error: any) {
            console.error(`  ❌ Error sending message to ${reservation.first_name}:`, error.message);
            results.errors++;
            
            // Record the failed attempt
            try {
              await supabase
                .from('scheduled_reservation_reminders')
                .insert({
                  reservation_id: reservation.id,
                  template_id: template.id,
                  customer_name: `${reservation.first_name || ''} ${reservation.last_name || ''}`.trim() || 'Guest',
                  customer_phone: reservation.phone,
                  message_content: 'Failed to send message',
                  scheduled_for: targetTime.toISO(),
                  status: 'failed',
                  error_message: error.message
                });
            } catch (recordError) {
              console.error('Error recording failed message:', recordError);
            }
          }
        } else {
          results.skipped++;
        }
      }
    }

    console.log(`\n✅ Processing complete!`);
    console.log(`📊 Results: ${results.sent} sent, ${results.skipped} skipped, ${results.errors} errors`);

    res.status(200).json({
      message: 'Simplified reminder processing complete',
      processed: processedCount,
      results
    });

  } catch (error: any) {
    console.error('❌ Error in simplified reminder processing:', error);
    res.status(500).json({ error: 'Failed to process reminders' });
  }
} 