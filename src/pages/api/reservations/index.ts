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
      if (!tableId && body.start_time && body.end_time && body.party_size) {
        console.log('Finding available table for reservation...');
        try {
          // Get tables that fit party size
          const { data: tables } = await client
            .from('tables')
            .select('id, table_number, seats')
            .gte('seats', body.party_size)
            .order('seats', { ascending: true }); // Prefer smaller tables that fit
          
          if (tables && tables.length > 0) {
            // Get existing reservations for the time slot
            const { data: existingReservations } = await client
              .from('reservations')
              .select('table_id, start_time, end_time')
              .gte('start_time', new Date(body.start_time).toISOString())
              .lte('end_time', new Date(body.end_time).toISOString());
            
            // Find first available table
            const startTime = new Date(body.start_time);
            const endTime = new Date(body.end_time);
            
            for (const table of tables) {
              const hasConflict = existingReservations?.some((res: any) => {
                if (res.table_id !== table.id) return false;
                const resStart = new Date(res.start_time);
                const resEnd = new Date(res.end_time);
                return (startTime < resEnd) && (endTime > resStart);
              });
              
              if (!hasConflict) {
                tableId = table.id;
                console.log(`Assigned table ${table.table_number} (ID: ${table.id})`);
                break;
              }
            }
          }
        } catch (tableError) {
          console.error('Error finding available table:', tableError);
          // Continue without table assignment
        }
      }

      // Extract only the fields that exist in the reservations table
      // The trigger function validates these columns exist, so they must be in the schema
      // Note: Some columns may not be in PostgREST schema cache - retry logic handles this
      const reservationData: any = {
        start_time: body.start_time,
        end_time: body.end_time,
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
          console.warn(`Retrying without ${problematicColumn} column`);
          
          // Remove the problematic column and retry
          const { [problematicColumn]: removed, ...reservationDataWithoutColumn } = reservationData;
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

