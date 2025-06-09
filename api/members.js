import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { account_id, primary_member, secondary_member } = req.body;

    // Start a transaction
    const { data: primaryMemberData, error: primaryError } = await supabase
      .from('members')
      .insert([{
        ...primary_member,
        member_id: primary_member.member_id,
        account_id,
        member_type: 'primary',
        join_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (primaryError) throw primaryError;

    // If there's a secondary member, add them too
    if (secondary_member) {
      const { error: secondaryError } = await supabase
        .from('members')
        .insert([{
          ...secondary_member,
          member_id: secondary_member.member_id,
          account_id,
          member_type: 'secondary',
          join_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (secondaryError) throw secondaryError;
    }

    return res.status(200).json({ success: true, data: primaryMemberData });
  } catch (error) {
    console.error('Error creating member:', error);
    return res.status(500).json({ error: error.message });
  }
} 