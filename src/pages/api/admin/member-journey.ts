import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveAdmin } from '@/lib/admin-auth';
import { todayChicago } from '@/lib/businessMetricsCore';
import { ACTION_KEYS, renderText, stepsFor } from '@/lib/memberJourney';
import {
  loadJourney,
  loadSettings,
  loadSteps,
  loadTodaysMembers,
  saveSettings,
} from '@/lib/memberJourneyData';

/**
 * Admin > 90-day member journey.
 *
 * GET                      -> { today, ready, settings, steps, roster, todaysMembers }
 * POST { memberId, key }   -> mark a team action done for a member
 * PUT  { settings }        -> turn the series on or off, change the footer
 * PUT  { step }            -> edit one text (body, day, label, on/off)
 *
 * Turning the series on for the first time sets its start date to today, so
 * only members who join from then on get the texts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await resolveAdmin(req.headers.authorization?.split(' ')[1]);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });

  try {
    const today = todayChicago();

    if (req.method === 'GET') {
      const [state, todaysMembers] = await Promise.all([loadJourney(today), loadTodaysMembers(today)]);
      const sample = stepsFor(state.steps, true);
      return res.status(200).json({
        today,
        ready: state.ready,
        settings: state.settings,
        steps: state.steps.map(s => ({
          ...s,
          postPublished: s.post_id ? state.publishedPostIds.has(s.post_id) : null,
          // How the text reads on a member's phone, with a sample name
          preview: s.is_active
            ? renderText({
                step: s,
                firstName: 'Alex',
                referralCode: 'ALEX123',
                n: sample.findIndex(x => x.key === s.key) + 1,
                total: sample.length,
                footer: state.settings.footer,
              })
            : null,
        })),
        roster: state.roster,
        todaysMembers,
      });
    }

    if (req.method === 'POST') {
      const { memberId, key } = req.body || {};
      if (typeof memberId !== 'string' || !ACTION_KEYS.includes(key)) {
        return res.status(400).json({ error: 'memberId and a valid action key are required' });
      }
      const { error } = await supabaseAdmin.from('member_journey_log').upsert(
        {
          member_id: memberId,
          step_key: key,
          kind: 'action',
          status: 'done',
          created_by: admin.user.email || admin.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'member_id,step_key' }
      );
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PUT') {
      const { settings, step } = req.body || {};

      if (settings && typeof settings === 'object') {
        const current = await loadSettings();
        const next = { ...current };
        if (typeof settings.enabled === 'boolean') next.enabled = settings.enabled;
        if (typeof settings.footer === 'string') next.footer = settings.footer.trim().slice(0, 300);
        if (next.enabled && !next.start_date) next.start_date = today;
        if (next.enabled) {
          const { ready } = await loadSteps();
          if (!ready) return res.status(400).json({ error: 'The journey tables have not been set up yet.' });
        }
        await saveSettings(next);
        return res.status(200).json({ settings: next });
      }

      if (step && typeof step === 'object' && typeof step.key === 'string') {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof step.body === 'string') {
          const body = step.body.trim();
          if (!body || body.length > 1000) return res.status(400).json({ error: 'The text must be 1 to 1000 characters.' });
          updates.body = body;
        }
        if (typeof step.label === 'string' && step.label.trim()) updates.label = step.label.trim().slice(0, 100);
        if (Number.isInteger(step.day_offset) && step.day_offset >= 0 && step.day_offset <= 90) updates.day_offset = step.day_offset;
        if (typeof step.is_active === 'boolean') updates.is_active = step.is_active;
        const { data, error } = await supabaseAdmin
          .from('member_journey_steps')
          .update(updates)
          .eq('key', step.key)
          .select('key')
          .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Text not found' });
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Nothing to update' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[MEMBER JOURNEY ADMIN] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
