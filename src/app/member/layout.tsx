"use client";

import { MemberAuthProvider } from '@/context/MemberAuthContext';
import { ChakraProvider } from '@chakra-ui/react';
import { theme } from '@/theme';

export default function MemberPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChakraProvider theme={theme}>
      <MemberAuthProvider>
        {children}
      </MemberAuthProvider>
    </ChakraProvider>
  );
}
