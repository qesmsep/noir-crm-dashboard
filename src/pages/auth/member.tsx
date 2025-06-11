import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/auth';
import styles from '../../styles/Auth.module.css';

type AuthMethod = 'phone' | 'email';

export default function MemberAuth() {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'method' | 'otp' | 'password'>('method');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: true
        }
      });

      if (error) throw error;
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true
        }
      });

      if (error) throw error;
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: authMethod === 'phone' ? phone : undefined,
        email: authMethod === 'email' ? email : undefined,
        token: otp,
        type: 'sms'
      });

      if (error) throw error;
      setStep('password');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) throw error;
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Member Login - Lounge Reservation Portal</title>
      </Head>

      <main className={styles.main}>
        <div className={styles.authCard}>
          <h1>Member Login</h1>

          {step === 'method' && (
            <div className={styles.methodSelect}>
              <button
                className={`${styles.methodButton} ${authMethod === 'phone' ? styles.active : ''}`}
                onClick={() => setAuthMethod('phone')}
              >
                Phone Number
              </button>
              <button
                className={`${styles.methodButton} ${authMethod === 'email' ? styles.active : ''}`}
                onClick={() => setAuthMethod('email')}
              >
                Email
              </button>

              <form onSubmit={authMethod === 'phone' ? handlePhoneSubmit : handleEmailSubmit}>
                {authMethod === 'phone' ? (
                  <input
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className={styles.input}
                  />
                ) : (
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={styles.input}
                  />
                )}
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Continue'}
                </button>
              </form>
            </div>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOTPSubmit} className={styles.otpForm}>
              <p>Enter the verification code sent to your {authMethod}</p>
              <input
                type="text"
                placeholder="Enter verification code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
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

          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className={styles.passwordForm}>
              <p>Set your password</p>
              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={styles.input}
              />
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Setting Password...' : 'Set Password'}
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