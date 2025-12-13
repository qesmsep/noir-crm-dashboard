import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import { DateTime } from 'luxon';

/**
 * Reservations API (Pages Router)
 * GET: Returns all reservations sorted by start_time (ascending).
 * POST: Creates a new reservation.
 * Uses service role when available to bypass RLS in production.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const client = supabaseAdmin || supabase;
      console.log('GET /api/reservations - Fetching all reservations');
      console.log('Using admin client:', !!supabaseAdmin);
      
      const { data, error } = await client
        .from('reservations')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching reservations:', error);
        return res.status(500).json({ error: 'Failed to fetch reservations' });
      }

      console.log(`GET /api/reservations - Returning ${data?.length || 0} reservations`);
      if (data && data.length > 0) {
        console.log('Sample reservation:', {
          id: data[0].id,
          start_time: data[0].start_time,
          table_id: data[0].table_id,
          phone: data[0].phone
        });
      }

      return res.status(200).json({ data });
    } catch (err) {
      console.error('Unhandled error fetching reservations:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      // Always use admin client to bypass RLS
      const client = supabaseAdmin || supabase;
      if (!supabaseAdmin) {
        console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY not set, using regular client. RLS policies may block inserts.');
      }
      const body = req.body;

      // Log incoming request data for debugging
      console.log('=== RESERVATION API REQUEST ===');
      console.log('Request body keys:', Object.keys(body));
      console.log('start_time:', body.start_time);
      console.log('end_time:', body.end_time);
      console.log('party_size:', body.party_size);
      console.log('=== END REQUEST LOG ===');

      // Fetch member profile if phone is provided and name/email are missing
      let memberData: any = null;
      if (body.phone && (!body.first_name || !body.email)) {
        console.log('Fetching member profile for phone:', body.phone);
        const phoneDigits = body.phone.replace(/\D/g, '');
        const phoneVariants = [
          body.phone,
          phoneDigits.length === 10 ? '+1' + phoneDigits : '+' + phoneDigits,
          phoneDigits.length === 11 && phoneDigits.startsWith('1') ? '+' + phoneDigits : phoneDigits,
          phoneDigits.slice(-10),
          phoneDigits
        ];
        
        for (const phoneVariant of phoneVariants) {
          const { data: member } = await client
            .from('members')
            .select('member_id, first_name, last_name, email, phone')
            .eq('phone', phoneVariant)
            .limit(1)
            .maybeSingle();
          
          if (member) {
            memberData = member;
            console.log('Found member:', member.first_name, member.last_name);
            break;
          }
        }
      }

      // Map is_member to membership_type if provided
      const membershipType = body.is_member !== undefined 
        ? (body.is_member ? 'member' : 'non-member')
        : (body.membership_type || (body.member_id || memberData ? 'member' : 'non-member'));

      // Helper function to convert empty strings to null for optional fields
      const nullIfEmpty = (value: any) => (value === '' ? null : value);
      
      // Use member data to fill in missing fields
      const firstName = nullIfEmpty(body.first_name) || memberData?.first_name || null;
      const lastName = nullIfEmpty(body.last_name) || memberData?.last_name || null;
      const email = nullIfEmpty(body.email) || memberData?.email || null;
      const memberId = body.member_id || memberData?.member_id || null;

      // Find available table if not provided
      let tableId = body.table_id;
      
      // If table_id is provided, validate it first
      if (tableId && body.start_time && body.end_time && body.party_size && !body.private_event_id) {
        const startTime = new Date(body.start_time);
        const endTime = new Date(body.end_time);
        
        // Check if table exists and can accommodate party size
        const { data: tableInfo, error: tableInfoError } = await client
          .from('tables')
          .select('id, table_number, seats')
          .eq('id', tableId)
          .single();
        
        if (tableInfoError || !tableInfo) {
          console.error('Provided table_id not found:', tableId);
          return res.status(400).json({ 
            error: 'The selected table is not available.' 
          });
        }
        
        if (tableInfo.seats < body.party_size) {
          return res.status(400).json({ 
            error: `The selected table cannot accommodate ${body.party_size} guests. Maximum capacity is ${tableInfo.seats}.` 
          });
        }
        
        // Check if table is already booked for this time (exclude cancelled reservations)
        const { data: allReservations, error: reservationsError } = await client
          .from('reservations')
          .select('id, start_time, end_time, status')
          .eq('table_id', tableId)
          .lt('start_time', endTime.toISOString())
          .gt('end_time', startTime.toISOString());
        
        if (reservationsError) {
          console.error('Error checking table availability:', reservationsError);
          return res.status(500).json({ 
            error: 'Error checking table availability. Please try again.' 
          });
        }
        
        // Filter out cancelled reservations
        const existingReservations = (allReservations || []).filter(
          (res: any) => !res.status || res.status !== 'cancelled'
        );
        
        if (existingReservations && existingReservations.length > 0) {
          console.warn(`Table ${tableId} is already booked for this time slot`);
          return res.status(400).json({ 
            error: 'This time slot is no longer available. The table has been booked by another party. Please select a different time.' 
          });
        }
        
        console.log(`Validated provided table ${tableInfo.table_number} (ID: ${tableId})`);
      }
      
      if (!tableId && body.start_time && body.end_time && body.party_size) {
        console.log('Finding available table for reservation...');
        try {
          // Get tables that fit party size
          const { data: tables } = await client
            .from('tables')
            .select('id, table_number, seats')
            .gte('seats', body.party_size)
            .order('seats', { ascending: true }); // Prefer smaller tables that fit
          
          // Filter out tables 4, 8, and 12 (not available for reservations)
          const excludedTableNumbers = [4, 8, 12];
          const availableTables = (tables || []).filter((t: any) => 
            !excludedTableNumbers.includes(parseInt(t.table_number, 10))
          );
          
          if (availableTables && availableTables.length > 0) {
            // Get existing reservations that could overlap with the requested time slot
            // We need to check for ANY overlap: (start_time < requested_end) AND (end_time > requested_start)
            // Since Supabase doesn't support complex AND conditions directly, we fetch a wider range
            // and filter in code, or use OR conditions
            const startTime = new Date(body.start_time);
            const endTime = new Date(body.end_time);
            
            // Fetch reservations that start before the requested end time and end after the requested start time
            // This covers all possible overlaps. We'll filter cancelled ones in JavaScript.
            // Try with status column first, fall back without it if column doesn't exist
            let allReservations: any[] = [];
            let reservationsError: any = null;
            
            const resultWithStatus = await client
              .from('reservations')
              .select('table_id, start_time, end_time, status')
              .not('table_id', 'is', null) // Exclude private events
              .lt('start_time', endTime.toISOString())
              .gt('end_time', startTime.toISOString());
            
            if (resultWithStatus.error) {
              // If error is about missing column, try without status
              if (resultWithStatus.error.code === '42703' || resultWithStatus.error.message?.includes('column') || resultWithStatus.error.message?.includes('does not exist')) {
                console.log('Status column not found, querying without it...');
                const resultWithoutStatus = await client
                  .from('reservations')
                  .select('table_id, start_time, end_time')
                  .not('table_id', 'is', null) // Exclude private events
                  .lt('start_time', endTime.toISOString())
                  .gt('end_time', startTime.toISOString());
                
                allReservations = resultWithoutStatus.data || [];
                reservationsError = resultWithoutStatus.error;
              } else {
                allReservations = resultWithStatus.data || [];
                reservationsError = resultWithStatus.error;
              }
            } else {
              allReservations = resultWithStatus.data || [];
            }
            
            if (reservationsError) {
              console.error('Error fetching reservations:', reservationsError);
              return res.status(500).json({ 
                error: 'Error checking table availability. Please try again.' 
              });
            }
            
            // Filter out cancelled reservations (if status column exists)
            const existingReservations = (allReservations || []).filter(
              (res: any) => !res.status || res.status !== 'cancelled'
            );
            
            console.log(`Found ${existingReservations.length} active overlapping reservations (out of ${allReservations?.length || 0} total)`);
            
            // Find first available table
            for (const table of availableTables) {
              const hasConflict = existingReservations.some((res: any) => {
                // Ensure table_id matches (using String conversion for type safety)
                if (!res.table_id || String(res.table_id) !== String(table.id)) return false;
                const resStart = new Date(res.start_time);
                const resEnd = new Date(res.end_time);
                // Check for actual overlap: (startTime < resEnd) && (endTime > resStart)
                const overlaps = (startTime < resEnd) && (endTime > resStart);
                if (overlaps) {
                  console.log(`Conflict found: Table ${table.table_number} has reservation ${res.start_time} - ${res.end_time} overlapping with requested ${body.start_time} - ${body.end_time}`);
                }
                return overlaps;
              });
              
              if (!hasConflict) {
                tableId = table.id;
                console.log(`Assigned table ${table.table_number} (ID: ${table.id})`);
                break;
              } else {
                console.log(`Table ${table.table_number} (ID: ${table.id}) is already booked for this time slot`);
              }
            }
            
            // If no table was found, reject the reservation
            if (!tableId) {
              console.warn(`No available tables found for party size ${body.party_size} at ${body.start_time} to ${body.end_time}`);
              return res.status(400).json({ 
                error: 'No tables available for the requested time slot. Please select a different time.' 
              });
            }
          } else {
            // No tables exist that can accommodate this party size
            return res.status(400).json({ 
              error: `No tables available that can accommodate ${body.party_size} guests.` 
            });
          }
        } catch (tableError) {
          console.error('Error finding available table:', tableError);
          return res.status(500).json({ 
            error: 'Error checking table availability. Please try again.' 
          });
        }
      }

      // If table_id was required but not found/assigned, reject
      if (!body.table_id && !tableId && !body.private_event_id) {
        return res.status(400).json({ 
          error: 'No table available for the requested time slot. Please select a different time.' 
        });
      }

      // Validate required fields
      if (!body.start_time) {
        console.error('start_time is required but missing from request body');
        return res.status(400).json({ error: 'start_time is required' });
      }
      if (!body.end_time) {
        console.error('end_time is required but missing from request body');
        return res.status(400).json({ error: 'end_time is required' });
      }
      if (!body.party_size) {
        console.error('party_size is required but missing from request body');
        return res.status(400).json({ error: 'party_size is required' });
      }

      // Validate against private events that block the date/time
      try {
        const reservationStart = DateTime.fromISO(body.start_time);
        const reservationEnd = DateTime.fromISO(body.end_time);
        
        // Get the local date in America/Chicago timezone
        const localDate = reservationStart.setZone('America/Chicago');
        const dateStr = localDate.toFormat('yyyy-MM-dd');
        const startOfDayLocal = localDate.startOf('day');
        const endOfDayLocal = startOfDayLocal.endOf('day');
        const startOfDayUtc = startOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
        const endOfDayUtc = endOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
        
        // Query for private events that overlap with this date
        const { data: privateEvents, error: privateEventsError } = await client
          .from('private_events')
          .select('start_time, end_time, full_day, title, status')
          .eq('status', 'active')
          .lt('start_time', endOfDayUtc)
          .gt('end_time', startOfDayUtc);
        
        if (privateEventsError) {
          console.error('Error checking private events:', privateEventsError);
          // Don't block reservation if we can't check - log and continue
        } else if (privateEvents && privateEvents.length > 0) {
          // Check for full-day events
          const fullDayEvent = privateEvents.find(ev => ev.full_day);
          if (fullDayEvent) {
            console.log(`Reservation blocked by full-day private event: ${fullDayEvent.title}`);
            return res.status(400).json({ 
              error: `This date is blocked by a private event: ${fullDayEvent.title}` 
            });
          }
          
          // Check for partial-day events that overlap with reservation time
          const reservationStartUtc = reservationStart.toUTC();
          const reservationEndUtc = reservationEnd.toUTC();
          
          const overlappingEvent = privateEvents.find(ev => {
            if (ev.full_day) return false; // Already checked above
            const evStart = DateTime.fromISO(ev.start_time);
            const evEnd = DateTime.fromISO(ev.end_time);
            // Check if reservation overlaps with event
            return (reservationStartUtc < evEnd) && (reservationEndUtc > evStart);
          });
          
          if (overlappingEvent) {
            console.log(`Reservation blocked by private event: ${overlappingEvent.title}`);
            return res.status(400).json({ 
              error: `This time slot conflicts with a private event: ${overlappingEvent.title}` 
            });
          }
        }
      } catch (privateEventCheckError) {
        console.error('Error validating against private events:', privateEventCheckError);
        // Don't block reservation if validation fails - log and continue
        // This is a safety check, not a hard requirement
      }

      // FINAL VALIDATION: Check table availability one more time right before insert
      // This prevents race conditions where another reservation was created between our check and insert
      const finalTableId = tableId || body.table_id;
      if (finalTableId && !body.private_event_id) {
        const startTime = new Date(body.start_time);
        const endTime = new Date(body.end_time);
        
        // Check for any overlapping reservations on this table (exclude cancelled reservations)
        // Only check reservations that actually have this table_id (exclude null table_ids from private events)
        // Try with status column first, fall back without it if column doesn't exist
        let allConflictingReservations: any[] = [];
        let conflictError: any = null;
        
        const conflictResultWithStatus = await client
          .from('reservations')
          .select('id, start_time, end_time, status, table_id')
          .eq('table_id', finalTableId)
          .lt('start_time', endTime.toISOString())
          .gt('end_time', startTime.toISOString());
        
        if (conflictResultWithStatus.error) {
          // If error is about missing column, try without status
          if (conflictResultWithStatus.error.code === '42703' || conflictResultWithStatus.error.message?.includes('column') || conflictResultWithStatus.error.message?.includes('does not exist')) {
            console.log('Status column not found in conflict check, querying without it...');
            const conflictResultWithoutStatus = await client
              .from('reservations')
              .select('id, start_time, end_time, table_id')
              .eq('table_id', finalTableId)
              .lt('start_time', endTime.toISOString())
              .gt('end_time', startTime.toISOString());
            
            allConflictingReservations = conflictResultWithoutStatus.data || [];
            conflictError = conflictResultWithoutStatus.error;
          } else {
            allConflictingReservations = conflictResultWithStatus.data || [];
            conflictError = conflictResultWithStatus.error;
          }
        } else {
          allConflictingReservations = conflictResultWithStatus.data || [];
        }
        
        if (conflictError) {
          console.error('Error checking for conflicts:', conflictError);
          return res.status(500).json({ 
            error: 'Error validating table availability. Please try again.' 
          });
        }
        
        // Filter out cancelled reservations (if status column exists)
        const conflictingReservations = (allConflictingReservations || []).filter(
          (res: any) => !res.status || res.status !== 'cancelled'
        );
        
        if (conflictingReservations && conflictingReservations.length > 0) {
          console.warn(`Table ${finalTableId} is already booked. Conflicting reservations:`, conflictingReservations);
          return res.status(400).json({ 
            error: 'This time slot is no longer available. The table has been booked by another party. Please select a different time.' 
          });
        }
        
        // Also verify the table exists and can accommodate the party size
        const { data: tableInfo, error: tableInfoError } = await client
          .from('tables')
          .select('id, seats')
          .eq('id', finalTableId)
          .single();
        
        if (tableInfoError || !tableInfo) {
          console.error('Table not found:', finalTableId);
          return res.status(400).json({ 
            error: 'The selected table is not available.' 
          });
        }
        
        if (tableInfo.seats < body.party_size) {
          console.warn(`Table ${finalTableId} has ${tableInfo.seats} seats but party size is ${body.party_size}`);
          return res.status(400).json({ 
            error: `The selected table cannot accommodate ${body.party_size} guests. Maximum capacity is ${tableInfo.seats}.` 
          });
        }
      } else if (!finalTableId && !body.private_event_id) {
        // If no table was assigned and this isn't a private event, we need to find one
        // This handles the case where table_id wasn't provided initially
        const startTime = new Date(body.start_time);
        const endTime = new Date(body.end_time);
        
        const { data: allTables } = await client
          .from('tables')
          .select('id, table_number, seats')
          .gte('seats', body.party_size)
          .order('seats', { ascending: true });
        
        // Filter out tables 4, 8, and 12 (not available for reservations)
        const excludedTableNumbers = [4, 8, 12];
        const availableTables = (allTables || []).filter((t: any) => 
          !excludedTableNumbers.includes(parseInt(t.table_number, 10))
        );
        
        if (!availableTables || availableTables.length === 0) {
          return res.status(400).json({ 
            error: `No tables available that can accommodate ${body.party_size} guests.` 
          });
        }
        
        // Get all reservations that could overlap (exclude cancelled reservations)
        // Filter to only reservations with table_ids (exclude private events)
        // Try with status column first, fall back without it if column doesn't exist
        let allReservationsData: any[] = [];
        let allReservationsError: any = null;
        
        const allResResultWithStatus = await client
          .from('reservations')
          .select('table_id, start_time, end_time, status')
          .not('table_id', 'is', null) // Only get reservations with table assignments
          .lt('start_time', endTime.toISOString())
          .gt('end_time', startTime.toISOString());
        
        if (allResResultWithStatus.error) {
          // If error is about missing column, try without status
          if (allResResultWithStatus.error.code === '42703' || allResResultWithStatus.error.message?.includes('column') || allResResultWithStatus.error.message?.includes('does not exist')) {
            console.log('Status column not found in final check, querying without it...');
            const allResResultWithoutStatus = await client
              .from('reservations')
              .select('table_id, start_time, end_time')
              .not('table_id', 'is', null) // Only get reservations with table assignments
              .lt('start_time', endTime.toISOString())
              .gt('end_time', startTime.toISOString());
            
            allReservationsData = allResResultWithoutStatus.data || [];
            allReservationsError = allResResultWithoutStatus.error;
          } else {
            allReservationsData = allResResultWithStatus.data || [];
            allReservationsError = allResResultWithStatus.error;
          }
        } else {
          allReservationsData = allResResultWithStatus.data || [];
        }
        
        if (allReservationsError) {
          console.error('Error fetching reservations for final check:', allReservationsError);
          return res.status(500).json({ 
            error: 'Error checking table availability. Please try again.' 
          });
        }
        
        // Filter out cancelled reservations
        const allReservations = (allReservationsData || []).filter(
          (res: any) => !res.status || res.status !== 'cancelled'
        );
        
        // Find an available table
        let foundTable = false;
        for (const table of availableTables) {
          const hasConflict = allReservations.some((res: any) => {
            // Ensure table_id matches (using String conversion for type safety)
            if (!res.table_id || String(res.table_id) !== String(table.id)) return false;
            const resStart = new Date(res.start_time);
            const resEnd = new Date(res.end_time);
            const overlaps = (startTime < resEnd) && (endTime > resStart);
            if (overlaps) {
              console.log(`Final check conflict: Table ${table.table_number} has reservation ${res.start_time} - ${res.end_time} overlapping with requested ${body.start_time} - ${body.end_time}`);
            }
            return overlaps;
          });
          
          if (!hasConflict) {
            tableId = table.id;
            foundTable = true;
            console.log(`Found available table ${table.table_number} (ID: ${table.id}) in final check`);
            break;
          }
        }
        
        if (!foundTable) {
          return res.status(400).json({ 
            error: 'No tables available for the requested time slot. Please select a different time.' 
          });
        }
      }

      // Extract only the fields that exist in the reservations table
      // The trigger function validates these columns exist, so they must be in the schema
      // Note: Some columns may not be in PostgREST schema cache - retry logic handles this
      const reservationData: any = {
        start_time: body.start_time,
        end_time: body.end_time, // Ensure end_time is always included
        party_size: body.party_size,
        event_type: nullIfEmpty(body.event_type),
        notes: nullIfEmpty(body.notes),
        phone: body.phone,
        email: email,
        first_name: firstName,
        last_name: lastName,
        source: body.source || 'website',
        membership_type: membershipType,
        // status has a default in the schema, but include it if provided
        // (will be removed by retry logic if schema cache issue)
        ...(body.status && { status: body.status }),
        // table_id - use assigned table or provided value
        ...(tableId && { table_id: tableId }),
        // member_id - include if available
        ...(memberId && { member_id: memberId }),
      };

      console.log('Attempting to insert reservation with data:', JSON.stringify(reservationData, null, 2));
      console.log('end_time in reservationData:', reservationData.end_time);
      console.log('end_time type:', typeof reservationData.end_time);
      console.log('end_time valid date?', reservationData.end_time ? !isNaN(new Date(reservationData.end_time).getTime()) : 'MISSING');
      
      let { data, error } = await client
        .from('reservations')
        .insert([reservationData])
        .select()
        .single();

      // If we get a schema cache error (PGRST204), try to identify which column and retry without it
      if (error && error.code === 'PGRST204') {
        const errorMessage = error.message || '';
        console.warn('Schema cache error detected:', errorMessage);
        
        // Extract the column name from the error message
        const columnMatch = errorMessage.match(/'(\w+)'/);
        if (columnMatch && columnMatch[1]) {
          const problematicColumn = columnMatch[1];
          
          // Never remove required fields (start_time, end_time, party_size)
          const requiredFields = ['start_time', 'end_time', 'party_size'];
          if (requiredFields.includes(problematicColumn)) {
            console.error(`ERROR: Required field ${problematicColumn} is causing schema cache error. This is a Supabase configuration issue.`);
            console.error('Please refresh the schema cache in Supabase dashboard: Settings → API → Reload schema');
            return res.status(500).json({ 
              error: 'Database schema cache error', 
              details: `Required field ${problematicColumn} not recognized. Please contact support.` 
            });
          }
          
          console.warn(`Retrying without ${problematicColumn} column`);
          
          // Remove the problematic column and retry
          const { [problematicColumn]: removed, ...reservationDataWithoutColumn } = reservationData;
          
          // Ensure required fields are still present
          if (!reservationDataWithoutColumn.start_time || !reservationDataWithoutColumn.end_time || !reservationDataWithoutColumn.party_size) {
            console.error('ERROR: Required fields would be removed by retry logic');
            return res.status(500).json({ 
              error: 'Database error', 
              details: 'Cannot remove required reservation fields' 
            });
          }
          console.log('Retrying with data:', JSON.stringify(reservationDataWithoutColumn, null, 2));
          
          const retryResult = await client
            .from('reservations')
            .insert([reservationDataWithoutColumn])
            .select()
            .single();
          
          if (retryResult.error) {
            // If retry also fails, check if it's another column issue
            if (retryResult.error.code === 'PGRST204') {
              console.error('Multiple schema cache errors detected. This indicates a Supabase schema cache issue.');
              console.error('Please refresh the schema cache in Supabase dashboard: Settings → API → Reload schema');
            }
            console.error('Retry also failed:', retryResult.error);
            error = retryResult.error;
            data = retryResult.data;
          } else {
            // Success on retry - verify it was actually saved
            console.log(`Reservation created successfully without ${problematicColumn}`);
            console.log('Created reservation:', JSON.stringify(retryResult.data, null, 2));
            
            // Verify the reservation was actually saved
            if (retryResult.data?.id) {
              const { data: verifyData, error: verifyError } = await client
                .from('reservations')
                .select('*')
                .eq('id', retryResult.data.id)
                .single();
              
              if (verifyError) {
                console.error('WARNING: Retry insert succeeded but verification failed:', verifyError);
              } else {
                console.log('Retry reservation verified in database');
              }
            }
            
            // Send notifications (same as main success path)
            const finalData = retryResult.data;
            if (finalData?.id) {
              // Send admin notification
              try {
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                await fetch(`${siteUrl}/api/reservation-notifications`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reservation_id: finalData.id, action: 'created' })
                });
              } catch (e) {
                console.error('Error sending admin notification:', e);
              }
              
              // Send confirmation SMS to customer
              try {
                console.log('Attempting to send confirmation SMS...');
                console.log('Phone check:', finalData.phone);
                console.log('OpenPhone API Key check:', !!process.env.OPENPHONE_API_KEY);
                console.log('OpenPhone Phone ID check:', !!process.env.OPENPHONE_PHONE_NUMBER_ID);
                
                if (finalData.phone && process.env.OPENPHONE_API_KEY && process.env.OPENPHONE_PHONE_NUMBER_ID) {
                  const { data: settings } = await client.from('settings').select('timezone').single();
                  const timezone = settings?.timezone || 'America/Chicago';
                  const reservationDate = DateTime.fromISO(finalData.start_time, { zone: 'utc' }).setZone(timezone);
                  const formattedDate = reservationDate.toLocaleString({
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  });
                  const formattedTime = reservationDate.toFormat('h:mm a');
                  
                  // Get customer name - check reservation first, then try to fetch from member by phone
                  let customerName = finalData.first_name || null;
                  if (!customerName && finalData.phone) {
                    console.log('Fetching member name by phone:', finalData.phone);
                    
                    // Normalize phone number for matching (remove all non-digits, then try different formats)
                    const phoneDigits = finalData.phone.replace(/\D/g, '');
                    const phoneVariants = [
                      finalData.phone, // Original format
                      phoneDigits.length === 10 ? '+1' + phoneDigits : '+' + phoneDigits, // With +1 prefix
                      phoneDigits.length === 11 && phoneDigits.startsWith('1') ? '+' + phoneDigits : phoneDigits, // With + prefix
                      phoneDigits.slice(-10), // Last 10 digits
                      phoneDigits // Digits only
                    ];
                    
                    // Try each variant until we find a match
                    for (const phoneVariant of phoneVariants) {
                      const { data: memberData, error: memberError } = await client
                        .from('members')
                        .select('first_name')
                        .eq('phone', phoneVariant)
                        .limit(1)
                        .maybeSingle();
                      
                      if (!memberError && memberData?.first_name) {
                        customerName = memberData.first_name;
                        console.log(`Found member name (${phoneVariant}):`, customerName);
                        break;
                      }
                    }
                    
                    if (!customerName) {
                      console.log('No member found with any phone variant');
                    }
                  }
                  // Fallback to Guest only if we truly can't find a name
                  if (!customerName) {
                    customerName = 'Guest';
                    console.log('No name found, using Guest');
                  }
                  
                  let formattedPhone = finalData.phone;
                  if (!formattedPhone.startsWith('+')) {
                    const digits = formattedPhone.replace(/\D/g, '');
                    formattedPhone = digits.length === 10 ? '+1' + digits : '+' + digits;
                  }
                  
                  const confirmationMessage = `Hi ${customerName}! Your reservation for ${finalData.party_size} guests on ${formattedDate} at ${formattedTime} is confirmed. See you then!`;
                  
                  console.log('Sending confirmation SMS to:', formattedPhone);
                  console.log('Message:', confirmationMessage);
                  
                  const smsResponse = await fetch('https://api.openphone.com/v1/messages', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': process.env.OPENPHONE_API_KEY,
                      'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                      to: [formattedPhone],
                      from: process.env.OPENPHONE_PHONE_NUMBER_ID,
                      content: confirmationMessage
                    })
                  });
                  
                  if (!smsResponse.ok) {
                    const errorText = await smsResponse.text();
                    console.error('Failed to send confirmation SMS:', smsResponse.status, errorText);
                  } else {
                    const smsResult = await smsResponse.json();
                    console.log('Confirmation SMS sent successfully to customer:', smsResult.id);
                  }
                } else {
                  console.log('Skipping confirmation SMS - missing phone or OpenPhone credentials');
                }
              } catch (e) {
                console.error('Error sending confirmation SMS:', e);
              }
            }
            
            return res.status(201).json({ data: retryResult.data });
          }
        }
      }

      if (error) {
        console.error('Error creating reservation:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.error('Reservation data attempted:', JSON.stringify(reservationData, null, 2));
        return res.status(500).json({ 
          error: 'Failed to create reservation',
          details: error.message || error.toString(),
          code: error.code,
          hint: error.hint
        });
      }

      console.log('Reservation created successfully:', JSON.stringify(data, null, 2));
      
      // Verify the reservation was actually created by fetching it
      if (data?.id) {
        const { data: verifyData, error: verifyError } = await client
          .from('reservations')
          .select('*')
          .eq('id', data.id)
          .single();
        
        if (verifyError) {
          console.error('WARNING: Reservation insert succeeded but verification failed:', verifyError);
          console.error('This might indicate the reservation was not actually saved.');
          // Still return success since the insert appeared to work
        } else {
          console.log('Reservation verified in database:', JSON.stringify(verifyData, null, 2));
          
          // Send admin notification (non-blocking)
          try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
            const notificationResponse = await fetch(`${siteUrl}/api/reservation-notifications`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                reservation_id: data.id,
                action: 'created'
              })
            });
            
            if (!notificationResponse.ok) {
              console.error('Failed to send admin notification:', await notificationResponse.text());
            } else {
              console.log('Admin notification sent successfully');
            }
          } catch (notifError) {
            console.error('Error sending admin notification:', notifError);
            // Don't fail the reservation if notification fails
          }
          
          // Send confirmation SMS to customer (non-blocking)
          try {
            console.log('Attempting to send confirmation SMS (main path)...');
            console.log('Phone check:', data.phone);
            console.log('OpenPhone API Key check:', !!process.env.OPENPHONE_API_KEY);
            console.log('OpenPhone Phone ID check:', !!process.env.OPENPHONE_PHONE_NUMBER_ID);
            
            if (data.phone && process.env.OPENPHONE_API_KEY && process.env.OPENPHONE_PHONE_NUMBER_ID) {
              // Get timezone from settings
              const { data: settings } = await client
                .from('settings')
                .select('timezone')
                .single();
              
              const timezone = settings?.timezone || 'America/Chicago';
              
              // Format date and time
              const reservationDate = DateTime.fromISO(data.start_time, { zone: 'utc' }).setZone(timezone);
              const formattedDate = reservationDate.toLocaleString({
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              const formattedTime = reservationDate.toFormat('h:mm a');
              
              // Get customer name - try to get from reservation or fetch member by phone
              let customerName = data.first_name || null;
              if (!customerName && data.phone) {
                console.log('Fetching member name by phone:', data.phone);
                
                // Normalize phone number for matching (remove all non-digits, then try different formats)
                const phoneDigits = data.phone.replace(/\D/g, '');
                const phoneVariants = [
                  data.phone, // Original format
                  phoneDigits.length === 10 ? '+1' + phoneDigits : '+' + phoneDigits, // With +1 prefix
                  phoneDigits.length === 11 && phoneDigits.startsWith('1') ? '+' + phoneDigits : phoneDigits, // With + prefix
                  phoneDigits.slice(-10), // Last 10 digits
                  phoneDigits // Digits only
                ];
                
                // Try each variant until we find a match
                for (const phoneVariant of phoneVariants) {
                  const { data: memberData, error: memberError } = await client
                    .from('members')
                    .select('first_name')
                    .eq('phone', phoneVariant)
                    .limit(1)
                    .maybeSingle();
                  
                  if (!memberError && memberData?.first_name) {
                    customerName = memberData.first_name;
                    console.log(`Found member name (${phoneVariant}):`, customerName);
                    break;
                  }
                }
                
                if (!customerName) {
                  console.log('No member found with any phone variant');
                }
              }
              // Fallback to Guest only if we truly can't find a name
              if (!customerName) {
                customerName = 'Guest';
                console.log('No name found, using Guest');
              }
              
              // Format phone number
              let formattedPhone = data.phone;
              if (!formattedPhone.startsWith('+')) {
                const digits = formattedPhone.replace(/\D/g, '');
                if (digits.length === 10) {
                  formattedPhone = '+1' + digits;
                } else if (digits.length === 11 && digits.startsWith('1')) {
                  formattedPhone = '+' + digits;
                }
              }
              
              const confirmationMessage = `Hi ${customerName}! Your reservation for ${data.party_size} guests on ${formattedDate} at ${formattedTime} is confirmed. See you then!`;
              
              console.log('Sending confirmation SMS to:', formattedPhone);
              console.log('Message:', confirmationMessage);
              
              const smsResponse = await fetch('https://api.openphone.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': process.env.OPENPHONE_API_KEY,
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  to: [formattedPhone],
                  from: process.env.OPENPHONE_PHONE_NUMBER_ID,
                  content: confirmationMessage
                })
              });
              
              if (!smsResponse.ok) {
                const errorText = await smsResponse.text();
                console.error('Failed to send confirmation SMS:', smsResponse.status, errorText);
              } else {
                const smsResult = await smsResponse.json();
                console.log('Confirmation SMS sent successfully to customer:', smsResult.id);
              }
            } else {
              console.log('Skipping confirmation SMS - missing phone or OpenPhone credentials');
            }
          } catch (smsError) {
            console.error('Error sending confirmation SMS:', smsError);
            // Don't fail the reservation if SMS fails
          }
        }
      } else {
        console.error('WARNING: Reservation insert returned no ID. Data:', JSON.stringify(data, null, 2));
      }
      
      return res.status(201).json({ data });
    } catch (err) {
      console.error('Unhandled error creating reservation:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

