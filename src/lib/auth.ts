import { createClient } from '@supabase/supabase-js';
import { RateLimiter } from 'limiter';
import React, { useEffect, useState } from 'react';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configure rate limiter
const limiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 'minute'
});

// Types
export interface User {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: {
    phone?: string;
  };
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

// Auth middleware
export const authMiddleware = async (req: Request) => {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'No token provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return user;
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// MFA utilities
export const setupMFA = async (userId: string) => {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp'
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error setting up MFA:', error);
    throw error;
  }
};

export const verifyMFA = async (userId: string, challengeId: string, code: string) => {
  try {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId: userId,
      challengeId,
      code
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error verifying MFA:', error);
    throw error;
  }
};

// Auth hook
export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setState(prev => ({ ...prev, error: error as Error, loading: false }));
        return;
      }
      setState(prev => ({ ...prev, user: session?.user ?? null, loading: false }));
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({ ...prev, user: session?.user ?? null, loading: false }));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const signUp = async (email: string, password: string, phone?: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            phone
          }
        }
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const signOut = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  return {
    ...state,
    signIn,
    signUp,
    signOut
  };
};

// Export rate limiter for use in API routes
export const checkRateLimit = async (endpoint: string) => {
  const hasToken = await limiter.tryRemoveTokens(1);
  
  if (!hasToken) {
    throw new Error('Rate limit exceeded');
  }
  
  return true;
}; 