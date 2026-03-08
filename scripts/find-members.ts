import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findMembers() {
  console.log('\n🔍 Searching for Tessa Bisges...');
  const { data: tessa, error: tessaError } = await supabase
    .from('members')
    .select('*')
    .or('member_id.eq.173c39ba-4d82-4764-8f5c-e8d11c620a55,account_id.eq.173c39ba-4d82-4764-8f5c-e8d11c620a55');

  if (tessaError) {
    console.error('Error searching for Tessa:', tessaError);
  } else {
    console.log('Tessa results:', JSON.stringify(tessa, null, 2));
  }

  console.log('\n🔍 Searching for target member...');
  const { data: target, error: targetError } = await supabase
    .from('members')
    .select('*')
    .or('member_id.eq.b4c8fddc-78c9-4902-8187-d51f35996862,account_id.eq.b4c8fddc-78c9-4902-8187-d51f35996862');

  if (targetError) {
    console.error('Error searching for target:', targetError);
  } else {
    console.log('Target results:', JSON.stringify(target, null, 2));
  }

  // Also try searching by name
  console.log('\n🔍 Searching by name for Tessa Bisges...');
  const { data: tessaByName } = await supabase
    .from('members')
    .select('*')
    .ilike('first_name', '%tessa%')
    .ilike('last_name', '%bisges%');

  console.log('Tessa by name:', JSON.stringify(tessaByName, null, 2));
}

findMembers().then(() => process.exit(0));
