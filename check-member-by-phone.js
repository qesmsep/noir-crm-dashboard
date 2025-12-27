/**
 * Script to check member by phone number
 * Run: node check-member-by-phone.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMemberByPhone() {
  const phoneNumber = '+18584129797'; // From the recent reservations
  
  console.log(`Checking for member with phone: ${phoneNumber}\n`);
  
  // Try exact match
  const { data: exactMatch, error: exactError } = await supabase
    .from('members')
    .select('*')
    .eq('phone', phoneNumber)
    .single();
  
  console.log('Exact match result:');
  if (exactError) {
    console.log('  Error:', exactError.message);
  } else if (exactMatch) {
    console.log('  ✅ Found member:', JSON.stringify(exactMatch, null, 2));
  } else {
    console.log('  ❌ No exact match found');
  }
  
  // Try without +1 prefix
  const phoneWithoutPlus = phoneNumber.replace(/^\+1/, '');
  console.log(`\nTrying without +1 prefix: ${phoneWithoutPlus}`);
  const { data: noPlusMatch, error: noPlusError } = await supabase
    .from('members')
    .select('*')
    .eq('phone', phoneWithoutPlus)
    .single();
  
  if (noPlusError) {
    console.log('  Error:', noPlusError.message);
  } else if (noPlusMatch) {
    console.log('  ✅ Found member:', JSON.stringify(noPlusMatch, null, 2));
  } else {
    console.log('  ❌ No match found');
  }
  
  // Try with just digits
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  console.log(`\nTrying digits only: ${digitsOnly}`);
  const { data: digitsMatch, error: digitsError } = await supabase
    .from('members')
    .select('*')
    .eq('phone', digitsOnly)
    .single();
  
  if (digitsError) {
    console.log('  Error:', digitsError.message);
  } else if (digitsMatch) {
    console.log('  ✅ Found member:', JSON.stringify(digitsMatch, null, 2));
  } else {
    console.log('  ❌ No match found');
  }
  
  // List all members with similar phone numbers
  console.log('\n\nSearching for similar phone numbers...');
  const { data: allMembers, error: allError } = await supabase
    .from('members')
    .select('member_id, first_name, last_name, phone')
    .limit(50);
  
  if (allError) {
    console.error('Error fetching members:', allError);
  } else {
    console.log(`\nFound ${allMembers?.length || 0} members. Checking for similar phones...`);
    const similar = allMembers?.filter(m => {
      const memberPhone = m.phone?.replace(/\D/g, '') || '';
      const searchPhone = digitsOnly;
      return memberPhone.includes(searchPhone.slice(-10)) || searchPhone.includes(memberPhone.slice(-10));
    });
    
    if (similar && similar.length > 0) {
      console.log(`\nFound ${similar.length} member(s) with similar phone numbers:`);
      similar.forEach(m => {
        console.log(`  - ${m.first_name} ${m.last_name}: ${m.phone}`);
      });
    } else {
      console.log('\nNo similar phone numbers found.');
    }
  }
}

checkMemberByPhone();







