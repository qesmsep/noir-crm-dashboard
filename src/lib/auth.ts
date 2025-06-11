import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from 'limiter';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});

// Rate limiter configuration
const rateLimiters = new Map<string, RateLimiter>();

export const getRateLimiter = (ip: string) => {
  if (!rateLimiters.has(ip)) {
    rateLimiters.set(ip, new RateLimiter({
      tokensPerInterval: 10,
      interval: 'minute'
    }));
  }
  return rateLimiters.get(ip)!;
};

// Authentication middleware
export async function authMiddleware(req: NextRequest) {
  const ip = req.ip || 'unknown';
  const limiter = getRateLimiter(ip);
  
  // Check rate limit
  const hasToken = await limiter.tryRemoveTokens(1);
  if (!hasToken) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  // Get session from cookie
  const cookieStore = cookies();
  const supabaseToken = cookieStore.get('sb-auth-token')?.value;

  if (!supabaseToken) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(supabaseToken);
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check if user is blocked
    const { data: profile } = await supabase
      .from('profiles')
      .select('status, failed_login_attempts')
      .eq('id', user.id)
      .single();

    if (profile?.status === 'suspended' || profile?.failed_login_attempts >= 5) {
      return NextResponse.json(
        { error: 'Account suspended' },
        { status: 403 }
      );
    }

    // Add user to request
    const request = req.clone();
    request.headers.set('x-user-id', user.id);
    
    return NextResponse.next({
      request
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// MFA utilities
export const setupMFA = async (userId: string) => {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp'
    });
    
    if (error) throw error;
    
    // Store MFA secret in profile
    await supabase
      .from('profiles')
      .update({
        mfa_enabled: true,
        mfa_secret: data.totp.uri
      })
      .eq('id', userId);
    
    return data.totp.uri;
  } catch (error) {
    console.error('MFA setup error:', error);
    throw error;
  }
};

export const verifyMFA = async (userId: string, factorId: string, challengeId: string, code: string) => {
  try {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code
    });
    
    if (error) throw error;
    
    // Reset failed attempts on successful verification
    await supabase
      .from('profiles')
      .update({ failed_login_attempts: 0 })
      .eq('id', userId);
    
    return data;
  } catch (error) {
    // Increment failed attempts
    await supabase
      .from('profiles')
      .update({
        failed_login_attempts: supabase.rpc('increment_failed_attempts')
      })
      .eq('id', userId);
    
    throw error;
  }
};

// Session management
export const createSession = async (userId: string, deviceInfo: any) => {
  try {
    const { data, error } = await supabase
      .from('device_sessions')
      .insert({
        user_id: userId,
        device_id: deviceInfo.id,
        device_name: deviceInfo.name
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Session creation error:', error);
    throw error;
  }
};

export const invalidateAllSessions = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('device_sessions')
      .delete()
      .eq('user_id', userId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Session invalidation error:', error);
    throw error;
  }
};

// Audit logging
export const logAuditEvent = async (
  userId: string,
  action: string,
  details: any,
  req: NextRequest
) => {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action,
        details,
        ip_address: req.ip,
        user_agent: req.headers.get('user-agent')
      });
    
    if (error) throw error;
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}; 