import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Map new schema fields to expected frontend fields
    const { data, error } = await supabase.from('tables').select('id, table_number, seats');
    if (error) return res.status(500).json({ error: error.message });
    // Map to id, id_str, number, table_number, capacity for frontend
    const mapped = (data || []).map(t => ({
      id: t.id,
      table_number: t.table_number.padStart(2, '0'),
      seats: parseInt(t.seats, 10)
    }));
    return res.status(200).json({ data: mapped });
  }
  res.setHeader('Allow', ['GET']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}