"use client";

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Switch,
  Spinner,
  Center,
  useToast,
  Icon,
  Badge,
  Divider,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react';
import { CheckIcon, LockIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';
import { useMemberAuth } from '@/context/MemberAuthContext';
import MemberNav from '@/components/member/MemberNav';

export default function MemberSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { member, loading, registerBiometric, isBiometricAvailable } = useMemberAuth();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricDevices, setBiometricDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!loading && !member) {
      router.push('/member/login');
    } else if (member) {
      checkBiometric();
      fetchBiometricDevices();
    }
  }, [member, loading, router]);

  const checkBiometric = async () => {
    const available = await isBiometricAvailable();
    setBiometricAvailable(available);
  };

  const fetchBiometricDevices = async () => {
    try {
      const response = await fetch('/api/member/biometric-devices', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBiometricDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Error fetching biometric devices:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleEnrollBiometric = async () => {
    setEnrolling(true);

    try {
      const deviceName = `${navigator.platform} - ${new Date().toLocaleDateString()}`;
      await registerBiometric(deviceName);

      toast({
        title: 'Biometric enrolled',
        description: 'Face ID / Touch ID has been enabled for your account',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });

      await fetchBiometricDevices();
    } catch (error: any) {
      toast({
        title: 'Enrollment failed',
        description: error.message || 'Failed to enroll biometric',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    try {
      const response = await fetch('/api/member/remove-biometric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deviceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove device');
      }

      toast({
        title: 'Device removed',
        description: 'Biometric authentication removed for this device',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      await fetchBiometricDevices();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove device',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  if (loading || loadingDevices) {
    return (
      <Center minH="100vh" bg="#ECEDE8">
        <Spinner size="xl" color="#A59480" />
      </Center>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <Box minH="100vh" bg="#ECEDE8" pb="80px">
      {/* Header */}
      <Box
        bg="white"
        borderBottom="1px solid"
        borderColor="#ECEAE5"
        position="sticky"
        top={0}
        zIndex={10}
      >
        <Container maxW="container.xl">
          <HStack justify="space-between" py={4}>
            <Box
              as="img"
              src="/images/noir-wedding-day.png"
              alt="Noir"
              h="32px"
              cursor="pointer"
              onClick={() => router.push('/member/dashboard')}
            />
          </HStack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.md" py={{ base: 4, md: 6, lg: 8 }}>
        <VStack spacing={6} align="stretch">
          {/* Header */}
          <Box>
            <Heading size="xl" color="#1F1F1F" mb={2}>
              Security Settings
            </Heading>
            <Text color="#5A5A5A">
              Manage your security preferences
            </Text>
          </Box>

          {/* Password Card */}
          <Card
            bg="white"
            borderRadius="16px"
            border="1px solid"
            borderColor="#ECEAE5"
            boxShadow="sm"
          >
            <CardHeader>
              <HStack spacing={3}>
                <Icon as={LockIcon} color="#A59480" boxSize={5} />
                <Heading size="md" color="#1F1F1F">
                  Password
                </Heading>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" color="#5A5A5A">
                  Keep your account secure with a strong password
                </Text>
                <Button
                  variant="outline"
                  borderColor="#A59480"
                  color="#A59480"
                  _hover={{ bg: '#A59480', color: 'white' }}
                  onClick={() => router.push('/member/change-password')}
                >
                  Change Password
                </Button>
              </VStack>
            </CardBody>
          </Card>

          {/* Biometric Authentication Card */}
          <Card
            bg="white"
            borderRadius="16px"
            border="1px solid"
            borderColor="#ECEAE5"
            boxShadow="sm"
          >
            <CardHeader>
              <Heading size="md" color="#1F1F1F">
                Biometric Authentication
              </Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                {!biometricAvailable ? (
                  <Alert status="info" borderRadius="8px">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">
                      Biometric authentication is not available on this device. You need Face ID, Touch ID, or Windows Hello to use this feature.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Text fontSize="sm" color="#5A5A5A">
                      Use Face ID or Touch ID to sign in quickly and securely
                    </Text>

                    {biometricDevices.length > 0 ? (
                      <VStack spacing={3} align="stretch">
                        <Text fontSize="sm" fontWeight="medium" color="#1F1F1F">
                          Enrolled Devices ({biometricDevices.length})
                        </Text>
                        {biometricDevices.map((device) => (
                          <HStack
                            key={device.id}
                            justify="space-between"
                            p={3}
                            bg="#F6F5F2"
                            borderRadius="8px"
                          >
                            <VStack align="flex-start" spacing={1}>
                              <HStack spacing={2}>
                                <Icon as={CheckIcon} color="#4CAF50" boxSize={3} />
                                <Text fontSize="sm" fontWeight="medium" color="#1F1F1F">
                                  {device.device_name}
                                </Text>
                              </HStack>
                              <Text fontSize="xs" color="#8C7C6D">
                                Last used: {new Date(device.last_used_at).toLocaleDateString()}
                              </Text>
                            </VStack>
                            <Button
                              size="sm"
                              variant="ghost"
                              color="#F44336"
                              _hover={{ bg: '#FFEBEE' }}
                              onClick={() => handleRemoveDevice(device.id)}
                            >
                              Remove
                            </Button>
                          </HStack>
                        ))}
                      </VStack>
                    ) : (
                      <Text fontSize="sm" color="#8C7C6D">
                        No devices enrolled yet
                      </Text>
                    )}

                    <Button
                      bg="#A59480"
                      color="white"
                      _hover={{ bg: '#8C7C6D' }}
                      onClick={handleEnrollBiometric}
                      isLoading={enrolling}
                      loadingText="Enrolling..."
                    >
                      Add This Device
                    </Button>
                  </>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* Account Actions Card */}
          <Card
            bg="white"
            borderRadius="16px"
            border="1px solid"
            borderColor="#ECEAE5"
            boxShadow="sm"
          >
            <CardHeader>
              <Heading size="md" color="#1F1F1F">
                Account Actions
              </Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Button
                  variant="ghost"
                  justifyContent="flex-start"
                  color="#2C2C2C"
                  _hover={{ bg: '#F6F5F2', color: '#A59480' }}
                  onClick={() => router.push('/member/profile')}
                >
                  Edit Profile
                </Button>
                <Button
                  variant="ghost"
                  justifyContent="flex-start"
                  color="#F44336"
                  _hover={{ bg: '#FFEBEE' }}
                  onClick={async () => {
                    // Add sign out logic
                    router.push('/member/login');
                  }}
                >
                  Sign Out
                </Button>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Container>

      {/* Bottom Navigation */}
      <MemberNav />
    </Box>
  );
}
