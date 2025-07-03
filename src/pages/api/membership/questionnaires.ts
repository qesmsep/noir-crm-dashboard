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
      case 'PUT':
        return await updateQuestionnaire(req, res);
      case 'DELETE':
        return await deleteQuestionnaire(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getQuestionnaires(req: NextApiRequest, res: NextApiResponse) {
  const { includeInactive = false } = req.query;
  
  let query = supabase
    .from('questionnaires')
    .select(`
      *,
      questionnaire_questions (
        id,
        question_text,
        question_type,
        options,
        is_required,
        order_index
      )
    `)
    .order('created_at', { ascending: false });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json(data);
}

async function createQuestionnaire(req: NextApiRequest, res: NextApiResponse) {
  const { title, description, is_active = true, questions = [] } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Start a transaction
  const { data: questionnaire, error: questionnaireError } = await supabase
    .from('questionnaires')
    .insert({
      title,
      description,
      is_active
    })
    .select()
    .single();

  if (questionnaireError) {
    return res.status(400).json({ error: questionnaireError.message });
  }

  // Insert questions if provided
  if (questions.length > 0) {
    const questionsWithId = questions.map((q: any, index: number) => ({
      ...q,
      questionnaire_id: questionnaire.id,
      order_index: index
    }));

    const { error: questionsError } = await supabase
      .from('questionnaire_questions')
      .insert(questionsWithId);

    if (questionsError) {
      // Rollback questionnaire creation
      await supabase
        .from('questionnaires')
        .delete()
        .eq('id', questionnaire.id);
      
      return res.status(400).json({ error: questionsError.message });
    }
  }

  return res.status(201).json(questionnaire);
}

async function updateQuestionnaire(req: NextApiRequest, res: NextApiResponse) {
  const { id, title, description, is_active, questions } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Questionnaire ID is required' });
  }

  // Update questionnaire
  const { data: questionnaire, error: questionnaireError } = await supabase
    .from('questionnaires')
    .update({
      title,
      description,
      is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (questionnaireError) {
    return res.status(400).json({ error: questionnaireError.message });
  }

  // Update questions if provided
  if (questions) {
    // Delete existing questions
    await supabase
      .from('questionnaire_questions')
      .delete()
      .eq('questionnaire_id', id);

    // Insert new questions
    if (questions.length > 0) {
      const questionsWithId = questions.map((q: any, index: number) => ({
        ...q,
        questionnaire_id: id,
        order_index: index
      }));

      const { error: questionsError } = await supabase
        .from('questionnaire_questions')
        .insert(questionsWithId);

      if (questionsError) {
        return res.status(400).json({ error: questionsError.message });
      }
    }
  }

  return res.status(200).json(questionnaire);
}

async function deleteQuestionnaire(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Questionnaire ID is required' });
  }

  const { error } = await supabase
    .from('questionnaires')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ message: 'Questionnaire deleted successfully' });
}