import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function approveMembers() {
  const memberIds = [
    '0987689e-e72f-4340-be83-b5b174d8ec21', // Kenya Campbell
    'db196304-6060-4e31-9c03-9ca621ed8362', // Verne' Wright
    'bfdb7aa7-59ab-4044-9f66-41ca8853b56f'  // Sean Manohar
  ];

  console.log('Updating remaining member statuses to "approved"...\n');

  for (const id of memberIds) {
    // Get the entry
    const { data: entry, error: fetchError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !entry) {
      console.log(`❌ Not found: ${id}`);
      continue;
    }

    // Update status directly without triggering API
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', entry.id);

    if (updateError) {
      console.log(`❌ Error updating ${entry.first_name} ${entry.last_name}: ${updateError.message}`);
    } else {
      console.log(`✅ Updated ${entry.first_name.trim()} ${entry.last_name.trim()} (${entry.phone}) to approved`);
    }
  }

  console.log('\nDone! All 8 members have been approved.');
}

approveMembers();
