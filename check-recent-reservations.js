/**
 * Script to check if recent reservations are actually saved in the database
 * Run: node check-recent-reservations.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRecentReservations() {
  console.log('Checking for recent reservations...\n');
  
  try {
    // Get reservations from the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .gte('start_time', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error querying reservations:', error);
      return;
    }
    
    if (!reservations || reservations.length === 0) {
      console.log('❌ No reservations found in the last 24 hours.');
      console.log('This could mean:');
      console.log('  1. No reservations were created');
      console.log('  2. Reservations are being created but not saved');
      console.log('  3. The start_time is in the future beyond 24 hours\n');
      
      // Check for any recent reservations regardless of start_time
      const { data: allRecent, error: allError } = await supabase
        .from('reservations')
        .select('id, start_time, phone, first_name, created_at')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (allError) {
        console.error('Error querying by created_at:', allError);
      } else if (allRecent && allRecent.length > 0) {
        console.log(`\n✅ Found ${allRecent.length} reservation(s) created in the last 24 hours:`);
        allRecent.forEach((r, i) => {
          console.log(`\n${i + 1}. Reservation ID: ${r.id}`);
          console.log(`   Created: ${new Date(r.created_at).toLocaleString()}`);
          console.log(`   Start Time: ${r.start_time ? new Date(r.start_time).toLocaleString() : 'N/A'}`);
          console.log(`   Phone: ${r.phone || 'N/A'}`);
          console.log(`   Name: ${r.first_name || 'N/A'}`);
        });
      } else {
        console.log('\n❌ No reservations found by created_at either.');
      }
      return;
    }
    
    console.log(`✅ Found ${reservations.length} reservation(s) in the last 24 hours:\n`);
    
    reservations.forEach((reservation, i) => {
      console.log(`${i + 1}. Reservation ID: ${reservation.id}`);
      console.log(`   Created: ${new Date(reservation.created_at).toLocaleString()}`);
      console.log(`   Start Time: ${reservation.start_time ? new Date(reservation.start_time).toLocaleString() : 'N/A'}`);
      console.log(`   End Time: ${reservation.end_time ? new Date(reservation.end_time).toLocaleString() : 'N/A'}`);
      console.log(`   Party Size: ${reservation.party_size || 'N/A'}`);
      console.log(`   Phone: ${reservation.phone || 'N/A'}`);
      console.log(`   Name: ${reservation.first_name || 'N/A'} ${reservation.last_name || ''}`);
      console.log(`   Email: ${reservation.email || 'N/A'}`);
      console.log(`   Status: ${reservation.status || 'N/A'}`);
      console.log(`   Membership Type: ${reservation.membership_type || 'N/A'}`);
      console.log(`   Member ID: ${reservation.member_id || 'N/A'}`);
      console.log(`   Source: ${reservation.source || 'N/A'}`);
      console.log('');
    });
    
    // Also check total count
    const { count } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Total reservations in database: ${count || 0}`);
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkRecentReservations();







