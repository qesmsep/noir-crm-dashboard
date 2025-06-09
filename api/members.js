import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_MEMBER_FIELDS = [
  'account_id', 'first_name', 'last_name', 'email', 'phone', 'stripe_customer_id', 'status',
  'join_date', 'renewal_date', 'company', 'address', 'address_2', 'city', 'state', 'zip', 'country',
  'referral', 'membership', 'photo', 'dob', 'auth_code', 'token', 'balance', 'created_at',
  'supabase_user_id', 'member_type', 'member_id'
];

function cleanMemberObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => ALLOWED_MEMBER_FIELDS.includes(key))
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { account_id, primary_member, secondary_member } = req.body;

    const now = new Date().toISOString();
    const primaryMemberClean = cleanMemberObject({
      ...primary_member,
      created_at: now
    });
    const secondaryMemberClean = secondary_member ? cleanMemberObject({
      ...secondary_member,
      created_at: now
    }) : null;

    // Start a transaction
    const { data: primaryMemberData, error: primaryError } = await supabase
      .from('members')
      .insert([primaryMemberClean])
      .select()
      .single();

    if (primaryError) throw primaryError;

    // If there's a secondary member, add them too
    if (secondaryMemberClean) {
      const { error: secondaryError } = await supabase
        .from('members')
        .insert([secondaryMemberClean]);

      if (secondaryError) throw secondaryError;
    }

    return res.status(200).json({ success: true, data: primaryMemberData });
  } catch (error) {
    console.error('Error creating member:', error);
    return res.status(500).json({ error: error.message });
  }
} 