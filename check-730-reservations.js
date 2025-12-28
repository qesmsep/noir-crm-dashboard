/**
 * Script to check reservations at 7:30pm today
 * Run: node check-730-reservations.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check730Reservations() {
  console.log('Checking reservations for 7:30pm today...\n');
  
  try {
    // Get today's date in America/Chicago timezone
    const today = DateTime.now().setZone('America/Chicago');
    const dateStr = today.toFormat('yyyy-MM-dd');
    console.log(`Today's date (America/Chicago): ${dateStr}`);
    
    // 7:30pm in America/Chicago
    const time730Local = today.set({ hour: 19, minute: 30, second: 0, millisecond: 0 });
    const time730Utc = time730Local.toUTC();
    
    // Calculate slot duration (90 min for party <= 2, 120 min for party > 2)
    // We'll check for both durations
    const slotEnd90 = time730Utc.plus({ minutes: 90 });
    const slotEnd120 = time730Utc.plus({ minutes: 120 });
    
    console.log(`7:30pm local: ${time730Local.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')}`);
    console.log(`7:30pm UTC: ${time730Utc.toISO()}`);
    console.log(`Slot end (90min): ${slotEnd90.toISO()}`);
    console.log(`Slot end (120min): ${slotEnd120.toISO()}\n`);
    
    // Get all tables
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number, seats')
      .order('seats', { ascending: true });
    
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      return;
    }
    
    console.log(`Total tables: ${tables?.length || 0}`);
    tables?.forEach(t => {
      console.log(`  Table ${t.table_number}: ${t.seats} seats (ID: ${t.id})`);
    });
    console.log('');
    
    // Get start and end of day in UTC for querying
    const startOfDayLocal = today.startOf('day');
    const endOfDayLocal = today.endOf('day');
    const startOfDayUtc = startOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
    const endOfDayUtc = endOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
    
    console.log(`Querying reservations for date range:`);
    console.log(`  Local day: ${startOfDayLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')} to ${endOfDayLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')}`);
    console.log(`  UTC range: ${startOfDayUtc} to ${endOfDayUtc}\n`);
    
    // Fetch all reservations that overlap with today
    // Query without status column first (it may not exist)
    const { data: allReservations, error: resError } = await supabase
      .from('reservations')
      .select('id, table_id, start_time, end_time, party_size, first_name, last_name, phone')
      .lt('start_time', endOfDayUtc)
      .gt('end_time', startOfDayUtc)
      .order('start_time', { ascending: true });
    
    if (resError) {
      console.error('Error fetching reservations:', resError);
      return;
    }
    
    // Filter out private events (those without table_id)
    const activeReservations = (allReservations || []).filter((res) => {
      // Must have a table_id (exclude private events)
      return res.table_id;
    });
    
    console.log(`Total reservations for today: ${allReservations?.length || 0}`);
    console.log(`Active reservations (with table_id, not cancelled): ${activeReservations.length}\n`);
    
    if (activeReservations.length > 0) {
      console.log('Active reservations:');
      activeReservations.forEach((res, idx) => {
        const resStartLocal = DateTime.fromISO(res.start_time).setZone('America/Chicago');
        const resEndLocal = DateTime.fromISO(res.end_time).setZone('America/Chicago');
        console.log(`\n${idx + 1}. Reservation ID: ${res.id}`);
        console.log(`   Table: ${res.table_id}`);
        console.log(`   Time: ${resStartLocal.toFormat('HH:mm')}-${resEndLocal.toFormat('HH:mm')} (${res.party_size} guests)`);
        console.log(`   Name: ${res.first_name || ''} ${res.last_name || ''}`);
        console.log(`   Phone: ${res.phone || 'N/A'}`);
        console.log(`   Status: ${res.status || 'active'}`);
        console.log(`   UTC: ${res.start_time} to ${res.end_time}`);
      });
    }
    
    // Now check which tables are available at 7:30pm for different party sizes
    console.log('\n\n=== AVAILABILITY CHECK FOR 7:30PM ===\n');
    
    for (const partySize of [2, 4, 6, 8, 10, 12]) {
      console.log(`\nParty size: ${partySize} guests`);
      const slotDuration = partySize <= 2 ? 90 : 120;
      const slotEnd = time730Utc.plus({ minutes: slotDuration });
      
      // Get tables that fit this party size
      const suitableTables = (tables || []).filter(t => parseInt(t.seats) >= partySize);
      console.log(`  Tables that fit ${partySize} guests: ${suitableTables.length}`);
      
      if (suitableTables.length === 0) {
        console.log(`  ❌ NO TABLES AVAILABLE (no tables fit ${partySize} guests)`);
        continue;
      }
      
      // Check each table for conflicts
      const availableTables = [];
      for (const table of suitableTables) {
        const tableReservations = activeReservations.filter((r) => 
          String(r.table_id) === String(table.id)
        );
        
        let hasConflict = false;
        for (const res of tableReservations) {
          const resStart = DateTime.fromISO(res.start_time).toUTC();
          const resEnd = DateTime.fromISO(res.end_time).toUTC();
          
          // Check overlap: (slotStart < resEnd) && (slotEnd > resStart)
          const overlaps = time730Utc < resEnd && slotEnd > resStart;
          
          if (overlaps) {
            hasConflict = true;
            const resStartLocal = resStart.setZone('America/Chicago');
            const resEndLocal = resEnd.setZone('America/Chicago');
            console.log(`    Table ${table.table_number}: ❌ CONFLICT with reservation ${res.id} (${resStartLocal.toFormat('HH:mm')}-${resEndLocal.toFormat('HH:mm')})`);
            break;
          }
        }
        
        if (!hasConflict) {
          availableTables.push(table);
          console.log(`    Table ${table.table_number}: ✅ AVAILABLE`);
        }
      }
      
      if (availableTables.length > 0) {
        console.log(`  ✅ AVAILABLE: ${availableTables.length} table(s) available for ${partySize} guests at 7:30pm`);
      } else {
        console.log(`  ❌ NOT AVAILABLE: All tables are booked for ${partySize} guests at 7:30pm`);
      }
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

check730Reservations();



