import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Button,
  Input,
  VStack,
  HStack,
  Text,
  Heading,
  useToast,
  FormControl,
  FormLabel,
  InputGroup,
  InputRightElement,
  Link,
  Alert,
  AlertIcon,
  Spinner,
  Divider,
  Card,
  CardBody,
  useColorModeValue,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, PhoneIcon, EmailIcon } from '@chakra-ui/icons';
import { supabase } from '../../lib/auth';

type AuthStep = 'method' | 'credentials' | 'otp' | 'password' | 'reset';
type AuthMethod = 'phone' | 'email';

export default function MemberLogin() {
  const [step, setStep] = useState<AuthStep>('method');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  
  const router = useRouter();
  const toast = useToast();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

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
    return '+1' + phone.replace(/\D/g, '');
  };

  const handleMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const identifier = authMethod === 'phone' ? normalizePhone(phone) : email;
      
      // Check if user exists and has a password
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: authMethod === 'phone' ? identifier : email,
        password: 'temp-check', // This will fail but help us determine if user exists
      });

      // If sign in fails with invalid credentials, user might exist but wrong password
      if (signInError && signInError.message.includes('Invalid login credentials')) {
        setIsReturningUser(true);
        setStep('credentials');
      } else if (signInError && signInError.message.includes('Email not confirmed')) {
        // User exists but not confirmed, send OTP
        await sendOTP();
      } else {
        // New user, send OTP for registration
        await sendOTP();
      }
    } catch (err: any) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async () => {
    try {
      const otpData = authMethod === 'phone' 
        ? { phone: normalizePhone(phone) }
        : { email };

      const { error } = await supabase.auth.signInWithOtp({
        ...otpData,
        options: {
          shouldCreateUser: true,
        }
      });

      if (error) throw error;
      setStep('otp');
      toast({
        title: 'Verification code sent',
        description: `Check your ${authMethod} for the verification code`,
        status: 'success',
        duration: 5000,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const identifier = authMethod === 'phone' ? normalizePhone(phone) : email;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authMethod === 'phone' ? identifier : email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid credentials. Please check your phone number and password.');
        } else {
          setError(error.message);
        }
        return;
      }

      if (data.user) {
        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
          status: 'success',
          duration: 3000,
        });
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
      const verifyData = authMethod === 'phone' 
        ? { phone: normalizePhone(phone), type: 'sms' as const }
        : { email, type: 'email' as const };

      const { data, error } = await supabase.auth.verifyOtp({
        ...verifyData,
        token: otp,
      });

      if (error) throw error;

      if (data.user) {
        if (isReturningUser) {
          // Existing user, redirect to portal
          router.push('/member-portal');
        } else {
          // New user, need to set password
          setStep('password');
        }
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
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      toast({
        title: 'Account setup complete!',
        description: 'Welcome to Noir. Redirecting to your member portal...',
        status: 'success',
        duration: 3000,
      });

      // Create member profile
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        await fetch('/api/member-portal/create-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.user.id,
            phone: authMethod === 'phone' ? normalizePhone(phone) : '',
            email: authMethod === 'email' ? email : '',
          }),
        });
      }

      router.push('/member-portal');
    } catch (err: any) {
      setError('Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setLoading(true);
    setError('');

    try {
      const identifier = authMethod === 'phone' ? normalizePhone(phone) : email;
      
      const { error } = await supabase.auth.resetPasswordForEmail(
        authMethod === 'phone' ? identifier : email
      );

      if (error) throw error;

      toast({
        title: 'Password reset sent',
        description: `Check your ${authMethod === 'phone' ? 'phone' : 'email'} for reset instructions`,
        status: 'success',
        duration: 5000,
      });
      setStep('method');
    } catch (err: any) {
      setError('Failed to send password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderMethodSelection = () => (
    <VStack spacing={6}>
      <VStack spacing={2}>
        <Heading size="lg" color="#ECEDE8">Welcome to Noir</Heading>
        <Text color="#BCA892" textAlign="center">
          Sign in to access your member portal
        </Text>
      </VStack>

      <HStack spacing={4} width="100%">
        <Button
          flex={1}
          variant={authMethod === 'phone' ? 'solid' : 'outline'}
          colorScheme={authMethod === 'phone' ? 'orange' : 'gray'}
          leftIcon={<PhoneIcon />}
          onClick={() => setAuthMethod('phone')}
        >
          Phone
        </Button>
        <Button
          flex={1}
          variant={authMethod === 'email' ? 'solid' : 'outline'}
          colorScheme={authMethod === 'email' ? 'orange' : 'gray'}
          leftIcon={<EmailIcon />}
          onClick={() => setAuthMethod('email')}
        >
          Email
        </Button>
      </HStack>

      <Box as="form" onSubmit={handleMethodSubmit} width="100%">
        <VStack spacing={4}>
          <FormControl isRequired>
            <FormLabel color="#ECEDE8">
              {authMethod === 'phone' ? 'Phone Number' : 'Email Address'}
            </FormLabel>
            {authMethod === 'phone' ? (
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={handlePhoneChange}
                maxLength={14}
                bg="white"
                color="black"
              />
            ) : (
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                bg="white"
                color="black"
              />
            )}
          </FormControl>

          <Button
            type="submit"
            colorScheme="orange"
            size="lg"
            width="100%"
            isLoading={loading}
            loadingText="Checking..."
          >
            Continue
          </Button>
        </VStack>
      </Box>
    </VStack>
  );

  const renderCredentialsForm = () => (
    <VStack spacing={6}>
      <VStack spacing={2}>
        <Heading size="lg" color="#ECEDE8">Welcome Back</Heading>
        <Text color="#BCA892" textAlign="center">
          Enter your password to continue
        </Text>
      </VStack>

      <Box as="form" onSubmit={handleCredentialsSubmit} width="100%">
        <VStack spacing={4}>
          <FormControl>
            <FormLabel color="#ECEDE8">
              {authMethod === 'phone' ? 'Phone Number' : 'Email'}
            </FormLabel>
            <Input
              value={authMethod === 'phone' ? phone : email}
              isReadOnly
              bg="gray.100"
              color="gray.600"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel color="#ECEDE8">Password</FormLabel>
            <InputGroup>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                bg="white"
                color="black"
              />
              <InputRightElement>
                <Button
                  variant="ghost"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <ViewOffIcon /> : <ViewIcon />}
                </Button>
              </InputRightElement>
            </InputGroup>
          </FormControl>

          <Button
            type="submit"
            colorScheme="orange"
            size="lg"
            width="100%"
            isLoading={loading}
            loadingText="Signing in..."
          >
            Sign In
          </Button>

          <Link
            color="#BCA892"
            onClick={handlePasswordReset}
            textAlign="center"
            fontSize="sm"
          >
            Forgot your password?
          </Link>
        </VStack>
      </Box>

      <Button
        variant="ghost"
        color="#BCA892"
        onClick={() => setStep('method')}
      >
        ← Back
      </Button>
    </VStack>
  );

  const renderOTPForm = () => (
    <VStack spacing={6}>
      <VStack spacing={2}>
        <Heading size="lg" color="#ECEDE8">Verify Your Identity</Heading>
        <Text color="#BCA892" textAlign="center">
          Enter the verification code sent to your {authMethod}
        </Text>
      </VStack>

      <Box as="form" onSubmit={handleOTPSubmit} width="100%">
        <VStack spacing={4}>
          <FormControl isRequired>
            <FormLabel color="#ECEDE8">Verification Code</FormLabel>
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              textAlign="center"
              fontSize="xl"
              letterSpacing="0.2em"
              bg="white"
              color="black"
            />
          </FormControl>

          <Button
            type="submit"
            colorScheme="orange"
            size="lg"
            width="100%"
            isLoading={loading}
            loadingText="Verifying..."
          >
            Verify Code
          </Button>

          <Text color="#BCA892" fontSize="sm" textAlign="center">
            Didn't receive a code?{' '}
            <Link onClick={sendOTP} color="orange.300">
              Resend
            </Link>
          </Text>
        </VStack>
      </Box>

      <Button
        variant="ghost"
        color="#BCA892"
        onClick={() => setStep('method')}
      >
        ← Back
      </Button>
    </VStack>
  );

  const renderPasswordForm = () => (
    <VStack spacing={6}>
      <VStack spacing={2}>
        <Heading size="lg" color="#ECEDE8">Create Your Password</Heading>
        <Text color="#BCA892" textAlign="center">
          Set a secure password for your account
        </Text>
      </VStack>

      <Box as="form" onSubmit={handlePasswordSubmit} width="100%">
        <VStack spacing={4}>
          <FormControl isRequired>
            <FormLabel color="#ECEDE8">Password</FormLabel>
            <InputGroup>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                bg="white"
                color="black"
              />
              <InputRightElement>
                <Button
                  variant="ghost"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <ViewOffIcon /> : <ViewIcon />}
                </Button>
              </InputRightElement>
            </InputGroup>
            <Text fontSize="xs" color="#BCA892" mt={1}>
              Password must be at least 8 characters long
            </Text>
          </FormControl>

          <Button
            type="submit"
            colorScheme="orange"
            size="lg"
            width="100%"
            isLoading={loading}
            loadingText="Creating account..."
            isDisabled={password.length < 8}
          >
            Complete Setup
          </Button>
        </VStack>
      </Box>
    </VStack>
  );

  return (
    <Box
      minH="100vh"
      bg="#23201C"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
    >
      <Head>
        <title>Member Login - Noir</title>
      </Head>

      <Card
        maxW="md"
        w="100%"
        bg="#28251F"
        borderColor="#3A362F"
        borderWidth={1}
        shadow="xl"
      >
        <CardBody p={8}>
          {error && (
            <Alert status="error" mb={6} borderRadius="md">
              <AlertIcon />
              <Text fontSize="sm">{error}</Text>
            </Alert>
          )}

          {step === 'method' && renderMethodSelection()}
          {step === 'credentials' && renderCredentialsForm()}
          {step === 'otp' && renderOTPForm()}
          {step === 'password' && renderPasswordForm()}

          <Divider my={6} borderColor="#3A362F" />

          <VStack spacing={3}>
            <Text color="#BCA892" fontSize="sm" textAlign="center">
              Need help? Contact our concierge team
            </Text>
            <Button
              variant="link"
              color="#BCA892"
              fontSize="sm"
              onClick={() => router.push('/')}
            >
              ← Back to Home
            </Button>
          </VStack>
        </CardBody>
      </Card>
    </Box>
  );
}