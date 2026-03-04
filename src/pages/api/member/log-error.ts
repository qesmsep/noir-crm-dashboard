import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Log client-side errors to database for admin review
 *
 * This helps track issues members encounter without hiding them
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      message,
      level,
      context,
      error_details,
      stack_trace,
      timestamp,
    } = req.body;

    // Get member ID from session (if available)
    let memberId: string | null = null;
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (sessionToken) {
      const { data: session } = await supabaseAdmin
        .from('member_portal_sessions')
        .select('member_id')
        .eq('session_token', sessionToken)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (session) {
        memberId = session.member_id;
      }
    }

    // Check if error_logs table exists, if not, skip database logging
    // (This prevents errors during development if table isn't created yet)
    const { error: insertError } = await supabaseAdmin
      .from('member_portal_error_logs')
      .insert({
        member_id: memberId,
        error_message: message,
        error_level: level || 'error',
        error_context: context || {},
        error_details: error_details || {},
        stack_trace: stack_trace || null,
        user_agent: req.headers['user-agent'] || null,
        url: context?.page || null,
        occurred_at: timestamp || new Date().toISOString(),
      });

    if (insertError) {
      // If table doesn't exist, just log to console - don't fail the request
      console.error('Error logging to database (table may not exist):', insertError);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    // Don't fail - error logging shouldn't break the app
    console.error('Error in log-error endpoint:', error);
    res.status(200).json({ success: true }); // Return success anyway
  }
}
