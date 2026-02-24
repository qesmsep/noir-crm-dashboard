'use client';
import { useState, useEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { theme } from '../theme';

export default function ChakraClientProvider({ children }) {
  // Prevent SSR to avoid hydration mismatch with emotion styles
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // During SSR, render children without ChakraProvider
  if (!isClient) {
    return <>{children}</>;
  }

  // On client, wrap with ChakraProvider
  return (
    <ChakraProvider
      theme={theme}
      resetCSS={false}
      portalZIndex={40}
      toastOptions={{ defaultOptions: { position: 'bottom' } }}
    >
      {children}
    </ChakraProvider>
  );
} 