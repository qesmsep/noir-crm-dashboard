"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

// Member type based on database schema
interface Member {
  member_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  membership: 'Skyline' | 'Duo' | 'Solo' | 'Annual';
  balance?: number; // Calculated from ledger transactions
  monthly_credit: number;
  last_credit_date: string | null;
  credit_renewal_date: string | null;
  deactivated: boolean;
  auth_user_id: string | null;
  profile_photo_url: string | null;
  password_is_temporary?: boolean;
  contact_preferences: {
    sms: boolean;
    email: boolean;
  };
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MemberAuthContextType {
  user: User | null;
  member: Member | null;
  loading: boolean;

  // Magic Link Auth
  signInWithMagicLink: (email: string) => Promise<void>;

  // Phone/SMS OTP Auth
  signInWithPhone: (phone: string) => Promise<void>;
  verifyOTP: (phone: string, token: string) => Promise<void>;

  // Phone + Password Auth
  signInWithPassword: (phone: string, password: string) => Promise<boolean>;
  setPassword: (phone: string, otpCode: string, newPassword: string) => Promise<void>;

  // Biometric Auth (Face ID / Touch ID)
  signInWithBiometric: (phone: string) => Promise<void>;
  registerBiometric: (deviceName?: string) => Promise<void>;
  isBiometricAvailable: () => Promise<boolean>;

  // Sign Out
  signOut: () => Promise<void>;

  // Refresh member data
  refreshMember: () => Promise<void>;
}

const MemberAuthContext = createContext<MemberAuthContextType | undefined>(undefined);

export function MemberAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch member data from session (httpOnly cookie)
  const fetchMemberFromSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/check-session', {
        credentials: 'include',
      });

      if (!response.ok) {
        // 401 is expected when not logged in - don't log as error
        setMember(null);
        return;
      }

      const data = await response.json();
      setMember(data.member as Member);
    } catch (error) {
      // Only log unexpected errors
      if (error instanceof Error && !error.message.includes('401')) {
        console.error('Error fetching member from session:', error);
      }
      setMember(null);
    }
  }, []);

  // Legacy: Fetch member data from Supabase Auth (for email magic links)
  const fetchMemberFromAuth = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      if (error) {
        // PGRST116 (no rows) is expected for non-member users - don't log
        if (error.code !== 'PGRST116') {
          console.error('Error fetching member from auth:', error);
        }
        setMember(null);
        return;
      }

      setMember(data as Member);
    } catch (error) {
      // Only log unexpected errors
      console.error('Error in fetchMemberFromAuth:', error);
      setMember(null);
    }
  }, []);

  // Track session in member_portal_sessions table
  const trackSession = useCallback(async (userId: string, memberId: string) => {
    try {
      // Only run in browser
      if (typeof window === 'undefined') return;

      // Get user agent
      const userAgent = navigator.userAgent;

      // Create session token
      const sessionToken = crypto.randomUUID();

      // Session expires in 30 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error } = await supabase
        .from('member_portal_sessions')
        .insert({
          member_id: memberId,
          session_token: sessionToken,
          user_agent: userAgent,
          last_activity: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        });

      if (error) {
        console.error('Error tracking session:', error);
      }
    } catch (error) {
      console.error('Error in trackSession:', error);
    }
  }, []);

  // Update session activity
  const updateSessionActivity = useCallback(async () => {
    if (!member || typeof window === 'undefined') return;

    try {
      const { error } = await supabase
        .from('member_portal_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('member_id', member.member_id)
        .gte('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error updating session activity:', error);
      }
    } catch (error) {
      console.error('Error in updateSessionActivity:', error);
    }
  }, [member]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      // First, check for httpOnly cookie session (password/biometric login)
      await fetchMemberFromSession();

      // If no session, check for Supabase Auth session (email magic link)
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user && !member) {
        await fetchMemberFromAuth(session.user.id);
      }

      setLoading(false);
    };

    initAuth();

    // Listen for Supabase auth state changes (email magic link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchMemberFromAuth(session.user.id);
      } else if (!member) {
        // Only clear member if we don't have a session cookie
        await fetchMemberFromSession();
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchMemberFromSession, fetchMemberFromAuth]);

  // Track member when they sign in
  useEffect(() => {
    if (user && member) {
      trackSession(user.id, member.member_id);
    }
  }, [user, member, trackSession]);

  // Update session activity every 5 minutes
  useEffect(() => {
    if (!member) return;

    const interval = setInterval(() => {
      updateSessionActivity();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [member, updateSessionActivity]);

  // Sign in with magic link (email)
  const signInWithMagicLink = useCallback(async (email: string) => {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/member/dashboard`
      : 'http://localhost:3000/member/dashboard';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) throw error;
  }, []);

  // Sign in with phone (SMS OTP via OpenPhone)
  const signInWithPhone = useCallback(async (phone: string) => {
    const response = await fetch('/api/auth/send-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send verification code');
    }
  }, []);

  // Verify OTP code (custom implementation)
  const verifyOTP = useCallback(async (phone: string, token: string) => {
    const response = await fetch('/api/auth/verify-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone, code: token }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Invalid verification code');
    }

    // Refresh member data from session
    await fetchMemberFromSession();
  }, [fetchMemberFromSession]);

  // Sign in with phone + password
  const signInWithPassword = useCallback(async (phone: string, password: string) => {
    const response = await fetch('/api/auth/login-phone-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Refresh member data from session
    await fetchMemberFromSession();

    // Return whether password is temporary so caller can redirect
    return data.passwordIsTemporary || false;
  }, [fetchMemberFromSession]);

  // Set/reset password (requires OTP verification first)
  const setPassword = useCallback(async (phone: string, otpCode: string, newPassword: string) => {
    const response = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otpCode, newPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to set password');
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    // Call logout endpoint to clear httpOnly cookie and delete session
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    // Sign out from Supabase Auth (for email magic links)
    await supabase.auth.signOut();

    setMember(null);
    setUser(null);
  }, []);

  // Check if biometric is available
  const isBiometricAvailable = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    try {
      if (!window.PublicKeyCredential || !navigator.credentials) {
        return false;
      }

      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }, []);

  // Sign in with biometric (Face ID / Touch ID)
  const signInWithBiometric = useCallback(async (phone: string) => {
    // Step 1: Get challenge from server
    const challengeResponse = await fetch('/api/auth/biometric/login-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const challengeData = await challengeResponse.json();

    if (!challengeResponse.ok) {
      throw new Error(challengeData.error || 'Failed to get biometric challenge');
    }

    // Step 2: Get credential from authenticator
    const credential = await navigator.credentials.get({
      publicKey: {
        ...challengeData.options,
        challenge: Uint8Array.from(atob(challengeData.challenge), c => c.charCodeAt(0)),
        allowCredentials: challengeData.options.allowCredentials?.map((cred: any) => ({
          ...cred,
          id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        })),
      },
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Biometric authentication cancelled');
    }

    // Step 3: Verify with server
    const verifyResponse = await fetch('/api/auth/biometric/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: {
          id: credential.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          response: {
            authenticatorData: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).authenticatorData))),
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
            signature: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).signature))),
            userHandle: (credential.response as AuthenticatorAssertionResponse).userHandle
              ? btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).userHandle!)))
              : null,
          },
          type: credential.type,
        },
        challenge: challengeData.challenge,
        memberId: challengeData.memberId,
      }),
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      throw new Error(verifyData.error || 'Biometric verification failed');
    }

    // Refresh member data from session
    await fetchMemberFromSession();
  }, [fetchMemberFromSession]);

  // Register biometric credential
  const registerBiometric = useCallback(async (deviceName?: string) => {
    // Step 1: Get registration challenge
    const challengeResponse = await fetch('/api/auth/biometric/register-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    const challengeData = await challengeResponse.json();

    if (!challengeResponse.ok) {
      throw new Error(challengeData.error || 'Failed to get registration challenge');
    }

    // Step 2: Create credential with authenticator
    const credential = await navigator.credentials.create({
      publicKey: {
        ...challengeData.options,
        challenge: Uint8Array.from(atob(challengeData.challenge), c => c.charCodeAt(0)),
        user: {
          ...challengeData.options.user,
          id: Uint8Array.from(atob(challengeData.options.user.id), c => c.charCodeAt(0)),
        },
        excludeCredentials: challengeData.options.excludeCredentials?.map((cred: any) => ({
          ...cred,
          id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        })),
      },
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Biometric registration cancelled');
    }

    // Step 3: Verify and store credential
    const verifyResponse = await fetch('/api/auth/biometric/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        credential: {
          id: credential.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          response: {
            attestationObject: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAttestationResponse).attestationObject))),
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
            transports: (credential.response as AuthenticatorAttestationResponse).getTransports?.() || [],
          },
          type: credential.type,
        },
        challenge: challengeData.challenge,
        deviceName,
      }),
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      throw new Error(verifyData.error || 'Failed to save biometric credential');
    }
  }, []);

  // Refresh member data
  const refreshMember = useCallback(async () => {
    await fetchMemberFromSession();

    // If no session cookie, try Supabase Auth
    if (!member && user) {
      await fetchMemberFromAuth(user.id);
    }
  }, [member, user, fetchMemberFromSession, fetchMemberFromAuth]);

  const value = useMemo(() => ({
    user,
    member,
    loading,
    signInWithMagicLink,
    signInWithPhone,
    verifyOTP,
    signInWithPassword,
    setPassword,
    signInWithBiometric,
    registerBiometric,
    isBiometricAvailable,
    signOut,
    refreshMember,
  }), [user, member, loading, signInWithMagicLink, signInWithPhone, verifyOTP, signInWithPassword, setPassword, signInWithBiometric, registerBiometric, isBiometricAvailable, signOut, refreshMember]);

  return (
    <MemberAuthContext.Provider value={value}>
      {children}
    </MemberAuthContext.Provider>
  );
}

export function useMemberAuth() {
  const context = useContext(MemberAuthContext);
  if (context === undefined) {
    throw new Error('useMemberAuth must be used within a MemberAuthProvider');
  }
  return context;
}
