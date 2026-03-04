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
      .from('questionnaires')
      .select(`
        *,
        questionnaire_questions (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error fetching questionnaire:', error);
    return res.status(404).json({ error: 'Questionnaire not found' });
  }
}

async function updateQuestionnaire(id: string, req: NextApiRequest, res: NextApiResponse) {
  const { title, description, type, is_active, questions } = req.body;

  try {
    // Update questionnaire
    const { error: questionnaireError } = await supabase
      .from('questionnaires')
      .update({
        title,
        description,
        type,
        is_active
      })
      .eq('id', id);

    if (questionnaireError) throw questionnaireError;

    // Handle questions update if provided
    if (questions) {
      // Delete existing questions
      await supabase
        .from('questionnaire_questions')
        .delete()
        .eq('questionnaire_id', id);

      // Insert new questions
      if (questions.length > 0) {
        const questionsToInsert = questions.map((q: any) => ({
          questionnaire_id: id,
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
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error updating questionnaire:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function deleteQuestionnaire(id: string, res: NextApiResponse) {
  try {
    const { error } = await supabase
      .from('questionnaires')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error deleting questionnaire:', error);
    return res.status(500).json({ error: error.message });
  }
}
