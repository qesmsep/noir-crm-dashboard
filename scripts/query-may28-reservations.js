const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function queryReservations() {
  try {
    // First, get the Rooftop KC location ID
    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .select('id, name, slug')
      .eq('slug', 'rooftopkc')
      .single();

    if (locationError) {
      console.error('Error fetching location:', locationError);
      return;
    }

    console.log('Location:', locationData);
    console.log('\n==============================================');
    console.log('ALL RESERVATIONS FOR THURSDAY, MAY 28, 2026');
    console.log('LOCATION: ROOFTOP KC');
    console.log('==============================================\n');

    // Query 1: Get all table IDs for Rooftop KC
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number')
      .eq('location_id', locationData.id)
      .order('table_number');

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      return;
    }

    console.log(`Tables at Rooftop KC: ${tables.length} total`);
    const tableIds = tables.map(t => t.id);

    // Query 2: Get ALL reservations for May 28, 2026
    // Using UTC range to cover the entire day in Chicago time
    const startDateUTC = '2026-05-28T09:00:00Z'; // 4am Chicago time
    const endDateUTC = '2026-05-29T06:00:00Z';  // 1am next day Chicago time

    // Query regular table reservations
    const { data: tableReservations, error: tableResError } = await supabase
      .from('reservations')
      .select('*')
      .in('table_id', tableIds)
      .gte('start_time', startDateUTC)
      .lte('start_time', endDateUTC)
      .order('start_time');

    if (tableResError) {
      console.error('Error fetching table reservations:', tableResError);
      return;
    }

    console.log(`\n📋 TABLE RESERVATIONS: ${tableReservations.length} total\n`);
    console.log('-------------------------------------------');

    tableReservations.forEach((res, index) => {
      const chicagoTime = new Date(res.start_time).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const table = tables.find(t => t.id === res.table_id);
      console.log(`${index + 1}. ${res.first_name} ${res.last_name || ''}`);
      console.log(`   ID: ${res.id}`);
      console.log(`   Table: ${table?.table_number || 'Unknown'}`);
      console.log(`   Party Size: ${res.party_size}`);
      console.log(`   Time: ${chicagoTime}`);
      console.log(`   Phone: ${res.phone}`);
      console.log(`   Status: ${res.status}`);
      console.log(`   Event Type: ${res.event_type || 'N/A'}`);
      console.log(`   Private Event ID: ${res.private_event_id || 'None'}`);
      console.log('-------------------------------------------');
    });

    // Query 3: Get private event RSVPs (null table_id)
    const { data: privateRSVPs, error: privateRSVPError } = await supabase
      .from('reservations')
      .select('*, private_events!inner(location_id, title, start_time)')
      .is('table_id', null)
      .eq('private_events.location_id', locationData.id)
      .gte('start_time', startDateUTC)
      .lte('start_time', endDateUTC)
      .order('start_time');

    if (privateRSVPError) {
      console.error('Error fetching private RSVPs:', privateRSVPError);
      return;
    }

    console.log(`\n🔒 PRIVATE EVENT RSVPs: ${privateRSVPs.length} total\n`);
    console.log('-------------------------------------------');

    privateRSVPs.forEach((res, index) => {
      const chicagoTime = new Date(res.start_time).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      console.log(`${index + 1}. ${res.first_name} ${res.last_name || ''}`);
      console.log(`   ID: ${res.id}`);
      console.log(`   Private Event: ${res.private_events?.title || 'Unknown'}`);
      console.log(`   Party Size: ${res.party_size}`);
      console.log(`   Time: ${chicagoTime}`);
      console.log(`   Phone: ${res.phone}`);
      console.log(`   Status: ${res.status}`);
      console.log(`   Private Event ID: ${res.private_event_id}`);
      console.log('-------------------------------------------');
    });

    // Query 4: Get private events themselves
    const { data: privateEvents, error: privateEventsError } = await supabase
      .from('private_events')
      .select('*')
      .eq('location_id', locationData.id)
      .gte('start_time', startDateUTC)
      .lte('start_time', endDateUTC);

    if (privateEventsError) {
      console.error('Error fetching private events:', privateEventsError);
      return;
    }

    console.log(`\n🎉 PRIVATE EVENTS: ${privateEvents.length} total\n`);
    console.log('-------------------------------------------');

    privateEvents.forEach((event, index) => {
      const startChicago = new Date(event.start_time).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const endChicago = new Date(event.end_time).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Time: ${startChicago} - ${endChicago}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Max Capacity: ${event.max_capacity}`);
      console.log(`   RSVP Enabled: ${event.rsvp_enabled}`);
      console.log(`   Host: ${event.host_name}`);
      console.log(`   Description: ${event.description || 'N/A'}`);
      console.log('-------------------------------------------');
    });

    // Summary
    console.log('\n==============================================');
    console.log('SUMMARY');
    console.log('==============================================');
    console.log(`Total Table Reservations: ${tableReservations.length}`);
    console.log(`Total Private Event RSVPs: ${privateRSVPs.length}`);
    console.log(`Total Private Events: ${privateEvents.length}`);
    console.log(`Grand Total All Reservations: ${tableReservations.length + privateRSVPs.length}`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

queryReservations();