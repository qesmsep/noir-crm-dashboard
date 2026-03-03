"use client";

import { MemberAuthProvider } from '@/context/MemberAuthContext';
import { ChakraProvider } from '@chakra-ui/react';
import { theme } from '@/theme';
// Temporarily disabled to fix startup issue
// import { ErrorBoundary } from '@/components/member/ErrorBoundary';

export default function MemberPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <ErrorBoundary>
      <ChakraProvider theme={theme}>
        <MemberAuthProvider>
          {children}
        </MemberAuthProvider>
      </ChakraProvider>
    // </ErrorBoundary>
  );
}
