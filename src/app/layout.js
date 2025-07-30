import ChakraClientProvider from '../components/ChakraClientProvider';
import { AuthProvider } from '../lib/auth-context';
import { SettingsProvider } from '../context/SettingsContext';
import { Analytics } from '@vercel/analytics/react';
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
        <ChakraClientProvider>
          <AuthProvider>
            <SettingsProvider>
              {children}
            </SettingsProvider>
          </AuthProvider>
        </ChakraClientProvider>
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function setVH() {
                  const vh = window.innerHeight * 0.01;
                  document.documentElement.style.setProperty('--vh', vh + 'px');
                }

                // Set initial value
                setVH();

                // Update on resize
                window.addEventListener('resize', setVH);
                
                // Update on orientation change
                window.addEventListener('orientationchange', function() {
                  // Delay to ensure orientation change is complete
                  setTimeout(setVH, 100);
                });
                
                // Update when virtual keyboard appears/disappears (iOS)
                if ('visualViewport' in window) {
                  window.visualViewport.addEventListener('resize', setVH);
                }
              })();
            `,
          }}
        />
      </body>
    </html>
  );
} 