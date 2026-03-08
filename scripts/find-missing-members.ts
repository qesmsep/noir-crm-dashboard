import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findMembers() {
  console.log('Searching for missing members...\n');

  // Search for Kenya
  const { data: kenya } = await supabase
    .from('waitlist')
    .select('*')
    .ilike('first_name', '%kenya%')
    .eq('status', 'review');

  console.log('Kenya:', kenya);

  // Search for Verne
  const { data: verne } = await supabase
    .from('waitlist')
    .select('*')
    .ilike('first_name', '%verne%')
    .eq('status', 'review');

  console.log('Verne:', verne);

  // Search for Sean
  const { data: sean } = await supabase
    .from('waitlist')
    .select('*')
    .ilike('first_name', '%sean%')
    .eq('status', 'review');

  console.log('Sean:', sean);
}

findMembers();
