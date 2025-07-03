import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getAgreements(req, res);
      case 'POST':
        return await createAgreement(req, res);
      case 'PUT':
        return await updateAgreement(req, res);
      case 'DELETE':
        return await deleteAgreement(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAgreements(req: NextApiRequest, res: NextApiResponse) {
  const { current_only = false } = req.query;
  
  let query = supabase
    .from('agreements')
    .select('*')
    .order('version', { ascending: false })
    .order('created_at', { ascending: false });

  if (current_only === 'true') {
    query = query.eq('is_current', true).eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json(data);
}

async function createAgreement(req: NextApiRequest, res: NextApiResponse) {
  const { title, content, status = 'draft', is_current = false } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  // If this is being set as current, unset other current agreements
  if (is_current) {
    await supabase
      .from('agreements')
      .update({ is_current: false })
      .eq('is_current', true);
  }

  // Get the next version number
  const { data: maxVersion } = await supabase
    .from('agreements')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (maxVersion?.version || 0) + 1;

  const { data: agreement, error } = await supabase
    .from('agreements')
    .insert({
      title,
      content,
      status,
      is_current,
      version: nextVersion
    })
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json(agreement);
}

async function updateAgreement(req: NextApiRequest, res: NextApiResponse) {
  const { id, title, content, status, is_current } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Agreement ID is required' });
  }

  // If this is being set as current, unset other current agreements
  if (is_current) {
    await supabase
      .from('agreements')
      .update({ is_current: false })
      .eq('is_current', true)
      .neq('id', id);
  }

  const { data: agreement, error } = await supabase
    .from('agreements')
    .update({
      title,
      content,
      status,
      is_current,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json(agreement);
}

async function deleteAgreement(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Agreement ID is required' });
  }

  // Check if this agreement is currently being used in applications
  const { data: applications } = await supabase
    .from('member_applications')
    .select('id')
    .eq('agreement_id', id)
    .limit(1);

  if (applications && applications.length > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete agreement that is referenced by member applications' 
    });
  }

  const { error } = await supabase
    .from('agreements')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ message: 'Agreement deleted successfully' });
}