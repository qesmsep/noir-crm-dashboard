import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/auth';
import styles from '../../styles/Auth.module.css';

type AuthStep = 'phone' | 'otp' | 'password' | 'credentials';

export default function MemberLogin() {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  const router = useRouter();

  const formatPhoneNumber = (value: string) => {
    const phone = value.replace(/\D/g, '');
    const match = phone.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return !match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const normalizePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    
    // If it's already 11 digits and starts with 1, add +
    if (digits.length === 11 && digits.startsWith('1')) {
      return '+' + digits;
    }
    
    // If it's 10 digits, add +1
    if (digits.length === 10) {
      return '+1' + digits;
    }
    
    // If it's already 11 digits and doesn't start with 1, assume it's international
    if (digits.length === 11 && !digits.startsWith('1')) {
      return '+' + digits;
    }
    
    // If it's already 12 digits and starts with 1, it might already have +
    if (digits.length === 12 && digits.startsWith('1')) {
      return '+' + digits.substring(1);
    }
    
    // Default: add +1 for US numbers
    return '+1' + digits;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First, check if user exists by trying to get their profile
      const { data: existingProfile } = await supabase
        .from('members')
        .select('member_id, has_password, user_id')
        .eq('phone', normalizePhone(phone))
        .single();

      if (existingProfile) {
        // User exists - check if they have a password set
        if (existingProfile.has_password) {
          // User has password, go to credentials step
          setIsNewUser(false);
          setStep('credentials');
        } else {
          // User exists but no password, send OTP for password setup
          setIsNewUser(false);
          await sendOTP();
        }
      } else {
        // New user, send OTP for registration
        setIsNewUser(true);
        await sendOTP();
      }
    } catch (err: any) {
      // If no profile found, treat as new user
      setIsNewUser(true);
      await sendOTP();
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async () => {
    try {
      // Generate a 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in database with expiration
      const { error: otpError } = await supabase
        .from('otp_codes')
        .insert({
          phone: normalizePhone(phone),
          code: otpCode,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
          used: false
        });

      if (otpError) throw otpError;

      // Send SMS via your API
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizePhone(phone),
          message: `Your Noir verification code is: ${otpCode}. This code expires in 10 minutes.`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send verification code');
      }

      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // For phone users, we need to use the phone as the email in Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizePhone(phone),
        password,
      });

      if (error) {
        setError('Invalid phone number or password. Please try again.');
        return;
      }

      if (data.user) {
        router.push('/member-portal');
      }
    } catch (err: any) {
      setError('An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Verify OTP from database
      const { data: otpData, error: otpError } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('phone', normalizePhone(phone))
        .eq('code', otp)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (otpError || !otpData) {
        setError('Invalid or expired verification code. Please try again.');
        return;
      }

      // Mark OTP as used
      await supabase
        .from('otp_codes')
        .update({ used: true })
        .eq('id', otpData.id);

      if (isNewUser) {
        // New user, need to set password
        setStep('password');
      } else {
        // Existing user without password, need to set password
        setStep('password');
      }
    } catch (err: any) {
      setError('Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create user in Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizePhone(phone),
        password: password,
        options: {
          data: {
            phone: normalizePhone(phone)
          }
        }
      });

      if (authError) throw authError;

      // Create or update member profile
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('members')
          .upsert({
            user_id: authData.user.id,
            phone: normalizePhone(phone),
            first_name: '',
            last_name: '',
            email: normalizePhone(phone), // Use phone as email for Supabase auth
            has_password: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'phone'
          });

        if (profileError && !profileError.message.includes('duplicate key')) {
          console.error('Profile creation error:', profileError);
        }
      }

      router.push('/member-portal');
    } catch (err: any) {
      setError('An error occurred while setting up your account.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setLoading(true);
    setError('');

    try {
      await sendOTP();
      setError('');
      alert('Password reset code sent to your phone. Please check your messages.');
    } catch (err: any) {
      setError('Failed to send password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Member Login - Noir</title>
      </Head>

      <main className={styles.main}>
        <div className={styles.authCard}>
          <h1>Member Login</h1>

          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className={styles.loginForm}>
              <p>Enter your phone number to access your member portal</p>
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={handlePhoneChange}
                required
                className={styles.input}
              />
              <p style={{ fontSize: '0.8rem', color: '#BCA892', marginTop: '0.5rem' }}>
                Enter your 10-digit US phone number
              </p>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className={styles.loginForm}>
              <p>Welcome back! Please enter your password.</p>
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
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button
                type="button"
                className={styles.backButton}
                onClick={handlePasswordReset}
              >
                Forgot your password?
              </button>
            </form>
          )}

          {step === 'otp' && (
            <div className={styles.otpForm}>
              <p>Enter the verification code sent to your phone</p>
              <form onSubmit={handleOTPSubmit}>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
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
              <button
                type="button"
                className={styles.backButton}
                onClick={sendOTP}
              >
                Resend Code
              </button>
            </div>
          )}

          {step === 'password' && (
            <div className={styles.passwordForm}>
              <p>{isNewUser ? 'Create a secure password for your account' : 'Set a password for your account'}</p>
              <form onSubmit={handlePasswordSubmit}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className={styles.input}
                />
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ marginBottom: '1rem' }}
                >
                  {showPassword ? 'Hide Password' : 'Show Password'}
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={loading || password.length < 8}
                >
                  {loading ? 'Setting up account...' : 'Complete Setup'}
                </button>
              </form>
            </div>
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