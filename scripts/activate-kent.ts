import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function activateKent() {
  console.log('Updating Kent Ingram status from pending to active...');

  const { data, error } = await supabase
    .from('members')
    .update({ status: 'active' })
    .eq('member_id', '1d43bdac-62c8-4920-8c34-d766758f82fc')
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Success! Updated member:', JSON.stringify(data, null, 2));
}

activateKent().then(() => process.exit(0));
