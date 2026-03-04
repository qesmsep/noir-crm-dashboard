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
        return await getQuestions(id, res);
      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Questions API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getQuestions(questionnaireId: string, res: NextApiResponse) {
  try {
    // Try to get from questionnaire_templates (current schema)
    const { data: template, error: templateError } = await supabase
      .from('questionnaire_templates')
      .select('questions')
      .eq('id', questionnaireId)
      .single();

    if (!templateError && template) {
      // Questions are stored as JSONB array in the template
      const questions = Array.isArray(template.questions) ? template.questions : [];

      // Transform to match expected format with order_index
      const formattedQuestions = questions.map((q: any, index: number) => ({
        id: q.id || `q${index + 1}`,
        question_text: q.question_text,
        question_type: q.question_type,
        placeholder: q.placeholder,
        options: q.options,
        is_required: q.is_required || false,
        order_index: index + 1
      }));

      return res.status(200).json(formattedQuestions);
    }

    // Fallback to questionnaire_questions table (if migration was run)
    const { data, error } = await supabase
      .from('questionnaire_questions')
      .select('*')
      .eq('questionnaire_id', questionnaireId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (error: any) {
    console.error('Error fetching questions:', error);
    return res.status(500).json({ error: error.message });
  }
}
