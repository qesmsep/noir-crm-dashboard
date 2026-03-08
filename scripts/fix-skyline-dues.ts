import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixSkylineDues() {
  const accountId = 'b4c8fddc-78c9-4902-8187-d51f35996862';

  console.log('\n🔧 Fixing Skyline account monthly dues...');
  console.log(`   Account ID: ${accountId}`);

  // Get current account
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (!account) {
    console.error('❌ Account not found');
    process.exit(1);
  }

  console.log(`   Current monthly dues: $${account.monthly_dues}`);

  // Skyline additional members are free, so subtract the $25 I incorrectly added
  const correctDues = Number(account.monthly_dues) - 25;

  console.log(`   Corrected monthly dues: $${correctDues} (Skyline includes free additional members)`);

  const { error } = await supabase
    .from('accounts')
    .update({ monthly_dues: correctDues })
    .eq('account_id', accountId);

  if (error) {
    console.error('❌ Failed to update dues:', error);
    process.exit(1);
  }

  console.log('✅ Monthly dues corrected!');
  console.log('');
}

fixSkylineDues().then(() => process.exit(0));
