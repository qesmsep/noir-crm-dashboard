import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase, setupMFA, verifyMFA } from '../../lib/auth';
import styles from '../../styles/Auth.module.css';

type AuthStep = 'login' | 'mfa' | 'setup-mfa';

export default function AdminAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [step, setStep] = useState<AuthStep>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Check if user has MFA enabled
      const { data: profile } = await supabase
        .from('profiles')
        .select('mfa_enabled')
        .eq('id', data.user.id)
        .single();

      if (profile?.mfa_enabled) {
        setStep('mfa');
      } else {
        // Setup MFA for new admin
        const secret = await setupMFA(data.user.id);
        setMfaSecret(secret);
        setStep('setup-mfa');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMFASetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: challenge } = await supabase.auth.mfa.challenge({
        factorId: 'totp'
      });

      if (!challenge) throw new Error('Failed to create MFA challenge');

      await verifyMFA(user.id, 'totp', challenge.id, mfaCode);
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: challenge } = await supabase.auth.mfa.challenge({
        factorId: 'totp'
      });

      if (!challenge) throw new Error('Failed to create MFA challenge');

      await verifyMFA(user.id, 'totp', challenge.id, mfaCode);
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Admin Login - Lounge Reservation Portal</title>
      </Head>

      <main className={styles.main}>
        <div className={styles.authCard}>
          <h1>Admin Login</h1>

          {step === 'login' && (
            <form onSubmit={handleLogin} className={styles.loginForm}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={styles.input}
              />
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={styles.input}
              />
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          )}

          {step === 'setup-mfa' && (
            <div className={styles.mfaSetup}>
              <p>Scan this QR code with your authenticator app:</p>
              <div className={styles.qrCode}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSecret)}`}
                  alt="MFA QR Code"
                />
              </div>
              <form onSubmit={handleMFASetup} className={styles.mfaForm}>
                <input
                  type="text"
                  placeholder="Enter verification code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  className={styles.input}
                />
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Verify & Complete Setup'}
                </button>
              </form>
            </div>
          )}

          {step === 'mfa' && (
            <form onSubmit={handleMFAVerify} className={styles.mfaForm}>
              <p>Enter the verification code from your authenticator app</p>
              <input
                type="text"
                placeholder="Enter verification code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
                className={styles.input}
              />
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <button
            className={styles.backButton}
            onClick={() => router.push('/')}
          >
            Back to Home
          </button>
        </div>
      </main>
    </div>
  );
} 