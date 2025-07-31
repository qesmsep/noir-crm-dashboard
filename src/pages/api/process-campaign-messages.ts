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
    console.log('🚀 Starting campaign message processing...');
    console.log('==========================================');

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
      console.error('❌ Error fetching campaign messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch campaign messages' });
    }

    if (!messages || messages.length === 0) {
      console.log('ℹ️  No active campaign messages found');
      return res.status(200).json({ message: 'No active campaign messages found' });
    }

    const now = DateTime.now();
    const businessTimezone = 'America/Chicago'; // Adjust as needed
    console.log('⏰ Current time (UTC):', now.toISO());
    console.log('⏰ Current time (business timezone):', now.setZone(businessTimezone).toISO());
    console.log(`📊 Found ${messages.length} active campaign messages to process`);
    let processedCount = 0;

          for (const message of messages) {
        console.log('\n📝 ==========================================');
        console.log(`📝 Processing campaign message: ${message.name}`);
        console.log(`🔍 DEBUG: Starting detailed processing for message: ${message.name}`);
        console.log(`📝 Message ID: ${message.id}`);
        console.log(`📝 Campaign ID: ${message.campaign_id}`);
        console.log(`📝 Campaign Name: ${message.campaigns?.name || 'Unknown'}`);
        console.log(`📝 Recipient Type: ${message.recipient_type}`);
        console.log(`📝 Timing Type: ${message.timing_type}`);
        console.log(`📝 Specific Phone: ${message.specific_phone || 'None'}`);
        console.log(`📝 Include Ledger PDF: ${message.include_ledger_pdf}`);
        console.log(`📝 Full message object:`, JSON.stringify(message, null, 2));
        console.log(`🔍 DEBUG: Past detailed logging for message: ${message.name}`);
        
        // Get the campaign trigger type
        const triggerType = message.campaigns?.trigger_type || 'member_signup';
        console.log(`🎯 Campaign trigger type: ${triggerType}`);

        // Special handling for specific_phone messages - always send to the specified phone
        let members: any[] = [];
        let reservations: any[] = []; // Add this to store reservations for reservation_time trigger
        
        if (message.recipient_type === 'specific_phone' && message.specific_phone) {
          console.log('📱 Processing specific_phone message - will send to:', message.specific_phone);
          
          // Create a virtual member for the specific phone
          members = [{
            member_id: 'specific_phone_user',
            account_id: 'specific_phone_account',
            first_name: 'Specific',
            last_name: 'Phone',
            email: '',
            phone: message.specific_phone,
            member_type: 'specific_phone',
            join_date: now.toISO(), // Use current time as trigger date
            created_at: now.toISO(),
            updated_at: now.toISO()
          }];
          
          console.log(`✅ Created virtual member for specific phone: ${message.specific_phone}`);
        } else {
          // Get relevant members based on campaign trigger type
      
      if (triggerType === 'member_signup') {
        console.log('👥 Fetching members for member_signup trigger...');
        // Get members who joined recently (within last 30 days)
        const thirtyDaysAgo = now.minus({ days: 30 }).toISO();
        console.log(`📅 Looking for members who joined after: ${thirtyDaysAgo}`);
        
        const { data: recentMembers, error: membersError } = await supabaseAdmin
          .from('members')
          .select('*')
          .gte('join_date', thirtyDaysAgo)
          .order('join_date', { ascending: false });

        if (membersError) {
          console.error('❌ Error fetching recent members:', membersError);
          continue;
        }
        members = recentMembers || [];
        console.log(`✅ Found ${members.length} recent members for member_signup trigger`);
      } else if (triggerType === 'reservation_time') {
        console.log('📅 Fetching reservations for reservation_time trigger...');
        // Get members with upcoming reservations
        // Look for reservations in the next 24 hours to catch messages that should be sent soon
        const searchStart = now.minus({ hours: 1 }).toISO();
        const searchEnd = now.plus({ days: 1 }).toISO();
        console.log(`📅 Looking for reservations between: ${searchStart} and ${searchEnd}`);
        
        const { data: reservationData, error: reservationError } = await supabaseAdmin
          .from('reservations')
          .select('phone, start_time, end_time, party_size')
          .gte('start_time', searchStart) // Include reservations from 1 hour ago
          .lte('start_time', searchEnd); // Up to 1 day in the future

        if (reservationError) {
          console.error('❌ Error fetching reservations:', reservationError);
          continue;
        }

        if (!reservationData || reservationData.length === 0) {
          console.log('ℹ️  No upcoming reservations found');
          continue;
        }

        console.log('📋 Found reservations:', reservationData.map(r => ({
          phone: r.phone,
          start_time: r.start_time,
          party_size: r.party_size
        })));

        // Store reservations for later use
        reservations = reservationData;

        // Get unique phone numbers from reservations
        const phoneNumbers = [...new Set(reservations.map(r => r.phone).filter(Boolean))];
        console.log('📱 Found phone numbers in reservations:', phoneNumbers);
        
        if (phoneNumbers.length === 0) {
          console.log('⚠️  No phone numbers found in reservations');
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
        
        console.log(`✅ Created ${virtualMembers.length} virtual members from reservations`);
        members = virtualMembers;
      } else if (triggerType === 'reservation_created') {
        console.log('🆕 Fetching recently created reservations...');
        // Get reservations created recently (within last 24 hours)
        const searchStart = now.minus({ hours: 24 }).toISO();
        const searchEnd = now.toISO();
        console.log(`📅 Looking for reservations created between: ${searchStart} and ${searchEnd}`);
        
        const { data: reservationData, error: reservationError } = await supabaseAdmin
          .from('reservations')
          .select('phone, start_time, end_time, party_size, created_at, first_name, last_name')
          .gte('created_at', searchStart) // Reservations created in last 24 hours
          .lte('created_at', searchEnd); // Up to now

        if (reservationError) {
          console.error('❌ Error fetching recent reservations:', reservationError);
          continue;
        }

        if (!reservationData || reservationData.length === 0) {
          console.log('ℹ️  No recently created reservations found');
          continue;
        }

        console.log('📋 Found recently created reservations:', reservationData.map(r => ({
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
        
        console.log(`✅ Created ${virtualMembers.length} virtual members from recent reservations`);
        members = virtualMembers;
      } else if (triggerType === 'member_birthday') {
        console.log('🎂 Fetching members for birthday check...');
        // Get all members with dob and filter by birthday in JavaScript
        const { data: allMembers, error: membersError } = await supabaseAdmin
          .from('members')
          .select('*')
          .not('dob', 'is', null);

        if (membersError) {
          console.error('❌ Error fetching members for birthday check:', membersError);
          continue;
        }

        console.log(`📊 Found ${allMembers?.length || 0} members with DOB`);

        // Filter members whose birthday is today
        const today = now.toFormat('MM-dd');
        console.log(`📅 Looking for birthdays on: ${today}`);
        
        members = (allMembers || []).filter(member => {
          if (!member.dob) return false;
          
          // Convert dob to MM-dd format for comparison
          const dobDate = DateTime.fromISO(member.dob);
          const dobFormatted = dobDate.toFormat('MM-dd');
          
          return dobFormatted === today;
        });
        
        console.log(`🎂 Found ${members.length} members with birthdays today`);
      } else if (triggerType === 'member_renewal') {
        console.log('🔄 Fetching members for renewal check...');
        // Get all members and filter by renewal date calculated from join_date
        const { data: allMembers, error: membersError } = await supabaseAdmin
          .from('members')
          .select('*')
          .not('join_date', 'is', null);

        if (membersError) {
          console.error('❌ Error fetching members for renewal check:', membersError);
          continue;
        }

        console.log(`📊 Found ${allMembers?.length || 0} members with join_date`);

        // Filter members whose renewal date is today (calculated from join_date)
        const today = now.toFormat('yyyy-MM-dd');
        console.log(`📅 Looking for renewals on: ${today}`);
        
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
        
        console.log(`🔄 Found ${members.length} members with renewals today`);
      } else if (triggerType === 'all_members') {
        console.log('👥 Fetching all active members for all_members campaign...');
        // Get all active members for all_members campaigns (not deactivated)
        const { data: allMembers, error: membersError } = await supabaseAdmin
          .from('members')
          .select('*')
          .eq('deactivated', false);

        if (membersError) {
          console.error('❌ Error fetching all members:', membersError);
          continue;
        }

        members = allMembers || [];
        console.log(`✅ Found ${members.length} active members for all_members campaign`);
      }
    }

      console.log(`👤 Processing ${members.length} members for campaign message: ${message.name}`);
      
      if (members.length === 0) {
        console.log(`⚠️  No members found for campaign message: ${message.name} (trigger type: ${triggerType})`);
        console.log(`📝 Message details:`, {
          name: message.name,
          recipient_type: message.recipient_type,
          specific_phone: message.specific_phone,
          timing_type: message.timing_type,
          specific_time: message.specific_time
        });
      }

      for (const member of members) {
        try {
          console.log(`\n👤 Processing member: ${member.first_name} ${member.last_name} (${member.phone})`);
          
          // Calculate send time based on message timing
          let targetSendTime: DateTime;
          let triggerDate: DateTime;

          if (triggerType === 'member_signup') {
            triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' }).setZone(businessTimezone);
            console.log(`📅 Member signup trigger date: ${triggerDate.toISO()}`);
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
            console.log(`📅 Birthday trigger date: ${triggerDate.toISO()}`);
          } else if (triggerType === 'member_renewal') {
            // Use today as trigger date for renewals
            triggerDate = now.setZone(businessTimezone);
            console.log(`📅 Renewal trigger date: ${triggerDate.toISO()}`);
          } else if (triggerType === 'all_members') {
            // Use today as trigger date for all_members campaigns
            triggerDate = now.setZone(businessTimezone);
            console.log(`📅 All members trigger date: ${triggerDate.toISO()}`);
          } else {
            console.log(`⚠️  Unknown trigger type: ${triggerType}`);
            continue;
          }

          if (message.timing_type === 'specific_time') {
            // Send at specific time relative to trigger date
            const [hours, minutes] = message.specific_time?.split(':').map(Number) || [10, 0];
            const quantity = message.specific_time_quantity || 0;
            const unit = message.specific_time_unit || 'day';
            const proximity = message.specific_time_proximity || 'after';
            
            console.log(`Specific time calculation: hours=${hours}, minutes=${minutes}, quantity=${quantity}, unit=${unit}, proximity=${proximity}`);
            
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
            
            console.log(`Trigger date: ${triggerDate.toISO()}, Relative date: ${relativeDate.toISO()}`);
            
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
          console.log(`⏰ Campaign message ${message.name}: target time ${targetSendTime.toISO()}, now ${now.toISO()}, diff ${timeDiff} minutes`);
          console.log(`⏰ Campaign message ${message.name}: target time (business): ${targetSendTime.setZone(businessTimezone).toISO()}, now (business): ${now.setZone(businessTimezone).toISO()}`);
          console.log(`⏰ Timing check: timeDiff=${timeDiff}, should send: ${timeDiff <= 5 && timeDiff >= -60}`);
          
          // Only send if we're within 5 minutes AFTER the target time (not before)
          if (timeDiff > 5 || timeDiff < -60) {
            console.log(`⏳ Message not ready to send yet (diff: ${timeDiff} minutes)`);
            continue; // Not time to send yet
          }
          
          console.log(`✅ Message ready to send! (diff: ${timeDiff} minutes)`);

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
            console.log(`⚠️  No phone number found for member ${member.member_id}`);
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

          // Add event list if this is an all_members campaign with event list enabled
          if (triggerType === 'all_members') {
            try {
              console.log('🎯 Checking for event list configuration...');
              // Get campaign data to check if event list is enabled
              const { data: campaignData, error: campaignError } = await supabaseAdmin
                .from('campaigns')
                .select('include_event_list, event_list_date_range')
                .eq('id', message.campaign_id)
                .single();

              if (campaignError) {
                console.log('⚠️  Error fetching campaign data for event list:', campaignError);
              } else {
                console.log('📋 Campaign event list config:', {
                  include_event_list: campaignData?.include_event_list,
                  event_list_date_range: campaignData?.event_list_date_range
                });
              }

              if (!campaignError && campaignData?.include_event_list && campaignData?.event_list_date_range) {
                console.log('📅 Fetching event list for all_members campaign...');
                
                // Fetch Noir Member Events for the specified date range
                const eventsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/noir-member-events?dateRange=${encodeURIComponent(JSON.stringify(campaignData.event_list_date_range))}`);
                
                if (eventsResponse.ok) {
                  const eventsData = await eventsResponse.json();
                  const events = eventsData.events || [];
                  
                  console.log(`📅 Found ${events.length} events for date range:`, campaignData.event_list_date_range);
                  
                  if (events.length > 0) {
                    console.log('📋 Processing events for message:');
                    events.forEach((event: any) => {
                      console.log(`  Event: ${event.title}`);
                      console.log(`    RSVP Enabled: ${event.rsvpEnabled}`);
                      console.log(`    RSVP URL: ${event.rsvpUrl || 'null'}`);
                    });
                    
                    const eventList = events.map((event: any) => {
                      let eventLine = `• ${event.date} at ${event.time} - ${event.title}`;
                      
                      // Add RSVP URL if available
                      if (event.rsvpEnabled && event.rsvpUrl) {
                        const rsvpUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/rsvp/${event.rsvpUrl}`;
                        eventLine += `\n  RSVP: ${rsvpUrl}`;
                        console.log(`    ✅ Added RSVP link for ${event.title}: ${rsvpUrl}`);
                      } else {
                        console.log(`    ⚠️  No RSVP URL for ${event.title} (enabled: ${event.rsvpEnabled}, url: ${event.rsvpUrl})`);
                      }
                      
                      return eventLine;
                    }).join('\n\n');
                    
                    messageContent += '\n\n📅 Upcoming Noir Member Events:\n' + eventList;
                    console.log(`✅ Added ${events.length} events to message with RSVP links`);
                  } else {
                    console.log('ℹ️  No events found for the specified date range');
                  }
                } else {
                  console.error('❌ Failed to fetch event list:', await eventsResponse.text());
                }
              } else {
                console.log('ℹ️  Event list not enabled for this campaign');
              }
            } catch (error) {
              console.error('❌ Error adding event list to message:', error);
              // Continue without the event list rather than failing the entire message
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
            console.log(`⏭️  Message already sent for campaign message ${message.id} to phone ${formattedPhone}`);
            continue;
          }

          // Send SMS via OpenPhone API
          console.log('📤 Sending SMS via OpenPhone API...');
          console.log('🔑 OpenPhone API Key exists:', !!process.env.OPENPHONE_API_KEY);
          console.log('📱 Recipient phone:', formattedPhone);
          console.log('📄 Message content:', messageContent);
          
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
            console.error('❌ OpenPhone API error:', errorData);
            throw new Error(`OpenPhone API error: ${openphoneResponse.status}`);
          }

          const openphoneData = await openphoneResponse.json();
          console.log('✅ OpenPhone API response:', openphoneData);

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
            console.error('❌ Error recording sent message:', insertError);
          } else {
            console.log(`✅ Successfully sent campaign message to ${formattedPhone}`);
            processedCount++;
          }

        } catch (error) {
          console.error(`❌ Error processing campaign message for member ${member.member_id}:`, error);
          
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
            console.log('📝 Recorded failed message in database');
          } catch (recordError) {
            console.error('❌ Error recording failed message:', recordError);
          }
        }
      }
    }

    console.log('\n🎉 ==========================================');
    console.log(`🎉 Campaign processing complete. Processed ${processedCount} messages.`);
    console.log('🎉 ==========================================');
    res.status(200).json({ 
      message: 'Campaign processing complete', 
      processedCount 
    });

  } catch (error) {
    console.error('💥 Fatal error processing campaign messages:', error);
    res.status(500).json({ error: 'Failed to process campaign messages' });
  }
} 