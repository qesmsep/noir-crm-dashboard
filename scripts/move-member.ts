/**
 * Script to move a member as secondary to another account
 * Usage: npx tsx scripts/move-member.ts <member_to_move_id> <target_primary_member_id>
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function moveMemberToAccount(memberToMoveId: string, targetPrimaryMemberId: string) {
  console.log('\n🔄 Moving member to new account...');
  console.log(`   Member to move ID: ${memberToMoveId}`);
  console.log(`   Target primary member ID: ${targetPrimaryMemberId}`);

  // 1. Get the member to move
  console.log('\n📋 Step 1: Fetching member to move...');
  const { data: memberToMove, error: moveError } = await supabase
    .from('members')
    .select('*')
    .eq('member_id', memberToMoveId)
    .single();

  if (moveError || !memberToMove) {
    console.error('❌ Member to move not found:', moveError);
    process.exit(1);
  }

  console.log(`✅ Found member: ${memberToMove.first_name} ${memberToMove.last_name} (${memberToMove.email})`);
  console.log(`   Current account ID: ${memberToMove.account_id}`);
  console.log(`   Current member type: ${memberToMove.member_type}`);

  // 2. Get the target primary member and their account
  console.log('\n📋 Step 2: Fetching target primary member...');
  const { data: targetMember, error: targetError } = await supabase
    .from('members')
    .select('*')
    .eq('member_id', targetPrimaryMemberId)
    .single();

  if (targetError || !targetMember) {
    console.error('❌ Target member not found:', targetError);
    process.exit(1);
  }

  console.log(`✅ Found target member: ${targetMember.first_name} ${targetMember.last_name} (${targetMember.email})`);
  console.log(`   Target account ID: ${targetMember.account_id}`);
  console.log(`   Target member type: ${targetMember.member_type}`);

  // 3. Verify target is a primary member
  if (targetMember.member_type !== 'primary') {
    console.error('❌ Target member is not a primary member');
    process.exit(1);
  }

  // 4. Check if member is already on this account
  if (memberToMove.account_id === targetMember.account_id) {
    console.log('⚠️  Member is already on this account');

    // Just update to secondary if needed
    if (memberToMove.member_type !== 'secondary') {
      console.log('📝 Updating member type to secondary...');
      const { error: updateError } = await supabase
        .from('members')
        .update({ member_type: 'secondary' })
        .eq('member_id', memberToMoveId);

      if (updateError) {
        console.error('❌ Failed to update member type:', updateError);
        process.exit(1);
      }
      console.log('✅ Member type updated to secondary');
    }

    console.log('\n✅ Complete!');
    return;
  }

  // 5. Get old account info for logging
  const { data: oldAccount } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', memberToMove.account_id)
    .single();

  // 6. Update member to new account and set as secondary
  console.log('\n📋 Step 3: Moving member to new account as secondary...');
  const { error: updateError } = await supabase
    .from('members')
    .update({
      account_id: targetMember.account_id,
      member_type: 'secondary'
    })
    .eq('member_id', memberToMoveId);

  if (updateError) {
    console.error('❌ Failed to update member:', updateError);
    process.exit(1);
  }

  console.log('✅ Member moved successfully');

  // 7. Get new account info
  const { data: newAccount } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_id', targetMember.account_id)
    .single();

  // 8. Update new account's monthly_dues to add $25 for additional member
  if (newAccount) {
    const currentDues = Number(newAccount.monthly_dues) || 0;
    const newDues = currentDues + 25;

    console.log('\n📋 Step 4: Updating target account monthly dues...');
    console.log(`   Current monthly dues: $${currentDues.toFixed(2)}`);
    console.log(`   New monthly dues: $${newDues.toFixed(2)} (+$25 for secondary member)`);

    const { error: duesError } = await supabase
      .from('accounts')
      .update({ monthly_dues: newDues })
      .eq('account_id', targetMember.account_id);

    if (duesError) {
      console.error('⚠️  Failed to update monthly dues:', duesError);
    } else {
      console.log('✅ Monthly dues updated');
    }
  }

  // 9. Check if old account has any remaining members
  console.log('\n📋 Step 5: Checking old account...');
  const { data: remainingMembers } = await supabase
    .from('members')
    .select('member_id')
    .eq('account_id', memberToMove.account_id);

  if (remainingMembers && remainingMembers.length === 0) {
    console.log('⚠️  Old account has no remaining members');
    console.log(`   You may want to delete account: ${memberToMove.account_id}`);
  } else {
    console.log(`✅ Old account still has ${remainingMembers?.length || 0} member(s)`);

    // Update old account's monthly dues to subtract $25
    if (oldAccount && memberToMove.member_type === 'secondary') {
      const oldDues = Number(oldAccount.monthly_dues) || 0;
      const newOldDues = Math.max(0, oldDues - 25);

      console.log('📋 Updating old account monthly dues...');
      console.log(`   Current monthly dues: $${oldDues.toFixed(2)}`);
      console.log(`   New monthly dues: $${newOldDues.toFixed(2)} (-$25 for removed secondary member)`);

      const { error: oldDuesError } = await supabase
        .from('accounts')
        .update({ monthly_dues: newOldDues })
        .eq('account_id', memberToMove.account_id);

      if (oldDuesError) {
        console.error('⚠️  Failed to update old account monthly dues:', oldDuesError);
      } else {
        console.log('✅ Old account monthly dues updated');
      }
    }
  }

  // 10. Display summary
  console.log('\n✅ Move complete!\n');
  console.log('📊 Summary:');
  console.log(`   Moved: ${memberToMove.first_name} ${memberToMove.last_name}`);
  console.log(`   From account: ${memberToMove.account_id}`);
  console.log(`   To account: ${targetMember.account_id}`);
  console.log(`   Primary member: ${targetMember.first_name} ${targetMember.last_name}`);
  console.log(`   New member type: secondary`);
  console.log('');
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/move-member.ts <member_to_move_id> <target_primary_member_id>');
  process.exit(1);
}

const [memberToMoveId, targetPrimaryMemberId] = args;

moveMemberToAccount(memberToMoveId, targetPrimaryMemberId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
