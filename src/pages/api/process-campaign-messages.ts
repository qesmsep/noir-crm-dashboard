import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { DateTime } from 'luxon';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Verify this is a legitimate Vercel cron request or authorized token
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
    console.log('Processing campaign messages...');

    // Get all active campaign messages from the new table
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('campaign_messages')
      .select(`
        *,
        campaigns (
          id,
          name,
          trigger_type
        )
      `)
      .eq('is_active', true);

    if (messagesError) {
      console.error('Error fetching campaign messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch campaign messages' });
    }

    if (!messages || messages.length === 0) {
      console.log('No active campaign messages found');
      return res.status(200).json({ message: 'No active campaign messages found' });
    }

    const now = DateTime.now();
    const businessTimezone = 'America/Chicago'; // Adjust as needed
    console.log('Current time (UTC):', now.toISO());
    console.log('Current time (business timezone):', now.setZone(businessTimezone).toISO());
    let processedCount = 0;

    for (const message of messages) {
      console.log(`Processing campaign message: ${message.name}`);
      
      // Get the campaign trigger type
      const triggerType = message.campaigns?.trigger_type || 'member_signup';

      // Get relevant members based on campaign trigger type
      let members: any[] = [];
      let reservations: any[] = []; // Add this to store reservations for reservation_time trigger
      
      if (triggerType === 'member_signup') {
        // Get members who joined recently (within last 30 days)
        const thirtyDaysAgo = now.minus({ days: 30 }).toISO();
        const { data: onboardingMembers, error: onboardingError } = await supabaseAdmin
          .from('members')
          .select('*')
          .gte('join_date', thirtyDaysAgo)
          .order('join_date', { ascending: false });

        if (onboardingError) {
          console.error('Error fetching onboarding members:', onboardingError);
          continue;
        }
        members = onboardingMembers || [];
      } else if (triggerType === 'reservation_time') {
        // Get members with upcoming reservations
        // Look for reservations in the next 24 hours to catch messages that should be sent soon
        const { data: reservationData, error: reservationError } = await supabaseAdmin
          .from('reservations')
          .select('phone, start_time')
          .gte('start_time', now.minus({ hours: 1 }).toISO()) // Include reservations from 1 hour ago
          .lte('start_time', now.plus({ days: 1 }).toISO()); // Up to 1 day in the future

        if (reservationError) {
          console.error('Error fetching reservations:', reservationError);
          continue;
        }

        if (!reservationData || reservationData.length === 0) {
          console.log('No upcoming reservations found');
          continue;
        }

        console.log('Found reservations:', reservationData.map(r => ({
          phone: r.phone,
          start_time: r.start_time
        })));

        // Store reservations for later use
        reservations = reservationData;

        // Get unique phone numbers from reservations
        const phoneNumbers = [...new Set(reservations.map(r => r.phone).filter(Boolean))];
        console.log('Found phone numbers in reservations:', phoneNumbers);
        
        if (phoneNumbers.length === 0) {
          console.log('No phone numbers found in reservations');
          continue;
        }
        
        // For reservation_time triggers, we'll create "virtual members" from reservations
        // This allows sending messages to anyone with a reservation, not just members
        const virtualMembers = reservations.map(reservation => {
          // Convert phone number to international format
          let formattedPhone = reservation.phone;
          const digits = reservation.phone.replace(/\D/g, '');
          
          if (digits.length === 10) {
            formattedPhone = '+1' + digits;
          } else if (digits.length === 11 && digits.startsWith('1')) {
            formattedPhone = '+' + digits;
          } else if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + digits;
          }
          
          return {
            member_id: crypto.randomUUID(), // Generate proper UUID
            account_id: crypto.randomUUID(), // Generate proper UUID
            first_name: 'Guest', // We'll get this from the reservation
            last_name: '',
            email: '',
            phone: formattedPhone, // Use the formatted phone number
            member_type: 'guest',
            join_date: reservation.start_time,
            created_at: reservation.start_time,
            updated_at: reservation.start_time
          };
        });
        
        console.log('Created virtual members from reservations:', virtualMembers.length);
        members = virtualMembers;
      } else if (triggerType === 'member_birthday') {
        // Get members with birthdays today
        const today = now.toFormat('MM-dd');
        const { data: birthdayMembers, error: birthdayError } = await supabaseAdmin
          .from('members')
          .select('*')
          .ilike('birthday', `%${today}%`);

        if (birthdayError) {
          console.error('Error fetching birthday members:', birthdayError);
          continue;
        }
        members = birthdayMembers || [];
      } else if (triggerType === 'member_renewal') {
        // Get members with renewal dates today
        const today = now.toFormat('yyyy-MM-dd');
        const { data: renewalMembers, error: renewalError } = await supabaseAdmin
          .from('members')
          .select('*')
          .ilike('renewal_date', `%${today}%`);

        if (renewalError) {
          console.error('Error fetching renewal members:', renewalError);
          continue;
        }
        members = renewalMembers || [];
      }

      for (const member of members) {
        try {
          // Calculate send time based on message timing
          let targetSendTime: DateTime;
          let triggerDate: DateTime;

          if (triggerType === 'member_signup') {
            triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' }).setZone(businessTimezone);
          } else if (triggerType === 'reservation_time') {
            // For virtual members, the reservation data is embedded in the member object
            const reservationStartTime = member.join_date; // This contains the reservation start_time
            
            if (!reservationStartTime) {
              console.log(`No reservation time found for virtual member ${member.member_id}`);
              continue;
            }
            
            console.log(`Found reservation for virtual member ${member.member_id}:`, {
              phone: member.phone,
              start_time: reservationStartTime
            });
            triggerDate = DateTime.fromISO(reservationStartTime, { zone: 'utc' }).setZone(businessTimezone);
            console.log(`Trigger date (business timezone): ${triggerDate.toISO()}`);
          } else if (triggerType === 'member_birthday') {
            // Use today as trigger date for birthdays
            triggerDate = now.setZone(businessTimezone);
          } else if (triggerType === 'member_renewal') {
            // Use today as trigger date for renewals
            triggerDate = now.setZone(businessTimezone);
          } else {
            continue;
          }

          if (message.timing_type === 'specific_time') {
            // Send at specific time on trigger date
            const [hours, minutes] = message.specific_time?.split(':').map(Number) || [10, 0];
            targetSendTime = triggerDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
          } else {
            // Send based on duration relative to trigger
            const quantity = message.duration_quantity || 1;
            const unit = message.duration_unit || 'hr';
            const proximity = message.duration_proximity || 'before';
            
            // Convert database unit names to Luxon unit names
            const luxonUnit = unit === 'min' ? 'minutes' : 
                             unit === 'hr' ? 'hours' : 
                             unit === 'day' ? 'days' : 
                             unit === 'month' ? 'months' : 
                             unit === 'year' ? 'years' : 'hours';
            
            targetSendTime = triggerDate.plus({
              [luxonUnit]: proximity === 'after' ? quantity : -quantity
            });
          }

          // Check if message should be sent now (within 10 minutes of target time)
          const timeDiff = Math.abs(targetSendTime.diff(now, 'minutes').minutes);
          console.log(`Campaign message ${message.name}: target time ${targetSendTime.toISO()}, now ${now.toISO()}, diff ${timeDiff} minutes`);
          if (timeDiff > 10) {
            console.log(`Message not ready to send yet (diff: ${timeDiff} minutes)`);
            continue; // Not time to send yet
          }

          // Check if message already sent
          const { data: existingMessage } = await supabaseAdmin
            .from('scheduled_messages')
            .select('id')
            .eq('campaign_message_id', message.id)
            .eq('member_id', member.member_id)
            .eq('status', 'sent')
            .single();

          if (existingMessage) {
            console.log(`Message already sent for campaign message ${message.id} and member ${member.member_id}`);
            continue;
          }

          // Determine recipient phone
          let recipientPhone = member.phone;
          if (message.recipient_type === 'member') {
            // For virtual members (reservations), use the reservation phone
            if (member.member_type === 'guest') {
              recipientPhone = member.phone; // Use the phone from the reservation
            } else {
              // For real members, get primary member's phone
              const { data: primaryMember } = await supabaseAdmin
                .from('members')
                .select('phone')
                .eq('account_id', member.account_id)
                .eq('member_type', 'primary')
                .single();
              if (primaryMember?.phone) {
                recipientPhone = primaryMember.phone;
              }
            }
          } else if (message.recipient_type === 'specific_phone' && message.specific_phone) {
            recipientPhone = message.specific_phone;
          }

          if (!recipientPhone) {
            console.log(`No phone number found for member ${member.member_id}`);
            continue;
          }

          // Create message content with placeholders
          let messageContent = message.content;
          messageContent = messageContent.replace(/\{\{first_name\}\}/g, member.first_name || '');
          messageContent = messageContent.replace(/\{\{last_name\}\}/g, member.last_name || '');
          messageContent = messageContent.replace(/\{\{member_name\}\}/g, `${member.first_name || ''} ${member.last_name || ''}`.trim());
          messageContent = messageContent.replace(/\{\{phone\}\}/g, member.phone || '');
          messageContent = messageContent.replace(/\{\{email\}\}/g, member.email || '');

          // Format phone number for OpenPhone
          let formattedPhone = recipientPhone;
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

          // Send SMS via OpenPhone API
          console.log('Sending SMS via OpenPhone API...');
          console.log('OpenPhone API Key exists:', !!process.env.OPENPHONE_API_KEY);
          console.log('Recipient phone:', formattedPhone);
          console.log('Message content:', messageContent);
          
          const openphoneResponse = await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': process.env.OPENPHONE_API_KEY || '',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              to: [formattedPhone],
              from: process.env.OPENPHONE_PHONE_NUMBER_ID,
              content: messageContent
            }),
          });

          if (!openphoneResponse.ok) {
            const errorData = await openphoneResponse.text();
            console.error('OpenPhone API error:', errorData);
            throw new Error(`OpenPhone API error: ${openphoneResponse.status}`);
          }

          const openphoneData = await openphoneResponse.json();

          // Record the sent message
          const { error: insertError } = await supabaseAdmin
            .from('scheduled_messages')
            .insert({
              campaign_message_id: message.id,
              member_id: member.member_id,
              phone_number: formattedPhone,
              message_content: messageContent,
              scheduled_time: targetSendTime.toISO(),
              sent_time: now.toISO(),
              status: 'sent',
            });

          if (insertError) {
            console.error('Error recording sent message:', insertError);
          } else {
            console.log(`Successfully sent campaign message to ${formattedPhone}`);
            processedCount++;
          }

        } catch (error) {
          console.error(`Error processing campaign message for member ${member.member_id}:`, error);
          
          // Record failed message
          try {
            await supabaseAdmin
              .from('scheduled_messages')
              .insert({
                campaign_message_id: message.id,
                member_id: member.member_id,
                phone_number: member.phone || '',
                message_content: message.content,
                scheduled_time: now.toISO(),
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error',
              });
          } catch (recordError) {
            console.error('Error recording failed message:', recordError);
          }
        }
      }
    }

    console.log(`Campaign processing complete. Processed ${processedCount} messages.`);
    res.status(200).json({ 
      message: 'Campaign processing complete', 
      processedCount 
    });

  } catch (error) {
    console.error('Error processing campaign messages:', error);
    res.status(500).json({ error: 'Failed to process campaign messages' });
  }
} 