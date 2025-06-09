import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      req.on('error', reject);
    });

    const { file, member_id } = formData;
    if (!file || !member_id) {
      throw new Error('Missing required fields');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${member_id}.${fileExt}`;
    const filePath = `member-photos/${fileName}`;

    const { data, error } = await supabase.storage
      .from('members')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('members')
      .getPublicUrl(filePath);

    return res.status(200).json({ url: publicUrl });
  } catch (error) {
    console.error('Error uploading photo:', error);
    return res.status(500).json({ error: error.message });
  }
} 