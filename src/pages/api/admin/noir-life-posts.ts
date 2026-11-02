import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveAdmin } from '@/lib/admin-auth';
import { NOIR_LIFE_POST_COLUMNS, isMissingTable, sanitizeBlocks } from '@/lib/noirLife';

/**
 * Admin > Noir.life posts.
 * GET    -> { posts, events, tableReady } (all posts, newest first; member events for linking)
 * POST   -> create a post
 * PUT    -> update a post (body must include id)
 * DELETE -> delete a post (?id=<uuid>)
 */
const CLUBS = ['all', 'noir', 'noir-op'];

function cleanPost(input: any) {
  const out: Record<string, any> = {};
  if (typeof input.title === 'string') out.title = input.title.trim().slice(0, 200);
  if (typeof input.summary === 'string') out.summary = input.summary.slice(0, 300);
  if (CLUBS.includes(input.club)) out.club = input.club;
  if ('cover_image_url' in input) {
    const u = input.cover_image_url;
    out.cover_image_url = typeof u === 'string' && u.startsWith('https://') ? u : null;
  }
  if ('blocks' in input) out.blocks = sanitizeBlocks(input.blocks);
  if ('private_event_id' in input) out.private_event_id = input.private_event_id || null;
  if (typeof input.is_pinned === 'boolean') out.is_pinned = input.is_pinned;
  if (typeof input.is_published === 'boolean') out.is_published = input.is_published;
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await resolveAdmin(req.headers.authorization?.split(' ')[1]);
  if (!admin) {
    return res.status(401).json({ error: 'Admin access required' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const [posts, events] = await Promise.all([
          supabaseAdmin
            .from('noir_life_posts')
            .select(NOIR_LIFE_POST_COLUMNS)
            .order('created_at', { ascending: false }),
          supabaseAdmin
            .from('private_events')
            .select('id, title, start_time')
            .eq('is_member_event', true)
            .gte('start_time', new Date(Date.now() - 30 * 86400000).toISOString())
            .order('start_time', { ascending: true })
            .limit(100),
        ]);
        if (posts.error && !isMissingTable(posts.error)) throw posts.error;
        if (events.error) throw events.error;
        return res.status(200).json({
          posts: posts.data || [],
          events: events.data || [],
          tableReady: !isMissingTable(posts.error),
        });
      }

      case 'POST': {
        const post = cleanPost(req.body || {});
        if (!post.title) return res.status(400).json({ error: 'Title is required' });
        if (post.is_published) post.published_at = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from('noir_life_posts')
          .insert(post)
          .select(NOIR_LIFE_POST_COLUMNS)
          .single();
        if (error) throw error;
        return res.status(201).json({ post: data });
      }

      case 'PUT': {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required' });
        const updates = cleanPost(req.body);
        if ('title' in updates && !updates.title) {
          return res.status(400).json({ error: 'Title is required' });
        }
        updates.updated_at = new Date().toISOString();

        if (updates.is_published) {
          // Keep the original publish date when a published post is edited
          const { data: existing } = await supabaseAdmin
            .from('noir_life_posts')
            .select('published_at, is_published')
            .eq('id', id)
            .single();
          if (!existing?.is_published || !existing?.published_at) {
            updates.published_at = new Date().toISOString();
          }
        }

        const { data, error } = await supabaseAdmin
          .from('noir_life_posts')
          .update(updates)
          .eq('id', id)
          .select(NOIR_LIFE_POST_COLUMNS)
          .single();
        if (error) throw error;
        return res.status(200).json({ post: data });
      }

      case 'DELETE': {
        const id = typeof req.query.id === 'string' ? req.query.id : null;
        if (!id) return res.status(400).json({ error: 'id is required' });
        const { error } = await supabaseAdmin.from('noir_life_posts').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('[NOIR LIFE ADMIN] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
