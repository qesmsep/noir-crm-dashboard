import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase (service role for server-side operations)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Helper: extract and verify JWT, return user
async function getUserFromRequest(req: NextApiRequest) {
  const authHeader = req.headers.authorization || req.headers.Authorization as string | undefined;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Validate user
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Fetch active tasks for the user (not completed)
    const { data: tasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, title, objective, nested_rank, global_rank, focus, deadline')
      .eq('user_id', user.id)
      .eq('is_done', false);

    if (fetchError) {
      console.error('Error fetching tasks:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    if (!tasks || tasks.length === 0) {
      return res.status(200).json({ message: 'No active tasks to optimize', order: [] });
    }

    // 3. Build prompt for OpenAI
    const systemPrompt = `You are an AI assistant that helps reorder a user\'s task list to optimize their workflow. \nGiven a list of task objects, return ONLY a valid JSON array of task IDs in the new order of execution (highest priority first).\nGuidelines:\n- Prioritize by these heuristics: tasks with nearer deadlines, parent tasks before their subtasks, user focus (speed => fastest tasks first, cost => lowest cost first, quality => highest quality impact).\n- You MUST return an array of UUID strings and nothing else.`;

    const userPrompt = `Here are the tasks:\n${JSON.stringify(tasks)}\nReturn the array now.`;

    // 4. Call OpenAI Chat Completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    });

    const content = completion.choices[0].message.content?.trim() || '[]';

    // 5. Parse response JSON
    let order: string[] = [];
    try {
      order = JSON.parse(content);
      if (!Array.isArray(order)) throw new Error('Parsed content is not array');
    } catch (err) {
      console.error('Failed to parse OpenAI response:', content);
      return res.status(500).json({ error: 'Invalid AI response' });
    }

    // 6. Update global_rank according to new order
    // Using Promise.all for parallel updates (small dataset, acceptable)
    await Promise.all(
      order.map((taskId, idx) =>
        supabase.from('tasks').update({ global_rank: idx }).eq('id', taskId)
      )
    );

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Error optimizing tasks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}