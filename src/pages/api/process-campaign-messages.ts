import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { DateTime } from 'luxon';

// Helper function to generate and upload ledger PDF (same as BALANCE command)
async function generateLedgerPdf(memberId: string, accountId: string) {
  try {
    // Calculate previous billing month based on member's join date
    const today = new Date();
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('join_date')
      .eq('member_id', memberId)
      .single();
    
    if (!member?.join_date) {
      throw new Error('Member join date not found');
    }
    
    const joinDate = new Date(member.join_date);
    
    // Calculate how many months have passed since join date
    const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                           (today.getMonth() - joinDate.getMonth());
    
    // Calculate the start and end of the PREVIOUS billing period (not current)
    const previousPeriodStart = new Date(joinDate);
    previousPeriodStart.setMonth(joinDate.getMonth() + monthsSinceJoin - 1); // Subtract 1 month
    previousPeriodStart.setDate(joinDate.getDate());
    
    const previousPeriodEnd = new Date(joinDate);
    previousPeriodEnd.setMonth(joinDate.getMonth() + monthsSinceJoin);
    previousPeriodEnd.setDate(joinDate.getDate() - 1); // Day before current period
    
    const startDate = previousPeriodStart.toISOString().split('T')[0];
    const endDate = previousPeriodEnd.toISOString().split('T')[0];
    
    console.log('Calculated previous billing period:', { startDate, endDate, member: memberId });
    
    // Generate PDF using existing functionality
    const { LedgerPdfGenerator } = await import('../../utils/ledgerPdfGenerator');
    const pdfGenerator = new LedgerPdfGenerator();
    const pdfBuffer = await pdfGenerator.generateLedgerPdf(memberId, accountId, startDate, endDate);
    
    // Upload PDF to Supabase storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `campaign_${memberId}_${startDate}_${endDate}_${timestamp}.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('ledger-pdfs')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      throw new Error('Failed to upload PDF to storage');
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('ledger-pdfs')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error generating ledger PDF:', error);
    throw error;
  }
}

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
          .select('phone, start_time, end_time, party_size')
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
            join_date: reservation.start_time, // Store start_time in join_date
            end_time: reservation.end_time, // Store end_time for after messages
            party_size: reservation.party_size, // Store party_size for placeholders
            created_at: reservation.start_time,
            updated_at: reservation.start_time
          };
        });
        
        console.log('Created virtual members from reservations:', virtualMembers.length);
        members = virtualMembers;
      } else if (triggerType === 'reservation_created') {
        // Get reservations created recently (within last 24 hours)
        const { data: reservationData, error: reservationError } = await supabaseAdmin
          .from('reservations')
          .select('phone, start_time, end_time, party_size, created_at, first_name, last_name')
          .gte('created_at', now.minus({ hours: 24 }).toISO()) // Reservations created in last 24 hours
          .lte('created_at', now.toISO()); // Up to now

        if (reservationError) {
          console.error('Error fetching recent reservations:', reservationError);
          continue;
        }

        if (!reservationData || reservationData.length === 0) {
          console.log('No recently created reservations found');
          continue;
        }

        console.log('Found recently created reservations:', reservationData.map(r => ({
          phone: r.phone,
          created_at: r.created_at,
          first_name: r.first_name,
          last_name: r.last_name
        })));

        // Create virtual members from recently created reservations
        const virtualMembers = reservationData.map(reservation => {
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
            member_id: crypto.randomUUID(),
            account_id: crypto.randomUUID(),
            first_name: reservation.first_name || 'Guest',
            last_name: reservation.last_name || '',
            email: '',
            phone: formattedPhone,
            member_type: 'guest',
            join_date: reservation.created_at, // Use created_at as trigger point
            end_time: reservation.end_time,
            party_size: reservation.party_size,
            created_at: reservation.created_at,
            updated_at: reservation.created_at
          };
        });
        
        console.log('Created virtual members from recent reservations:', virtualMembers.length);
        members = virtualMembers;
      } else if (triggerType === 'member_birthday') {
        // Get all members with dob and filter by birthday in JavaScript
        const { data: allMembers, error: membersError } = await supabaseAdmin
          .from('members')
          .select('*')
          .not('dob', 'is', null);

        if (membersError) {
          console.error('Error fetching members for birthday check:', membersError);
          continue;
        }

        // Filter members whose birthday is today
        const today = now.toFormat('MM-dd');
        members = (allMembers || []).filter(member => {
          if (!member.dob) return false;
          
          // Convert dob to MM-dd format for comparison
          const dobDate = DateTime.fromISO(member.dob);
          const dobFormatted = dobDate.toFormat('MM-dd');
          
          return dobFormatted === today;
        });
      } else if (triggerType === 'member_renewal') {
        // Get all members and filter by renewal date calculated from join_date
        const { data: allMembers, error: membersError } = await supabaseAdmin
          .from('members')
          .select('*')
          .not('join_date', 'is', null);

        if (membersError) {
          console.error('Error fetching members for renewal check:', membersError);
          continue;
        }

        // Filter members whose renewal date is today (calculated from join_date)
        const today = now.toFormat('yyyy-MM-dd');
        members = (allMembers || []).filter(member => {
          if (!member.join_date) return false;
          
          // Calculate renewal date based on join_date
          const joinDate = DateTime.fromISO(member.join_date);
          const todayDate = now.startOf('day');
          
          // Calculate how many months have passed since join date
          const monthsSinceJoin = todayDate.diff(joinDate, 'months').months;
          
          // Calculate the next renewal date
          const nextRenewalDate = joinDate.plus({ months: Math.ceil(monthsSinceJoin) });
          
          // Check if today is the renewal date
          const isRenewalToday = nextRenewalDate.toFormat('yyyy-MM-dd') === today;
          
          return isRenewalToday;
        });
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
            const reservationEndTime = member.end_time; // This contains the reservation end_time
            
            if (!reservationStartTime) {
              console.log(`No reservation time found for virtual member ${member.member_id}`);
              continue;
            }
            
            console.log(`Found reservation for virtual member ${member.member_id}:`, {
              phone: member.phone,
              start_time: reservationStartTime,
              end_time: reservationEndTime
            });
            
            // Use start_time for 'before' messages and end_time for 'after' messages
            const isAfterMessage = message.duration_proximity === 'after';
            const triggerTime = isAfterMessage && reservationEndTime ? reservationEndTime : reservationStartTime;
            triggerDate = DateTime.fromISO(triggerTime, { zone: 'utc' }).setZone(businessTimezone);
            console.log(`Trigger date (business timezone): ${triggerDate.toISO()} (using ${isAfterMessage ? 'end_time' : 'start_time'})`);
          } else if (triggerType === 'reservation_created') {
            // Use reservation created_at as trigger date
            triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' }).setZone(businessTimezone);
            console.log(`Trigger date (business timezone): ${triggerDate.toISO()} (using created_at)`);
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
            // Send at specific time relative to trigger date
            const [hours, minutes] = message.specific_time?.split(':').map(Number) || [10, 0];
            const quantity = message.specific_time_quantity || 0;
            const unit = message.specific_time_unit || 'day';
            const proximity = message.specific_time_proximity || 'after';
            
            // Convert database unit names to Luxon unit names
            const luxonUnit = unit === 'min' ? 'minutes' : 
                             unit === 'hr' ? 'hours' : 
                             unit === 'day' ? 'days' : 
                             unit === 'month' ? 'months' : 
                             unit === 'year' ? 'years' : 'days';
            
            // Calculate the relative date first
            let relativeDate = triggerDate;
            if (quantity > 0) {
              relativeDate = triggerDate.plus({
                [luxonUnit]: proximity === 'after' ? quantity : -quantity
              });
            }
            
            // Then set the specific time on that date
            targetSendTime = relativeDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
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

          // Check if message should be sent now (within 5 minutes of target time)
          const timeDiff = targetSendTime.diff(now, 'minutes').minutes;
          console.log(`Campaign message ${message.name}: target time ${targetSendTime.toISO()}, now ${now.toISO()}, diff ${timeDiff} minutes`);
          
          // Only send if we're within 5 minutes AFTER the target time (not before)
          if (timeDiff > 5 || timeDiff < -60) {
            console.log(`Message not ready to send yet (diff: ${timeDiff} minutes)`);
            continue; // Not time to send yet
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
          
          // Add reservation-specific placeholders for reservation_time and reservation_created triggers
          if (triggerType === 'reservation_time' || triggerType === 'reservation_created') {
            // Format reservation time
            if (member.join_date) {
              const reservationTime = DateTime.fromISO(member.join_date, { zone: 'utc' }).setZone(businessTimezone);
              const formattedTime = reservationTime.toFormat('h:mm a');
              messageContent = messageContent.replace(/\{\{reservation_time\}\}/g, formattedTime);
            }
            
            // Add party size
            if (member.party_size) {
              messageContent = messageContent.replace(/\{\{party_size\}\}/g, member.party_size.toString());
            }
          }
          
          // Add ledger PDF link if enabled (only for member-related triggers)
          if (message.include_ledger_pdf && triggerType !== 'reservation_time') {
            try {
              console.log('Generating ledger PDF for campaign message');
              const pdfUrl = await generateLedgerPdf(member.member_id, member.account_id);
              messageContent += `\n\nYour ledger statement: ${pdfUrl}`;
              console.log('Added ledger PDF link to message:', pdfUrl);
            } catch (error) {
              console.error('Failed to generate ledger PDF for campaign message:', error);
              // Continue without the PDF link rather than failing the entire message
            }
          }

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

          // Check if message already sent
          const { data: existingMessage } = await supabaseAdmin
            .from('scheduled_messages')
            .select('id')
            .eq('campaign_message_id', message.id)
            .eq('phone_number', formattedPhone)
            .eq('status', 'sent')
            .single();

          if (existingMessage) {
            console.log(`Message already sent for campaign message ${message.id} to phone ${formattedPhone}`);
            continue;
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
              member_id: null, // Use null since virtual members don't exist in members table
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
                member_id: null, // Use null since virtual members don't exist in members table
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