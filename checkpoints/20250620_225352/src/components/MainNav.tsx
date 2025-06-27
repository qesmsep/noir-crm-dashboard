import React from 'react';
import { Box, HStack, Button, Image } from '@chakra-ui/react';
import Link from 'next/link';
import { useAppContext } from '../context/AppContext';

export default function MainNav() {
  const { user } = useAppContext();
  return (
    <Box as="nav" position="fixed" top={0} left={0} width="100%" zIndex={100} px={8} py={5} display="flex" alignItems="center" justifyContent="space-between" bg="rgba(255,255,255,0.20)" boxShadow="sm">
      <Image src="/images/noir-wedding-day.png" alt="Noir" height="48px" objectFit="contain" />
      <HStack spacing={2}>
        <Button as={Link} href="/" size="sm" variant="ghost" color="white">Home</Button>
        <Button as={Link} href="/members" size="sm" variant="ghost" color="white">Members</Button>
        <Button as={Link} href="/admin" size="sm" variant="ghost" color="white">Admin</Button>
        <Button as={Link} href="/reserve" size="sm" colorScheme="blue" color="white">Book Now</Button>
        {user && (
          <Button as={Link} href="/admin/logout" size="sm" colorScheme="red" color="white">Logout</Button>
        )}
      </HStack>
    </Box>
  );
} 