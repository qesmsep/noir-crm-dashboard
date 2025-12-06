'use client';
import { ChakraProvider } from '@chakra-ui/react';
import { theme } from '../theme';

export default function ChakraClientProvider({ children }) {
  return (
    <ChakraProvider
      theme={theme}
      resetCSS={false}
      portalZIndex={40}
    >
      {children}
    </ChakraProvider>
  );
} 