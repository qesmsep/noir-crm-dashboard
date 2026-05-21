import { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { DateTime } from 'luxon';

// Constants for message timing windows
const MESSAGE_SEND_WINDOW_FUTURE_MINUTES = 5; // Send messages within 5 minutes of target time
const MESSAGE_SEND_WINDOW_PAST_MINUTES = 60; // Don't send messages more than 60 minutes late

// Phone number utilities
function maskPhoneNumber(phone: string): string {
  // Show only last 4 digits for privacy
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    return '***-' + digits.slice(-4);
  }
  return '****';
}

function formatPhoneForStorage(phone: string): string {
  // Handle null/undefined/empty strings
  if (!phone) {
    return '';
  }

  // Check if already in international format first (before removing non-digits)
  if (phone.startsWith('+')) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 11) {
      return phone; // Already in valid international format
    }
  }

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Return empty string if no digits
  if (!digits) {
    return '';
  }

  // Convert to international format +1XXXXXXXXXX
  if (digits.length === 10) {
    return '+1' + digits;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  }

  return '+' + digits; // Add + prefix for other international numbers
}

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

    if (token !== process.env.CRON_SECRET_TOKEN) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  try {
    console.log('🚀 Starting campaign message processing...');
    console.log('==========================================');

    // Get all active campaign messages from the new table
    const { data: rawMessages, error: messagesError } = await supabaseAdmin
      .from('campaign_messages')
      .select(`
        *,
        campaigns!inner (
          id,
          name,
          trigger_type,
          applies_to_all_locations,
          selected_private_event_id,
          campaign_locations(
            location_id,
            location:locations!inner(id, name, slug)
          )
        )
      `)
      .eq('is_active', true);

    if (messagesError) {
      console.error('❌ Error fetching campaign messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch campaign messages' });
    }

    // Filter out campaigns with invalid location assignments
    const messages = rawMessages?.filter(msg => {
      if (!msg.campaigns) {
        console.log('⚠️ Skipping message with no campaign:', msg.id);
        return false;
      }
      // If applies to all locations, it's valid
      if (msg.campaigns.applies_to_all_locations) return true;
      // If location-specific, ensure at least one valid location exists
      const hasValidLocations = msg.campaigns.campaign_locations?.some(cl => cl.location !== null);
      if (!hasValidLocations) {
        const totalLocations = msg.campaigns.campaign_locations?.length || 0;
        const nullLocations = msg.campaigns.campaign_locations?.filter(cl => cl.location === null).length || 0;
        console.log('⚠️ Skipping campaign with no valid locations:', {
          campaign: msg.campaigns.name,
          campaignId: msg.campaigns.id,
          totalLocationAssignments: totalLocations,
          nullLocationCount: nullLocations,
          reason: nullLocations > 0 ? 'Locations have been deleted' : 'No locations assigned'
        });
      }
      return hasValidLocations;
    }) || [];

    if (!messages || messages.length === 0) {
      console.log('ℹ️  No active campaign messages found');
      return res.status(200).json({ message: 'No active campaign messages found' });
    }

    const now = DateTime.now();
    const defaultTimezone = 'America/Chicago'; // Default fallback timezone
    console.log('⏰ Current time (UTC):', now.toISO());
    console.log('⏰ Current time (default timezone):', now.setZone(defaultTimezone).toISO());
    console.log(`📊 Found ${messages.length} active campaign messages to process`);
    let processedCount = 0;

          for (const message of messages) {
        console.log('\n📝 ==========================================');
        console.log(`📝 Processing campaign message: ${message.name}`);
        console.log(`🔍 DEBUG: Starting detailed processing for message: ${message.name}`);
        console.log(`📝 Message ID: ${message.id}`);
        console.log(`📝 Campaign ID: ${message.campaigns?.id || 'Unknown'}`);
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

        // Determine timezone - default to CST, will be updated for location-specific campaigns
        let businessTimezone = defaultTimezone;

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

          // Extract location IDs from campaign
          const rawLocationIds = message.campaigns?.applies_to_all_locations
            ? null
            : message.campaigns?.campaign_locations?.map(cl => cl.location_id).filter(Boolean);

          // Validate all location IDs are valid UUIDs to prevent SQL injection
          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const campaignLocationIds = rawLocationIds?.filter(id => UUID_REGEX.test(id)) || null;

          if (rawLocationIds && rawLocationIds.length > 0 && (!campaignLocationIds || campaignLocationIds.length === 0)) {
            console.error('⚠️ All location IDs failed UUID validation, skipping campaign');
            continue;
          }

          console.log('📍 Campaign location filter:', {
            applies_to_all_locations: message.campaigns?.applies_to_all_locations,
            location_ids: campaignLocationIds
          });

          // Update timezone based on campaign type and locations
          // For reservation campaigns, use location timezone if available
          // KNOWN LIMITATION: Multi-location campaigns with different timezones
          // Currently uses the first location's timezone for ALL messages in the campaign.
          // TODO: Future enhancement - process each location's messages in their respective timezone
          // Create GitHub issue to track: https://github.com/qesmsep/noir-crm-dashboard/issues
          if ((triggerType === 'reservation_time' || triggerType === 'reservation_created') &&
              campaignLocationIds && campaignLocationIds.length > 0) {
            const { data: locationData } = await supabaseAdmin
              .from('locations')
              .select('timezone')
              .eq('id', campaignLocationIds[0])
              .single();

            if (locationData?.timezone) {
              businessTimezone = locationData.timezone;
              console.log(`📍 Using location timezone: ${businessTimezone} (location: ${campaignLocationIds[0]})`);
              if (campaignLocationIds.length > 1) {
                console.log(`⚠️  WARNING: Multi-location campaign using only first location's timezone. ${campaignLocationIds.length - 1} other locations may have different timezones.`);
              }
            } else {
              console.log(`⚠️  Location ${campaignLocationIds[0]} has no timezone, using default: ${businessTimezone}`);
            }
          } else {
            console.log(`🕐 Using default timezone: ${businessTimezone} (trigger: ${triggerType})`);
          }

          if (triggerType === 'member_signup') {
            console.log('👥 Fetching members for member_signup trigger...');
            // Get members who joined recently (within last 30 days)
            const thirtyDaysAgo = now.minus({ days: 30 }).toISO();
            console.log(`📅 Looking for members who joined after: ${thirtyDaysAgo}`);

            let query = supabaseAdmin
              .from('members')
              .select('member_id, account_id, first_name, last_name, email, phone, member_type, join_date, location_id, status, created_at, updated_at')
              .gte('join_date', thirtyDaysAgo)
              .order('join_date', { ascending: false });

            // Apply location filter if campaign is location-specific
            if (campaignLocationIds && campaignLocationIds.length > 0) {
              query = query.in('location_id', campaignLocationIds);
              console.log(`📍 Filtering members by location_ids: ${campaignLocationIds.join(', ')}`);
            }

            const { data: recentMembers, error: membersError } = await query;

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

            let reservationQuery = supabaseAdmin
          .from('reservations')
          .select('phone, start_time, end_time, party_size, first_name, last_name, email, location_id')
          .gte('start_time', searchStart) // Include reservations from 1 hour ago
          .lte('start_time', searchEnd); // Up to 1 day in the future

            // Apply location filter if campaign is location-specific
            if (campaignLocationIds && campaignLocationIds.length > 0) {
          reservationQuery = reservationQuery.in('location_id', campaignLocationIds);
          console.log(`📍 Filtering reservations by location_ids: ${campaignLocationIds.join(', ')}`);
            }

            const { data: reservationData, error: reservationError } = await reservationQuery;

            if (reservationError) {
          console.error('❌ Error fetching reservations:', reservationError);
          continue;
            }

            if (!reservationData || reservationData.length === 0) {
          console.log('ℹ️  No upcoming reservations found');
          continue;
            }

            console.log('📋 Found reservations:', reservationData.map(r => ({
          phone: maskPhoneNumber(r.phone || ''),
          start_time: r.start_time,
          party_size: r.party_size
            })));

            // Store reservations for later use
            reservations = reservationData;

            // Get unique phone numbers from reservations
            const phoneNumbers = [...new Set(reservations.map(r => r.phone).filter(Boolean))];
            console.log('📱 Found phone numbers in reservations:', phoneNumbers.map(maskPhoneNumber));
            
            if (phoneNumbers.length === 0) {
          console.log('⚠️  No phone numbers found in reservations');
          continue;
            }
            
            // For reservation_time triggers, we'll create "virtual members" from reservations
            // This allows sending messages to anyone with a reservation, not just members
            const virtualMembers = reservations.map(reservation => {
          // Convert phone number to international format using utility (guard against null)
          const formattedPhone = formatPhoneForStorage(reservation.phone || '');

          return {
            member_id: crypto.randomUUID(), // Generate proper UUID
            account_id: crypto.randomUUID(), // Generate proper UUID
            first_name: reservation.first_name || 'Guest', // Use real first name from reservation
            last_name: reservation.last_name || '', // Use real last name from reservation
            email: reservation.email || '', // Use real email from reservation
            phone: formattedPhone, // Use the formatted phone number
            member_type: 'guest',
            join_date: reservation.start_time, // Store start_time in join_date
            end_time: reservation.end_time, // Store end_time for after messages
            party_size: reservation.party_size, // Store party_size for placeholders
            location_id: reservation.location_id, // Preserve location for filtering
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

            let reservationQuery = supabaseAdmin
          .from('reservations')
          .select('phone, start_time, end_time, party_size, created_at, first_name, last_name, email, location_id')
          .gte('created_at', searchStart) // Reservations created in last 24 hours
          .lte('created_at', searchEnd); // Up to now

            // Apply location filter if campaign is location-specific
            if (campaignLocationIds && campaignLocationIds.length > 0) {
          reservationQuery = reservationQuery.in('location_id', campaignLocationIds);
          console.log(`📍 Filtering reservations by location_ids: ${campaignLocationIds.join(', ')}`);
            }

            const { data: reservationData, error: reservationError } = await reservationQuery;

            if (reservationError) {
          console.error('❌ Error fetching recent reservations:', reservationError);
          continue;
            }

            if (!reservationData || reservationData.length === 0) {
          console.log('ℹ️  No recently created reservations found');
          continue;
            }

            console.log('📋 Found recently created reservations:', reservationData.map(r => ({
          phone: maskPhoneNumber(r.phone || ''),
          created_at: r.created_at,
          first_name: r.first_name,
          last_name: r.last_name
            })));

            // Create virtual members from recently created reservations
            const virtualMembers = reservationData.map(reservation => {
          // Convert phone number to international format using utility (guard against null)
          const formattedPhone = formatPhoneForStorage(reservation.phone || '');

          return {
            member_id: crypto.randomUUID(),
            account_id: crypto.randomUUID(),
            first_name: reservation.first_name || 'Guest', // Use real first name from reservation
            last_name: reservation.last_name || '', // Use real last name from reservation
            email: reservation.email || '', // Use real email from reservation
            phone: formattedPhone,
            member_type: 'guest',
            join_date: reservation.created_at, // Use created_at as trigger point
            end_time: reservation.end_time,
            party_size: reservation.party_size,
            location_id: reservation.location_id, // Preserve location for filtering
            created_at: reservation.created_at,
            updated_at: reservation.created_at
          };
        });
        
        console.log(`✅ Created ${virtualMembers.length} virtual members from recent reservations`);
        members = virtualMembers;
          } else if (triggerType === 'member_birthday') {
            console.log('🎂 Fetching members for birthday check...');
            // Get all members with dob and filter by birthday in JavaScript
            let query = supabaseAdmin
          .from('members')
          .select('member_id, account_id, first_name, last_name, email, phone, member_type, join_date, dob, location_id, status, created_at, updated_at')
          .not('dob', 'is', null);

            // Apply location filter if campaign is location-specific
            if (campaignLocationIds && campaignLocationIds.length > 0) {
          query = query.in('location_id', campaignLocationIds);
          console.log(`📍 Filtering members by location_ids: ${campaignLocationIds.join(', ')}`);
            }

            const { data: allMembers, error: membersError } = await query;

            if (membersError) {
          console.error('❌ Error fetching members for birthday check:', membersError);
          continue;
            }

            console.log(`📊 Found ${allMembers?.length || 0} members with DOB`);

            // Filter members whose birthday is today (in business timezone)
            const today = now.setZone(businessTimezone).toFormat('MM-dd');
            console.log(`📅 Looking for birthdays on: ${today} (${businessTimezone})`);

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
            let query = supabaseAdmin
          .from('members')
          .select('member_id, account_id, first_name, last_name, email, phone, member_type, join_date, location_id, status, created_at, updated_at')
          .not('join_date', 'is', null);

            // Apply location filter if campaign is location-specific
            if (campaignLocationIds && campaignLocationIds.length > 0) {
          query = query.in('location_id', campaignLocationIds);
          console.log(`📍 Filtering members by location_ids: ${campaignLocationIds.join(', ')}`);
            }

            const { data: allMembers, error: membersError } = await query;

            if (membersError) {
          console.error('❌ Error fetching members for renewal check:', membersError);
          continue;
            }

            console.log(`📊 Found ${allMembers?.length || 0} members with join_date`);

            // Filter members whose renewal date is today (calculated from join_date, in business timezone)
            const today = now.setZone(businessTimezone).toFormat('yyyy-MM-dd');
            console.log(`📅 Looking for renewals on: ${today} (${businessTimezone})`);

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
            // Get all active members for all_members campaigns
            let query = supabaseAdmin
          .from('members')
          .select('member_id, account_id, first_name, last_name, email, phone, member_type, join_date, location_id, status, created_at, updated_at')
          .in('status', ['active', 'paused']);

            // Apply location filter if campaign is location-specific
            if (campaignLocationIds && campaignLocationIds.length > 0) {
          query = query.in('location_id', campaignLocationIds);
          console.log(`📍 Filtering members by location_ids: ${campaignLocationIds.join(', ')}`);
            }

            const { data: allMembers, error: membersError } = await query;

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

      // Pre-fetch private event data if needed (to avoid N+1 queries)
      let privateEventData: any = null;
      if (triggerType === 'private_event' && message.campaigns?.selected_private_event_id) {
        const { data: eventData } = await supabaseAdmin
          .from('private_events')
          .select('title, event_date, event_time')
          .eq('id', message.campaigns.selected_private_event_id)
          .single();

        if (eventData) {
          privateEventData = eventData;
          console.log(`📅 Pre-fetched private event data: ${eventData.title}`);
        }
      }

      // Pre-fetch primary member phones if needed (to avoid N+1 queries for all_members campaigns)
      const primaryMemberPhones: Map<string, string> = new Map();
      if (message.recipient_type === 'member' && members.length > 0) {
        const accountIds = [...new Set(members
          .filter(m => m.member_type !== 'guest' && m.member_type !== 'specific_phone')
          .map(m => m.account_id))];

        if (accountIds.length > 0) {
          const { data: primaryMembers } = await supabaseAdmin
            .from('members')
            .select('account_id, phone')
            .in('account_id', accountIds)
            .eq('member_type', 'primary');

          if (primaryMembers) {
            primaryMembers.forEach(pm => {
              if (pm.phone) primaryMemberPhones.set(pm.account_id, pm.phone);
            });
            console.log(`📱 Pre-fetched ${primaryMemberPhones.size} primary member phones`);
          }
        }
      }

      for (const member of members) {
            try {
          console.log(`\n👤 Processing member: ${member.first_name} ${member.last_name} (${maskPhoneNumber(member.phone || '')})`);

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
              phone: maskPhoneNumber(member.phone || ''),
              start_time: reservationStartTime,
              end_time: reservationEndTime
            });
            
            // Use start_time for 'before' messages and end_time for 'after' messages
            const isAfterMessage = message.relative_proximity === 'after';
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
            // Send at specific time on trigger date (or specific date if provided)
            // NOTE: specific_time_quantity, specific_time_unit, specific_time_proximity fields are deprecated
            // These offset fields were removed as they were not in the actual database schema
            // Existing campaigns using 'specific_time' will send at the specified time on the trigger date
            // without any day offset calculation. If offset behavior is needed, use 'relative' timing_type instead.
            const [hours, minutes] = message.specific_time?.split(':').map(Number) || [10, 0];

            console.log(`Specific time: ${hours}:${minutes} on ${message.specific_date || 'trigger date'}`);

            // Use specific_date if provided, otherwise use trigger date
            let targetDate = triggerDate;
            if (message.specific_date) {
              targetDate = DateTime.fromISO(message.specific_date, { zone: businessTimezone });
              console.log(`Using specific date: ${targetDate.toISO()}`);
            }

            // Set the specific time on the target date
            targetSendTime = targetDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
            console.log(`Target send time: ${targetSendTime.toISO()}`);
          } else if (message.timing_type === 'relative') {
            // Send based on relative time to trigger (e.g., "2 hours before reservation")
            const [hours, minutes] = message.relative_time?.split(':').map(Number) || [10, 0];
            const quantity = message.relative_quantity || 0;
            const unit = message.relative_unit || 'day';
            const proximity = message.relative_proximity || 'after';

            console.log(`Relative timing: ${quantity} ${unit} ${proximity} trigger at ${hours}:${minutes}`);

            // Convert database unit names to Luxon unit names
            const luxonUnit = unit === 'minute' ? 'minutes' :
                             unit === 'hour' ? 'hours' :
                             unit === 'day' ? 'days' :
                             unit === 'week' ? 'weeks' :
                             unit === 'month' ? 'months' :
                             unit === 'year' ? 'years' : 'days';

            // Calculate the relative date
            let relativeDate = triggerDate;
            if (quantity > 0) {
              relativeDate = triggerDate.plus({
                [luxonUnit]: proximity === 'after' ? quantity : -quantity
              });
            }

            // Set the specific time on the relative date
            targetSendTime = relativeDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
            console.log(`Relative send time: ${targetSendTime.toISO()} (trigger: ${triggerDate.toISO()})`);
          } else {
            console.error(`❌ ERROR: Unknown timing_type: ${message.timing_type} for message ${message.id} (${message.name})`);

            // Log to scheduled_messages table with failed status for visibility
            const errorMessage = `Unknown timing_type: ${message.timing_type}`;
            await supabaseAdmin
              .from('scheduled_messages')
              .insert({
                member_id: member.member_id,
                campaign_id: message.campaigns?.id || null,
                campaign_message_id: message.id,
                message_content: message.content,
                scheduled_for: now.toISO(),
                status: 'failed',
                error_message: errorMessage,
                created_at: now.toISO(),
                updated_at: now.toISO()
              });

            // Also alert ops team if this is a critical campaign
            if (message.campaigns?.name?.includes('URGENT') || message.campaigns?.name?.includes('CRITICAL')) {
              console.error(`🚨 CRITICAL: Campaign "${message.campaigns.name}" has message with unknown timing_type`);
            }

            continue;
          }

          // Check if message should be sent now (within 5 minutes of target time)
          const timeDiff = targetSendTime.diff(now, 'minutes').minutes;
          console.log(`⏰ Campaign message ${message.name}: target time ${targetSendTime.toISO()}, now ${now.toISO()}, diff ${timeDiff} minutes`);
          console.log(`⏰ Campaign message ${message.name}: target time (business): ${targetSendTime.setZone(businessTimezone).toISO()}, now (business): ${now.setZone(businessTimezone).toISO()}`);
          console.log(`⏰ Timing check: timeDiff=${timeDiff}, should send: ${timeDiff <= 5 && timeDiff >= -60}`);
          
          // Only send if we're within the configured time window
          if (timeDiff > MESSAGE_SEND_WINDOW_FUTURE_MINUTES || timeDiff < -MESSAGE_SEND_WINDOW_PAST_MINUTES) {
            console.log(`⏳ Message not ready to send yet (diff: ${timeDiff} minutes, window: +${MESSAGE_SEND_WINDOW_FUTURE_MINUTES}/-${MESSAGE_SEND_WINDOW_PAST_MINUTES})`);
            continue; // Not time to send yet
          }
          
          console.log(`✅ Message ready to send! (diff: ${timeDiff} minutes)`);

          // Determine recipient phone
          let recipientPhone = member.phone;

          // For reservation campaigns, ALWAYS use the phone from the reservation
          if (triggerType === 'reservation_time' || triggerType === 'reservation_created') {
            recipientPhone = member.phone; // This is the phone number from the reservation
          } else if (message.recipient_type === 'member') {
            // For member-based campaigns (not reservations), get primary member's phone
            if (member.member_type !== 'guest' && member.member_type !== 'specific_phone') {
              // Use pre-fetched primary member phone data
              const primaryPhone = primaryMemberPhones.get(member.account_id);
              if (primaryPhone) {
                recipientPhone = primaryPhone;
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
            // Format reservation time and date
            if (member.join_date) {
              const reservationDateTime = DateTime.fromISO(member.join_date, { zone: 'utc' }).setZone(businessTimezone);

              // {{reservation_time}} - Time only (e.g., "7:00 PM")
              const formattedTime = reservationDateTime.toFormat('h:mm a');
              messageContent = messageContent.replace(/\{\{reservation_time\}\}/g, formattedTime);

              // {{reservation_date}} - Date only (e.g., "March 15, 2024")
              const formattedDate = reservationDateTime.toFormat('MMMM d, yyyy');
              messageContent = messageContent.replace(/\{\{reservation_date\}\}/g, formattedDate);
            }

            // {{party_size}} - Number of guests
            if (member.party_size) {
              messageContent = messageContent.replace(/\{\{party_size\}\}/g, member.party_size.toString());
            }
          }

          // Add private event placeholders for private_event trigger
          if (triggerType === 'private_event' && privateEventData) {
            const eventData = privateEventData;

            if (eventData) {
              // {{event_name}} - Event title
              messageContent = messageContent.replace(/\{\{event_name\}\}/g, eventData.title || '');

              // {{event_date}} - Event date (e.g., "March 15, 2024")
              if (eventData.event_date) {
                const eventDate = DateTime.fromISO(eventData.event_date).toFormat('MMMM d, yyyy');
                messageContent = messageContent.replace(/\{\{event_date\}\}/g, eventDate);
              }

              // {{event_time}} - Event time (e.g., "7:00 PM")
              if (eventData.event_time) {
                let eventTime;
                // Try parsing as ISO datetime first, then as time-only format
                const isoDateTime = DateTime.fromISO(eventData.event_time, { zone: businessTimezone });
                if (isoDateTime.isValid) {
                  eventTime = isoDateTime.toFormat('h:mm a');
                } else {
                  // Try parsing as time-only format HH:mm:ss or HH:mm
                  const timeOnly = DateTime.fromFormat(eventData.event_time, 'HH:mm:ss', { zone: businessTimezone });
                  if (timeOnly.isValid) {
                    eventTime = timeOnly.toFormat('h:mm a');
                  } else {
                    const timeOnlyShort = DateTime.fromFormat(eventData.event_time, 'HH:mm', { zone: businessTimezone });
                    eventTime = timeOnlyShort.isValid ? timeOnlyShort.toFormat('h:mm a') : eventData.event_time;
                  }
                }
                messageContent = messageContent.replace(/\{\{event_time\}\}/g, eventTime);
              }
            }
          }
          
          // Add ledger PDF link if enabled (only for actual members, not virtual members)
          if (message.include_ledger_pdf &&
              triggerType !== 'reservation_time' &&
              triggerType !== 'reservation_created' &&
              member.member_type !== 'guest' &&
              member.member_type !== 'specific_phone') {
            try {
              console.log('Generating ledger PDF for campaign message');

              // Validate member exists in database before generating PDF
              const { data: realMember, error: memberError } = await supabaseAdmin
                .from('members')
                .select('member_id, account_id')
                .eq('member_id', member.member_id)
                .single();

              if (!memberError && realMember) {
                const pdfUrl = await generateLedgerPdf(member.member_id, member.account_id);
                messageContent += `\n\nYour ledger statement: ${pdfUrl}`;
                console.log('Added ledger PDF link to message:', pdfUrl);
              } else {
                console.log('⚠️ Skipping PDF generation: member not found in database');
              }
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
                .eq('id', message.campaigns?.id || '')
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

                // Fetch Noir Member Events for the specified date range using utility
                const { getNoirMemberEvents } = await import('@/lib/events');
                const { events, error: eventsError } = await getNoirMemberEvents(campaignData.event_list_date_range);

                if (!eventsError) {
                  
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
                  console.error('❌ Failed to fetch event list:', eventsError);
                }
              } else {
                console.log('ℹ️  Event list not enabled for this campaign');
              }
            } catch (error) {
              console.error('❌ Error adding event list to message:', error);
              // Continue without the event list rather than failing the entire message
            }
          }

          // Format phone number for OpenPhone using utility
          const formattedPhone = formatPhoneForStorage(recipientPhone);

          // Check if message already sent
          // For recurring triggers (birthday, renewal), only check if sent TODAY
          // This allows the same message to be sent annually/monthly
          let duplicateCheckQuery = supabaseAdmin
            .from('scheduled_messages')
            .select('id')
            .eq('campaign_message_id', message.id)
            .eq('phone_number', formattedPhone)
            .eq('status', 'sent');

          // For recurring triggers, only check TODAY's sends to allow annual/monthly repeats
          if (triggerType === 'member_birthday' || triggerType === 'member_renewal') {
            const todayStart = now.setZone(businessTimezone).startOf('day').toISO();
            const todayEnd = now.setZone(businessTimezone).endOf('day').toISO();
            // Check both scheduled_time (for pending) and sent_time (for sent) to catch all today's messages
            // Use proper AND grouping: (scheduled_time between today) OR (sent_time between today)
            duplicateCheckQuery = duplicateCheckQuery
              .or(`and(scheduled_time.gte.${todayStart},scheduled_time.lte.${todayEnd}),and(sent_time.gte.${todayStart},sent_time.lte.${todayEnd})`);
            console.log(`🔄 Birthday/Renewal campaign - checking for duplicates TODAY only in ${businessTimezone} (${todayStart} to ${todayEnd})`);
          }

          const { data: existingMessages } = await duplicateCheckQuery.limit(1);

          if (existingMessages && existingMessages.length > 0) {
            console.log(`⏭️  Message already sent for campaign message ${message.id} to phone ${maskPhoneNumber(formattedPhone)}`);
            continue;
          }

          // Update OpenPhone contact with member info (with 🖤 prefix for members)
          // Skip contact update for virtual members (guests from reservations)
          if (member.member_type !== 'guest' && member.member_type !== 'specific_phone') {
            try {
              console.log('📇 Updating OpenPhone contact for member...');

              // Create contact name with 🖤 prefix for Quo identification
              const openphoneFirstName = `🖤${member.first_name || 'Member'}`;
              const openphoneLastName = member.last_name || '';

              // Search for existing contact
              const searchResponse = await fetch(`https://api.openphone.com/v1/contacts?phone_number=${formattedPhone}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': process.env.OPENPHONE_API_KEY || '',
                  'Accept': 'application/json'
                }
              });

              let contactId: string | null = null;
              if (searchResponse.ok) {
                const searchResult = await searchResponse.json();
                if (searchResult.data && searchResult.data.length > 0) {
                  contactId = searchResult.data[0].id;
                  console.log('📇 Found existing OpenPhone contact:', contactId);
                }
              }

              // Prepare contact data
              const contactPayload = {
                first_name: openphoneFirstName,
                last_name: openphoneLastName,
                phone_number: formattedPhone,
                email: member.email || '',
                company: '',
                notes: ''
              };

              // Update or create contact
              let contactResponse: Response;
              if (contactId) {
                console.log('📇 Updating existing contact with member info');
                contactResponse = await fetch(`https://api.openphone.com/v1/contacts/${contactId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': process.env.OPENPHONE_API_KEY || '',
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify(contactPayload)
                });
              } else {
                console.log('📇 Creating new contact with member info');
                contactResponse = await fetch('https://api.openphone.com/v1/contacts', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': process.env.OPENPHONE_API_KEY || '',
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify(contactPayload)
                });
              }

              if (contactResponse.ok) {
                console.log('✅ OpenPhone contact updated successfully');
              } else {
                const errorText = await contactResponse.text();
                console.error('⚠️  Failed to update OpenPhone contact:', errorText);
                // Continue sending message even if contact update fails
              }
            } catch (contactError) {
              console.error('⚠️  Error updating OpenPhone contact:', contactError);
              // Continue sending message even if contact update fails
            }
          }

          // Send SMS via OpenPhone API
          console.log('📤 Sending SMS via OpenPhone API...');
          console.log('🔑 OpenPhone API Key exists:', !!process.env.OPENPHONE_API_KEY);
          console.log('📱 Recipient phone:', maskPhoneNumber(formattedPhone));
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
            console.log(`✅ Successfully sent campaign message to ${maskPhoneNumber(formattedPhone)}`);
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