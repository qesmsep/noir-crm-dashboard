import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';
import { NOIR_LIFE_POST_COLUMNS, isMissingTable } from '@/lib/noirLife';

/**
 * Noir.life feed for the logged-in member.
 * GET            -> { posts, events } (published posts + upcoming member events)
 * GET ?id=<uuid> -> { post } (one published post)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionToken = parse(req.headers.cookie || '').member_session;
  if (!sessionToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { data: session } = await supabaseAdmin
    .from('member_portal_sessions')
    .select('member_id')
    .eq('session_token', sessionToken)
    .gte('expires_at', new Date().toISOString())
    .single();

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  try {
    const id = typeof req.query.id === 'string' ? req.query.id : null;

    if (id) {
      const { data: post, error } = await supabaseAdmin
        .from('noir_life_posts')
        .select(NOIR_LIFE_POST_COLUMNS)
        .eq('id', id)
        .eq('is_published', true)
        .maybeSingle();

      if (error && !isMissingTable(error)) throw error;
      if (!post) return res.status(404).json({ error: 'Post not found' });
      return res.status(200).json({ post });
    }

    const nowIso = new Date().toISOString();

    const [postsResult, eventsResult] = await Promise.all([
      supabaseAdmin
        .from('noir_life_posts')
        .select(NOIR_LIFE_POST_COLUMNS)
        .eq('is_published', true)
        .lte('published_at', nowIso)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('private_events')
        .select('id, title, start_time, end_time, event_description, rsvp_enabled, rsvp_url, background_image_url')
        .eq('is_member_event', true)
        .gte('end_time', nowIso)
        .order('start_time', { ascending: true })
        .limit(20),
    ]);

    if (postsResult.error && !isMissingTable(postsResult.error)) throw postsResult.error;
    if (eventsResult.error) throw eventsResult.error;

    return res.status(200).json({
      posts: postsResult.data || [],
      events: eventsResult.data || [],
    });
  } catch (error) {
    console.error('[NOIR LIFE] feed error:', error);
    return res.status(500).json({ error: 'Failed to load Noir.life' });
  }
}
