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
        return await getQuestionnaires(req, res);
      case 'POST':
        return await createQuestionnaire(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Questionnaires API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getQuestionnaires(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { data, error } = await supabase
      .from('questionnaire_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to match expected format with questionnaire_questions
    const transformed = data?.map((template: any) => ({
      id: template.id,
      title: template.name,
      description: template.description,
      type: template.name.toLowerCase().includes('invitation') || template.name.toLowerCase().includes('waitlist')
        ? 'waitlist'
        : template.name.toLowerCase().includes('member') || template.name.toLowerCase().includes('application')
        ? 'membership'
        : 'custom',
      is_active: template.is_active,
      created_at: template.created_at,
      updated_at: template.updated_at,
      questionnaire_questions: Array.isArray(template.questions) ? template.questions : []
    }));

    return res.status(200).json(transformed || []);
  } catch (error: any) {
    console.error('Error fetching questionnaires:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function createQuestionnaire(req: NextApiRequest, res: NextApiResponse) {
  const { title, description, type, is_active, questions } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

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

    // Create questionnaire template
    const { data: template, error: templateError } = await supabase
      .from('questionnaire_templates')
      .insert({
        name: title,
        description,
        is_active: is_active ?? true,
        questions: formattedQuestions
      })
      .select()
      .single();

    if (templateError) throw templateError;

    return res.status(201).json({ success: true, id: template.id });
  } catch (error: any) {
    console.error('Error creating questionnaire:', error);
    return res.status(500).json({ error: error.message });
  }
}
