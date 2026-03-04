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
      .from('questionnaires')
      .select(`
        *,
        questionnaire_questions (
          id,
          question_text,
          question_type,
          placeholder,
          options,
          is_required,
          order_index
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error fetching questionnaires:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function createQuestionnaire(req: NextApiRequest, res: NextApiResponse) {
  const { title, description, type, is_active, questions } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: 'Title and type are required' });
  }

  try {
    // Create questionnaire
    const { data: questionnaire, error: questionnaireError } = await supabase
      .from('questionnaires')
      .insert({
        title,
        description,
        type,
        is_active: is_active ?? true
      })
      .select()
      .single();

    if (questionnaireError) throw questionnaireError;

    // Create questions if provided
    if (questions && questions.length > 0) {
      const questionsToInsert = questions.map((q: any) => ({
        questionnaire_id: questionnaire.id,
        question_text: q.question_text,
        question_type: q.question_type,
        placeholder: q.placeholder,
        options: q.options,
        is_required: q.is_required ?? false,
        order_index: q.order_index
      }));

      const { error: questionsError } = await supabase
        .from('questionnaire_questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;
    }

    return res.status(201).json({ success: true, id: questionnaire.id });
  } catch (error: any) {
    console.error('Error creating questionnaire:', error);
    return res.status(500).json({ error: error.message });
  }
}
