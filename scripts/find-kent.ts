import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findKent() {
  const { data, error } = await supabase
    .from('members')
    .select('member_id, account_id, first_name, last_name, email')
    .ilike('first_name', '%kent%')
    .ilike('last_name', '%ingram%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Found members:', JSON.stringify(data, null, 2));
}

findKent().then(() => process.exit(0));
