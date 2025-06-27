import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    try {
      const { memberId } = req.query;
      
      if (!memberId) {
        return res.status(400).json({ error: 'Missing required field: memberId' });
      }

      // Instead of deleting, set a deactivated flag
      const { error } = await supabase
        .from('members')
        .update({ deactivated: true })
        .eq('member_id', memberId);

      if (error) {
        console.error('Error deactivating member:', error);
        throw error;
      }

      return res.status(200).json({ success: true, message: 'Member deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating member:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 