import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkScheduledMessages() {
  console.log('📨 Checking Scheduled Intake Messages...');
  console.log('');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get recent enrollment
    const { data: enrollments, error: enrollError } = await supabase
      .from('sms_intake_enrollments')
      .select('*')
      .order('enrolled_at', { ascending: false })
      .limit(1);

    if (enrollError) throw enrollError;

    if (!enrollments || enrollments.length === 0) {
      console.log('❌ No enrollments found');
      return;
    }

    const enrollment = enrollments[0];
    console.log('📝 Latest Enrollment:');
    console.log(`   ID: ${enrollment.id}`);
    console.log(`   Phone: ${enrollment.phone}`);
    console.log(`   Enrolled: ${enrollment.enrolled_at}`);
    console.log(`   Status: ${enrollment.status}`);
    console.log('');

    // Get scheduled messages for this enrollment
    const { data: messages, error: msgError } = await supabase
      .from('sms_intake_scheduled_messages')
      .select('*')
      .eq('enrollment_id', enrollment.id)
      .order('scheduled_for', { ascending: true });

    if (msgError) throw msgError;

    console.log(`📬 Scheduled Messages (${messages?.length || 0} total):`);
    console.log('');

    const now = new Date();

    messages?.forEach((msg, idx) => {
      const scheduledFor = new Date(msg.scheduled_for);
      const isPast = scheduledFor < now;
      const minutesFromNow = Math.round((scheduledFor.getTime() - now.getTime()) / 60000);

      const statusIcon = msg.status === 'sent' ? '✅' :
                         msg.status === 'pending' ? '⏳' :
                         msg.status === 'failed' ? '❌' :
                         msg.status === 'processing' ? '⚙️' : '⏸️';

      console.log(`${idx + 1}. ${statusIcon} ${msg.status.toUpperCase()}`);
      console.log(`   Scheduled: ${msg.scheduled_for} ${isPast ? '(OVERDUE!)' : `(in ${minutesFromNow} min)`}`);
      console.log(`   Content: ${msg.message_content.substring(0, 100)}...`);
      if (msg.sent_at) {
        console.log(`   Sent: ${msg.sent_at}`);
      }
      if (msg.error_message) {
        console.log(`   Error: ${msg.error_message}`);
      }
      console.log('');
    });

    // Check if there are pending messages that should have been sent
    const pendingOverdue = messages?.filter(m => {
      const scheduledFor = new Date(m.scheduled_for);
      return m.status === 'pending' && scheduledFor < now;
    });

    if (pendingOverdue && pendingOverdue.length > 0) {
      console.log('');
      console.log('⚠️  WARNING: ' + pendingOverdue.length + ' messages are overdue!');
      console.log('');
      console.log('This means the cron job hasn\'t run yet.');
      console.log('You can trigger it manually:');
      console.log('');
      console.log('  curl -X POST https://noir-crm-dashboard.vercel.app/api/process-intake-messages \\');
      console.log('       -H "Authorization: Bearer $CRON_SECRET"');
      console.log('');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkScheduledMessages();
