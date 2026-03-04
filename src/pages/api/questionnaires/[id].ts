import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Questionnaire ID is required' });
  }

  try {
    switch (method) {
      case 'GET':
        return await getQuestionnaire(id, res);
      case 'PUT':
        return await updateQuestionnaire(id, req, res);
      case 'DELETE':
        return await deleteQuestionnaire(id, res);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Questionnaire API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getQuestionnaire(id: string, res: NextApiResponse) {
  try {
    const { data, error } = await supabase
      .from('questionnaire_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Transform to match expected format
    const transformed = {
      id: data.id,
      title: data.name,
      description: data.description,
      type: data.name.toLowerCase().includes('invitation') || data.name.toLowerCase().includes('waitlist')
        ? 'waitlist'
        : data.name.toLowerCase().includes('member') || data.name.toLowerCase().includes('application')
        ? 'membership'
        : 'custom',
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at,
      questionnaire_questions: Array.isArray(data.questions) ? data.questions : []
    };

    return res.status(200).json(transformed);
  } catch (error: any) {
    console.error('Error fetching questionnaire:', error);
    return res.status(404).json({ error: 'Questionnaire not found' });
  }
}

async function updateQuestionnaire(id: string, req: NextApiRequest, res: NextApiResponse) {
  const { title, description, type, is_active, questions } = req.body;

  try {
    // Format questions for JSONB storage
    const formattedQuestions = (questions || []).map((q: any, index: number) => ({
      id: q.id || `q${index + 1}`,
      question_text: q.question_text,
      question_type: q.question_type,
      placeholder: q.placeholder,
      options: q.options,
      is_required: q.is_required ?? false
    }));

    // Update questionnaire template
    const { error } = await supabase
      .from('questionnaire_templates')
      .update({
        name: title,
        description,
        is_active,
        questions: formattedQuestions
      })
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error updating questionnaire:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function deleteQuestionnaire(id: string, res: NextApiResponse) {
  try {
    const { error } = await supabase
      .from('questionnaire_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error deleting questionnaire:', error);
    return res.status(500).json({ error: error.message });
  }
}
