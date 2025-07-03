import React from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Button,
  Container,
  Icon,
  Card,
  CardBody,
  SimpleGrid,
  List,
  ListItem,
  ListIcon,
  Divider
} from '@chakra-ui/react';
import { 
  FiCheckCircle, 
  FiUsers, 
  FiShield, 
  FiCreditCard,
  FiFileText,
  FiArrowRight
} from 'react-icons/fi';

export default function MembershipLanding() {
  const router = useRouter();

  const features = [
    {
      icon: FiFileText,
      title: 'Simple Application',
      description: 'Complete our questionnaire in just a few minutes'
    },
    {
      icon: FiShield,
      title: 'Secure Process',
      description: 'Your information is encrypted and protected'
    },
    {
      icon: FiCreditCard,
      title: 'Easy Payment',
      description: 'Secure payment processing through Stripe'
    },
    {
      icon: FiUsers,
      title: 'Join Our Community',
      description: 'Become part of an exclusive membership'
    }
  ];

  const steps = [
    'Submit your initial information to join our waitlist',
    'Receive approval and invitation link via SMS',
    'Complete the detailed membership questionnaire',
    'Review and sign the membership agreement',
    'Submit your membership payment and await final approval'
  ];

  const handleApplyClick = () => {
    router.push('/waitlist');
  };

  return (
    <Container maxW="6xl" py={16}>
      <VStack spacing={16} align="stretch">
        {/* Hero Section */}
        <VStack spacing={8} textAlign="center">
          <VStack spacing={4}>
            <Heading size="2xl" color="blue.600">
              Join Our Exclusive Membership
            </Heading>
            <Text fontSize="xl" color="gray.600" maxW="3xl">
              Experience premium benefits, exclusive access, and be part of a distinguished community. 
              Our membership application process is simple, secure, and designed with you in mind.
            </Text>
          </VStack>

          <Button
            size="lg"
            colorScheme="blue"
            rightIcon={<Icon as={FiArrowRight} />}
            onClick={handleApplyClick}
            px={8}
            py={6}
            fontSize="lg"
          >
            Request Membership Invitation
          </Button>

          <Text fontSize="sm" color="gray.500">
            Join our waitlist - approved members will receive an invitation to apply
          </Text>
        </VStack>

        <Divider />

        {/* Features Section */}
        <VStack spacing={8}>
          <Heading size="lg" textAlign="center">
            Why Choose Our Membership?
          </Heading>
          
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
            {features.map((feature, index) => (
              <Card key={index} variant="outline">
                <CardBody textAlign="center">
                  <VStack spacing={4}>
                    <Icon as={feature.icon} boxSize={12} color="blue.500" />
                    <VStack spacing={2}>
                      <Heading size="md">{feature.title}</Heading>
                      <Text color="gray.600" fontSize="sm">
                        {feature.description}
                      </Text>
                    </VStack>
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </VStack>

        <Divider />

        {/* Application Process */}
        <VStack spacing={8}>
          <VStack spacing={2} textAlign="center">
            <Heading size="lg">Simple Application Process</Heading>
            <Text color="gray.600">
              Our streamlined process makes it easy to join our community
            </Text>
          </VStack>

          <Box maxW="2xl" mx="auto">
            <List spacing={4}>
              {steps.map((step, index) => (
                <ListItem key={index}>
                  <HStack align="start" spacing={4}>
                    <Box
                      bg="blue.500"
                      color="white"
                      rounded="full"
                      w={8}
                      h={8}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontSize="sm"
                      fontWeight="bold"
                      flexShrink={0}
                    >
                      {index + 1}
                    </Box>
                    <Text flex={1} pt={1}>
                      {step}
                    </Text>
                  </HStack>
                </ListItem>
              ))}
            </List>
          </Box>
        </VStack>

        <Divider />

        {/* Membership Benefits */}
        <VStack spacing={8}>
          <VStack spacing={2} textAlign="center">
            <Heading size="lg">Membership Benefits</Heading>
            <Text color="gray.600">
              Enjoy exclusive privileges and access to premium features
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} maxW="4xl" mx="auto">
            <VStack align="start" spacing={4}>
              <List spacing={3}>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="green.500" />
                  Exclusive access to member-only events
                </ListItem>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="green.500" />
                  Priority booking and reservations
                </ListItem>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="green.500" />
                  Networking opportunities with fellow members
                </ListItem>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="green.500" />
                  Access to premium facilities and amenities
                </ListItem>
              </List>
            </VStack>

            <VStack align="start" spacing={4}>
              <List spacing={3}>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="green.500" />
                  Complimentary guest privileges
                </ListItem>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="green.500" />
                  Special member pricing and discounts
                </ListItem>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="green.500" />
                  Concierge services and support
                </ListItem>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="green.500" />
                  Access to member directory and community
                </ListItem>
              </List>
            </VStack>
          </SimpleGrid>
        </VStack>

        {/* Call to Action */}
        <Box bg="blue.50" p={8} borderRadius="xl" textAlign="center">
          <VStack spacing={6}>
            <VStack spacing={2}>
              <Heading size="lg">Ready to Join?</Heading>
              <Text color="gray.600">
                Start your membership application today and become part of our exclusive community.
              </Text>
            </VStack>

            <Button
              size="lg"
              colorScheme="blue"
              rightIcon={<Icon as={FiArrowRight} />}
              onClick={handleApplyClick}
              px={8}
            >
              Join Our Waitlist
            </Button>

            <Text fontSize="xs" color="gray.500">
              Have questions? Contact us at membership@yourclub.com or (555) 123-4567
            </Text>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
}