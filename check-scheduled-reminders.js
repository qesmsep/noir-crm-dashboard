const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkScheduledReminders() {
  console.log('🔍 Checking Scheduled Reservation Reminders\n');

  try {
    // 1. Get recent reservations (last 24 hours)
    console.log('1️⃣ Recent Reservations:');
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (reservationsError) {
      console.error('❌ Error fetching reservations:', reservationsError);
      return;
    }

    reservations.forEach((reservation, index) => {
      console.log(`   ${index + 1}. ${reservation.first_name} ${reservation.last_name}`);
      console.log(`      Phone: ${reservation.phone}`);
      console.log(`      Time: ${new Date(reservation.start_time).toLocaleString()}`);
      console.log(`      Status: ${reservation.status}`);
      console.log(`      Created: ${new Date(reservation.created_at).toLocaleString()}\n`);
    });

    // 2. Get scheduled reminders for these reservations
    if (reservations.length > 0) {
      const reservationIds = reservations.map(r => r.id);
      
      console.log('2️⃣ Scheduled Reminders:');
      const { data: scheduledReminders, error: scheduledError } = await supabase
        .from('scheduled_reservation_reminders')
        .select(`
          *,
          reservations (first_name, last_name, phone, start_time),
          reservation_reminder_templates (name, reminder_type, send_time, send_time_minutes)
        `)
        .in('reservation_id', reservationIds)
        .order('scheduled_for', { ascending: true });

      if (scheduledError) {
        console.error('❌ Error fetching scheduled reminders:', scheduledError);
        return;
      }

      if (scheduledReminders.length === 0) {
        console.log('   ❌ No scheduled reminders found for recent reservations');
        console.log('   This means the scheduling function may not be working properly');
      } else {
        scheduledReminders.forEach((reminder, index) => {
          console.log(`   ${index + 1}. ${reminder.reservations.first_name} ${reminder.reservations.last_name}`);
          console.log(`      Template: ${reminder.reservation_reminder_templates.name}`);
          console.log(`      Type: ${reminder.reservation_reminder_templates.reminder_type}`);
          console.log(`      Scheduled for: ${new Date(reminder.scheduled_for).toLocaleString()}`);
          console.log(`      Status: ${reminder.status}`);
          console.log(`      Message: ${reminder.message_content.substring(0, 100)}...\n`);
        });
      }
    }

    // 3. Check if there are any pending reminders that should have been sent
    console.log('3️⃣ Pending Reminders (should have been sent):');
    const { data: pendingReminders, error: pendingError } = await supabase
      .from('scheduled_reservation_reminders')
      .select(`
        *,
        reservations (first_name, last_name, phone, start_time),
        reservation_reminder_templates (name, reminder_type, send_time, send_time_minutes)
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (pendingError) {
      console.error('❌ Error fetching pending reminders:', pendingError);
      return;
    }

    if (pendingReminders.length === 0) {
      console.log('   ✅ No pending reminders that should have been sent');
    } else {
      console.log(`   ⚠️  Found ${pendingReminders.length} pending reminders that should have been sent:`);
      pendingReminders.forEach((reminder, index) => {
        console.log(`   ${index + 1}. ${reminder.reservations.first_name} ${reminder.reservations.last_name}`);
        console.log(`      Template: ${reminder.reservation_reminder_templates.name}`);
        console.log(`      Should have been sent at: ${new Date(reminder.scheduled_for).toLocaleString()}`);
        console.log(`      Current time: ${new Date().toLocaleString()}`);
        console.log(`      Message: ${reminder.message_content.substring(0, 100)}...\n`);
      });
    }

    // 4. Check active templates
    console.log('4️⃣ Active Reminder Templates:');
    const { data: templates, error: templatesError } = await supabase
      .from('reservation_reminder_templates')
      .select('*')
      .eq('is_active', true)
      .order('reminder_type', 'send_time', 'send_time_minutes');

    if (templatesError) {
      console.error('❌ Error fetching templates:', templatesError);
      return;
    }

    templates.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.name}`);
      console.log(`      Type: ${template.reminder_type}`);
      console.log(`      Send Time: ${template.send_time}`);
      console.log(`      Minutes: ${template.send_time_minutes || 0}`);
      console.log(`      Active: ${template.is_active}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkScheduledReminders(); 