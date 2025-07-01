import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id } = req.query;

  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
  }

  try {
    console.log('Fetching messages for account:', account_id);

    // First get all members with this account_id
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('member_id')
      .eq('account_id', account_id);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      throw membersError;
    }

    if (!members || members.length === 0) {
      return res.status(200).json({ messages: [] });
    }

    const memberIds = members.map(m => m.member_id);

    // Then get all messages for these members
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        *,
        members (
          first_name,
          last_name,
          phone
        )
      `)
      .in('member_id', memberIds)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    console.log('Found messages:', messages?.length || 0);
    return res.status(200).json({ messages: messages || [] });
  } catch (error) {
    console.error('Error in messages API:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch messages',
      details: error.message 
    });
  }
} 