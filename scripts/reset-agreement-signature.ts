import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetAgreement() {
  const token = process.argv[2];

  if (!token) {
    console.error('Usage: npx tsx scripts/reset-agreement-signature.ts <token>');
    process.exit(1);
  }

  try {
    console.log(`Resetting agreement for token: ${token}\n`);

    // Find waitlist entry
    const { data: waitlist, error: findError } = await supabase
      .from('waitlist')
      .select('*')
      .or(`application_token.eq.${token},agreement_token.eq.${token}`)
      .single();

    if (findError || !waitlist) {
      console.error('❌ Waitlist entry not found');
      process.exit(1);
    }

    console.log('Found waitlist entry:', {
      id: waitlist.id,
      name: `${waitlist.first_name} ${waitlist.last_name}`,
      email: waitlist.email,
      agreement_signed_at: waitlist.agreement_signed_at
    });

    // Delete signature records
    const { error: deleteError } = await supabase
      .from('agreement_signatures')
      .delete()
      .eq('waitlist_id', waitlist.id);

    if (deleteError) {
      console.error('Error deleting signatures:', deleteError);
    } else {
      console.log('✅ Deleted agreement signatures');
    }

    // Reset waitlist agreement fields
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        agreement_signed_at: null,
        status: 'review' // Reset to review status
      })
      .eq('id', waitlist.id);

    if (updateError) {
      console.error('❌ Error updating waitlist:', updateError);
      process.exit(1);
    }

    console.log('✅ Agreement signature reset successfully!\n');
    console.log('You can now sign the agreement again.');

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetAgreement();
