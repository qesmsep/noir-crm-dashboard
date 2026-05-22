require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReminderLocations() {
  console.log('=== Checking Reminder Locations ===\n');

  // Check cancelled reminders with their reservation locations
  console.log('Checking cancelled reminders and their locations:\n');
  const { data: cancelledReminders, error } = await supabase
    .from('scheduled_reservation_reminders')
    .select(`
      id,
      customer_name,
      scheduled_for,
      status,
      reservation_id,
      reservations (
        id,
        table_id,
        tables (
          location_id,
          locations (
            name,
            slug
          )
        )
      )
    `)
    .eq('status', 'cancelled')
    .order('scheduled_for', { ascending: true })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by location
  const byLocation = {};
  
  if (cancelledReminders) {
    cancelledReminders.forEach(r => {
      const locationName = r.reservations?.tables?.locations?.name || 'No Location';
      const locationSlug = r.reservations?.tables?.locations?.slug || 'unknown';
      
      if (!byLocation[locationSlug]) {
        byLocation[locationSlug] = {
          name: locationName,
          count: 0,
          reminders: []
        };
      }
      
      byLocation[locationSlug].count++;
      byLocation[locationSlug].reminders.push({
        customer: r.customer_name,
        scheduled: r.scheduled_for
      });
    });
  }

  console.log('Cancelled reminders by location:');
  Object.keys(byLocation).forEach(slug => {
    const loc = byLocation[slug];
    console.log(`\n${loc.name} (${slug}): ${loc.count} reminders`);
    loc.reminders.slice(0, 5).forEach(r => {
      console.log(`  - ${r.customer}: ${r.scheduled}`);
    });
    if (loc.reminders.length > 5) {
      console.log(`  ... and ${loc.reminders.length - 5} more`);
    }
  });

  // Check if templates have location settings
  console.log('\n\nChecking if templates have location filters:');
  const { data: templates } = await supabase
    .from('reservation_reminder_templates')
    .select('*')
    .limit(1);

  if (templates && templates.length > 0) {
    const columns = Object.keys(templates[0]);
    console.log('Template columns:', columns.join(', '));
    
    const hasLocationColumn = columns.some(c => c.includes('location'));
    console.log(`\nLocation-based filtering: ${hasLocationColumn ? 'YES' : 'NO'}`);
  }
}

checkReminderLocations().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
