-- Rollback: 90-day member journey
-- Removes the two journey tables and the settings row.
-- The seven how-to posts are removed only while they are still unpublished
-- drafts; a post someone has published is left alone.

DROP TABLE IF EXISTS public.member_journey_log;
DROP TABLE IF EXISTS public.member_journey_steps;

DELETE FROM public.system_settings WHERE key = 'member_journey';

DELETE FROM public.noir_life_posts
WHERE is_published = false
  AND id IN (
    'a3d1f0c2-5b1e-4c61-9a01-000000000001',
    'a3d1f0c2-5b1e-4c61-9a01-000000000002',
    'a3d1f0c2-5b1e-4c61-9a01-000000000003',
    'a3d1f0c2-5b1e-4c61-9a01-000000000004',
    'a3d1f0c2-5b1e-4c61-9a01-000000000005',
    'a3d1f0c2-5b1e-4c61-9a01-000000000006',
    'a3d1f0c2-5b1e-4c61-9a01-000000000007'
  );
