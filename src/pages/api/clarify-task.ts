import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.substring(7);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { taskId } = req.body as { taskId?: string };
  if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

  // Fetch task
  const { data: task, error: fetchErr } = await supabase
    .from('tasks')
    .select('id, title, objective, focus, goal_id, global_rank')
    .eq('id', taskId)
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !task) return res.status(404).json({ error: 'Task not found' });

  // Build prompt
  const systemPrompt = `You are an expert project manager. Given a parent task, propose a concise list of 1-5 sub-tasks that break the work into actionable chunks. Return ONLY a valid JSON array of objects with \"title\" (string) and optional \"objective\" (string).`;
  const userPrompt = `Parent task:\n${JSON.stringify(task, null, 2)}\nProvide sub-tasks now.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3
    });

    const content = completion.choices[0].message.content?.trim() || '[]';
    let suggestions: Array<{ title: string; objective?: string }> = [];
    try {
      suggestions = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({ error: 'Invalid AI response', raw: content });
    }

    // Insert new tasks as children
    const rows = suggestions.map((s, idx) => ({
      user_id: user.id,
      title: s.title,
      objective: s.objective ?? null,
      parent_id: taskId,
      goal_id: task.goal_id ?? null,
      nested_rank: idx,
      global_rank: task.global_rank + idx + 1 // simple
    }));

    if (rows.length > 0) {
      await supabase.from('tasks').insert(rows);
    }

    return res.status(200).json({ added: rows.length });
  } catch (err) {
    console.error('Clarify task error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}