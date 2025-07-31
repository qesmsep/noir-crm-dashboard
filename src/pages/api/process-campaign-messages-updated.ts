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

// Helper function to filter members based on membership type
function filterMembersByMembershipType(members: any[], membershipTypeFilter: string[] | null): any[] {
  if (!membershipTypeFilter || membershipTypeFilter.length === 0) {
    return members; // No filter applied
  }

  return members.filter(member => {
    // Handle special filter types
    if (membershipTypeFilter.includes('all_members')) {
      return true; // Include all members
    }
    
    if (membershipTypeFilter.includes('primary_members')) {
      return member.member_type === 'primary';
    }
    
    // Check specific membership types using the existing 'membership' column
    return membershipTypeFilter.includes(member.membership);
  });
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

    // Verify token (you can implement your own token verification logic here)
    if (token !== process.env.CAMPAIGN_PROCESSING_TOKEN) {
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
      console.log(`\n📝 Processing message: ${message.name}`);
      console.log(`📝 Campaign: ${message.campaigns?.name || 'Unknown'}`);
      console.log(`📝 Recipient Type: ${message.recipient_type}`);
      console.log(`📝 Timing Type: ${message.timing_type}`);
      console.log(`📝 Specific Phone: ${message.specific_phone || 'None'}`);
      console.log(`📝 Include Ledger PDF: ${message.include_ledger_pdf}`);
      console.log(`📝 Membership Type Filter: ${message.membership_type_filter || 'None'}`);
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
          membership: 'Solo', // Default for specific phone
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
          membership: 'Solo', // Default for guests
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

      console.log('📋 Found recent reservations:', reservationData.map(r => ({
        phone: r.phone,
        start_time: r.start_time,
        party_size: r.party_size,
        created_at: r.created_at
      })));

      // Create virtual members from recent reservations
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
          membership: 'Solo', // Default for guests
          join_date: reservation.created_at, // Use created_at as trigger date
          end_time: reservation.end_time,
          party_size: reservation.party_size,
          created_at: reservation.created_at,
          updated_at: reservation.created_at
        };
      });
      
      console.log(`✅ Created ${virtualMembers.length} virtual members from recent reservations`);
      members = virtualMembers;
    } else if (triggerType === 'birthday') {
      console.log('🎂 Fetching members with birthdays...');
      // Get members with birthdays today
      const today = now.toFormat('MM-dd');
      console.log(`📅 Looking for members with birthday: ${today}`);
      
      const { data: birthdayMembers, error: birthdayError } = await supabaseAdmin
        .from('members')
        .select('*')
        .not('dob', 'is', null)
        .like('dob', `%${today}`);

      if (birthdayError) {
        console.error('❌ Error fetching birthday members:', birthdayError);
        continue;
      }

      if (!birthdayMembers || birthdayMembers.length === 0) {
        console.log('ℹ️  No members with birthdays today');
        continue;
      }

      console.log('🎂 Found birthday members:', birthdayMembers.map(m => ({
        name: `${m.first_name} ${m.last_name}`,
        dob: m.dob
      })));

      members = birthdayMembers;
      console.log(`✅ Found ${members.length} members with birthdays today`);
    } else if (triggerType === 'private_event_rsvps') {
      console.log('🎉 Fetching private event RSVPs...');
      
      if (!message.selected_private_event_id) {
        console.log('⚠️  No private event selected for this message');
        continue;
      }

      // Get RSVPs for the selected private event
      const { data: rsvpData, error: rsvpError } = await supabaseAdmin
        .from('private_event_rsvps')
        .select(`
          *,
          private_events!inner (
            id,
            name,
            event_date
          )
        `)
        .eq('private_event_id', message.selected_private_event_id)
        .eq('status', 'confirmed');

      if (rsvpError) {
        console.error('❌ Error fetching private event RSVPs:', rsvpError);
        continue;
      }

      if (!rsvpData || rsvpData.length === 0) {
        console.log('ℹ️  No confirmed RSVPs found for this private event');
        continue;
      }

      console.log('🎉 Found RSVPs:', rsvpData.map(r => ({
        name: `${r.first_name} ${r.last_name}`,
        phone: r.phone,
        event: r.private_events?.name
      })));

      // Create virtual members from RSVPs
      const virtualMembers = rsvpData.map(rsvp => {
        // Convert phone number to international format
        let formattedPhone = rsvp.phone;
        const digits = rsvp.phone.replace(/\D/g, '');
        
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
          first_name: rsvp.first_name || 'Guest',
          last_name: rsvp.last_name || '',
          email: rsvp.email || '',
          phone: formattedPhone,
          member_type: 'guest',
          membership: 'Solo', // Default for guests
          join_date: rsvp.private_events?.event_date || now.toISO(),
          created_at: rsvp.created_at,
          updated_at: rsvp.updated_at
        };
      });
      
      console.log(`✅ Created ${virtualMembers.length} virtual members from private event RSVPs`);
      members = virtualMembers;
    } else {
      console.log(`⚠️  Unknown trigger type: ${triggerType}`);
      continue;
    }

    // Apply membership type filtering
    const originalMemberCount = members.length;
    members = filterMembersByMembershipType(members, message.membership_type_filter);
    console.log(`🔍 Membership filter applied: ${originalMemberCount} -> ${members.length} members`);

    if (members.length === 0) {
      console.log('ℹ️  No members match the membership type filter');
      continue;
    }
  }

      // Process each member for this message
      for (const member of members) {
        console.log(`\n👤 Processing member: ${member.first_name} ${member.last_name} (${member.phone})`);
        
        // Determine trigger date based on member and trigger type
        let triggerDate: DateTime;
        
        if (triggerType === 'member_signup') {
          triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' });
        } else if (triggerType === 'reservation_time') {
          triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' }); // join_date contains start_time
        } else if (triggerType === 'reservation_created') {
          triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' }); // join_date contains created_at
        } else if (triggerType === 'birthday') {
          // For birthdays, use today as the trigger date
          triggerDate = now;
        } else if (triggerType === 'private_event_rsvps') {
          triggerDate = DateTime.fromISO(member.join_date, { zone: 'utc' }); // join_date contains event_date
        } else {
          console.log(`⚠️  Unknown trigger type for member: ${triggerType}`);
          continue;
        }

        console.log(`📅 Trigger date: ${triggerDate.toISO()}`);

        // Calculate target send time based on message timing
        let targetSendTime: DateTime;
        
        if (message.timing_type === 'specific_time') {
          // Parse specific time (HH:MM format)
          const timeParts = message.specific_time.split(':');
          const hours = parseInt(timeParts[0]);
          const minutes = parseInt(timeParts[1]);
          
          // Set the time on the trigger date
          targetSendTime = triggerDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
        } else if (message.timing_type === 'relative') {
          // Handle relative timing (e.g., 2 days after trigger)
          const quantity = message.relative_quantity || 1;
          const unit = message.relative_unit || 'day';
          const proximity = message.relative_proximity || 'after';
          
          // Convert database unit names to Luxon unit names
          const luxonUnit = unit === 'min' ? 'minutes' : 
                           unit === 'hr' ? 'hours' : 
                           unit === 'day' ? 'days' : 
                           unit === 'month' ? 'months' : 
                           unit === 'year' ? 'years' : 'days';
          
          targetSendTime = triggerDate.plus({
            [luxonUnit]: proximity === 'after' ? quantity : -quantity
          });
        } else if (message.timing_type === 'specific_date') {
          // Handle specific date timing
          const specificDate = DateTime.fromISO(message.specific_date, { zone: 'utc' });
          const timeParts = (message.specific_time || '10:00').split(':');
          const hours = parseInt(timeParts[0]);
          const minutes = parseInt(timeParts[1]);
          
          targetSendTime = specificDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
        } else if (message.timing_type === 'recurring') {
          // Handle recurring timing (daily, weekly, monthly, yearly)
          const recurringTime = message.recurring_time || '10:00';
          const timeParts = recurringTime.split(':');
          const hours = parseInt(timeParts[0]);
          const minutes = parseInt(timeParts[1]);
          
          // For recurring messages, use today's date with the specified time
          targetSendTime = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
        } else {
          console.log(`⚠️  Unknown timing type: ${message.timing_type}`);
          continue;
        }

        console.log(`⏰ Target send time: ${targetSendTime.toISO()}`);

        // Check if message should be sent now (within 5 minutes of target time)
        const timeDiff = targetSendTime.diff(now, 'minutes').minutes;
        console.log(`⏰ Time difference: ${timeDiff} minutes`);
        
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

        // Generate ledger PDF if requested
        let pdfUrl: string | null = null;
        if (message.include_ledger_pdf && member.member_id !== 'specific_phone_user') {
          try {
            console.log('📄 Generating ledger PDF for member:', member.member_id);
            pdfUrl = await generateLedgerPdf(member.member_id, member.account_id);
            console.log('✅ Ledger PDF generated:', pdfUrl);
          } catch (pdfError) {
            console.error('❌ Error generating ledger PDF:', pdfError);
            // Continue without PDF
          }
        }

        // Send the message via your SMS service
        try {
          console.log(`📤 Sending message to ${recipientPhone}:`);
          console.log(`📝 Content: ${messageContent}`);
          if (pdfUrl) {
            console.log(`📄 PDF URL: ${pdfUrl}`);
          }

          // Here you would integrate with your SMS service
          // For now, we'll just log the message
          console.log('✅ Message would be sent via SMS service');
          
          // You can add your SMS service integration here
          // Example: await sendSMS(recipientPhone, messageContent, pdfUrl);
          
          processedCount++;
          
        } catch (smsError) {
          console.error('❌ Error sending SMS:', smsError);
        }
      }
    }

    console.log(`\n🎉 Campaign processing completed!`);
    console.log(`📊 Total messages processed: ${processedCount}`);
    
    return res.status(200).json({
      message: 'Campaign processing completed',
      processed: processedCount
    });

  } catch (error: any) {
    console.error('❌ Error in campaign processing:', error);
    return res.status(500).json({ 
      error: 'Campaign processing failed',
      details: error.message 
    });
  }
} 