import ChakraClientProvider from '../components/ChakraClientProvider';
import { AuthProvider } from '../lib/auth-context';
import { SettingsProvider } from '../context/SettingsContext';
import { Analytics } from '@vercel/analytics/react';
import ViewportHeightProvider from '../components/ViewportHeightProvider';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import './globals.css';

export const metadata = {
  title: 'Noir KC',
  description: "Kansas City's Speakeasy Cocktail Lounge",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      </head>
      <body className="font-sans">
        <ErrorBoundary>
          <ChakraClientProvider>
            <AuthProvider>
              <SettingsProvider>
                <ViewportHeightProvider />
                {children}
              </SettingsProvider>
            </AuthProvider>
          </ChakraClientProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
} 