import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { method } = req;
  
  if (method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('private_events')
        .select('*')
        .eq('status', 'active')
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching private events:', error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(200).json({ data });
    } catch (error) {
      console.error('Error in private events GET:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  if (method === 'POST') {
    try {
      const { data, error } = await supabase
        .from('private_events')
        .insert(req.body)
        .select()
        .single();

      if (error) {
        console.error('Error creating private event:', error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(201).json({ data });
    } catch (error) {
      console.error('Error in private events POST:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  if (method === 'PATCH') {
    try {
      const { id, ...updateData } = req.body;
      const { data, error } = await supabase
        .from('private_events')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating private event:', error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(200).json({ data });
    } catch (error) {
      console.error('Error in private events PATCH:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  if (method === 'DELETE') {
    try {
      const { id } = req.query;
      const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting private event:', error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(204).end();
    } catch (error) {
      console.error('Error in private events DELETE:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  res.status(405).end(`Method ${method} Not Allowed`);
} 