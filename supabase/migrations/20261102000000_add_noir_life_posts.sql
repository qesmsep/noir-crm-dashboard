-- ========================================
-- Migration: Noir.life posts (member portal feed)
-- Created: 2026-11-02
-- Description: Posts that staff write in Admin > Noir.life and members read
--              from the Noir.life card in the member portal: news and updates.
--              Upcoming events are not stored here; the feed reads member events
--              from private_events. A post can link to one for its RSVP.
--
-- Tables Affected: noir_life_posts (new)
-- Dependencies: private_events
-- Breaking Changes: NO - new table only. Nothing existing is altered.
-- Access: RLS on with no policies, so only the server (service role) reads
--         and writes it. Member and admin API routes check auth first.
-- ========================================

CREATE TABLE IF NOT EXISTS public.noir_life_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club TEXT NOT NULL DEFAULT 'all' CHECK (club IN ('all', 'noir', 'noir-op')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  -- One or two lines shown on the feed card
  summary TEXT NOT NULL DEFAULT '',
  -- Photo shown on the feed card and at the top of the post
  cover_image_url TEXT,
  -- The post itself, built in Admin > Noir.life as an ordered list of blocks:
  --   {"type":"heading","text":...}
  --   {"type":"text","text":...}                       plain text, line breaks kept
  --   {"type":"image","url":...,"caption":...}
  --   {"type":"gallery","urls":[...]}
  --   {"type":"video","url":...}                       uploaded file or YouTube/Vimeo link
  --   {"type":"button","label":...,"action":"rsvp"|"reserve"|"link","url":...}
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
  -- Optional link to a member event in private_events; its RSVP shows on the post
  private_event_id UUID REFERENCES public.private_events(id) ON DELETE SET NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_noir_life_posts_feed
  ON public.noir_life_posts (is_published, is_pinned DESC, published_at DESC);

ALTER TABLE public.noir_life_posts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.noir_life_posts IS
  'Noir.life feed: posts built by staff from blocks, read by members in the portal.';

-- Starter posts so the feed is not empty on day one.
INSERT INTO public.noir_life_posts (club, title, summary, blocks, is_published, published_at)
SELECT 'all', 'Welcome to Noir.life',
       'News, member events and reservations, all in one place.',
       '[{"type":"text","text":"News from Noir and Noir OP, upcoming member events and reservations now live here. Check back often."}]'::jsonb,
       true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.noir_life_posts);

INSERT INTO public.noir_life_posts (club, title, summary, blocks, is_published, published_at)
SELECT 'noir-op', 'Noir OP: the lease is in its final round',
       'Design starts once the Corbin Park lease is signed.',
       '[{"type":"text","text":"The lease at Corbin Park is in its last round of edits. Design work starts once it is signed, and we will share it here as it comes together."}]'::jsonb,
       true, NOW() + INTERVAL '1 second'
WHERE (SELECT COUNT(*) FROM public.noir_life_posts) = 1;
