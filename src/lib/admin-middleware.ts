import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Verify that the request comes from an authenticated admin user.
 * Checks for valid Bearer token and active admin status in database.
 *
 * @param request - The incoming request object
 * @returns Object with authorized status and either user data or error response
 */
export async function verifyAdminAccess(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    };
  }

  const { data: adminData } = await supabase
    .from('admins')
    .select('access_level, status')
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!adminData) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    };
  }

  return { authorized: true, user, adminData };
}
