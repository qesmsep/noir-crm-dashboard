import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase, setupMFA, verifyMFA } from '../../lib/auth';
import styles from '../../styles/Auth.module.css';

interface MfaSecret {
  id: string;
  type: 'totp';
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
  friendly_name?: string;
}

function AdminAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [step, setStep] = useState<'login' | 'setup-mfa' | 'verify-mfa'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<MfaSecret | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // TEMPORARY: Skip MFA setup and go straight to dashboard
        router.push('/admin/dashboard');
        return;
        // --- Original MFA logic below (commented out) ---
        // const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        // if (mfaData?.currentLevel !== 'aal2') {
        //   const secret = await setupMFA(data.user.id);
        //   setMfaSecret(secret);
        //   setStep('setup-mfa');
        // } else {
        //   router.push('/admin/dashboard');
        // }
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
    setError(null);

    try {
      if (!mfaSecret) throw new Error('MFA secret not found');

      const { data: challenge } = await supabase.auth.mfa.challenge({
        factorId: mfaSecret.id,
      });

      if (!challenge) throw new Error('Failed to create MFA challenge');

      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaSecret.id,
        challengeId: challenge.id,
        code: mfaCode,
      });

      if (error) throw error;

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
    setError(null);

    try {
      if (!mfaSecret) throw new Error('MFA secret not found');

      const { data: challenge } = await supabase.auth.mfa.challenge({
        factorId: mfaSecret.id,
      });

      if (!challenge) throw new Error('Failed to create MFA challenge');

      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaSecret.id,
        challengeId: challenge.id,
        code: mfaCode,
      });

      if (error) throw error;

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
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSecret?.totp.secret || '')}`}
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

          {step === 'verify-mfa' && (
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

AdminAuth.getLayout = function PageLayout(page: React.ReactNode) {
  return <>{page}</>;
};

export default AdminAuth;