import ChakraClientProvider from '../components/ChakraClientProvider';
import { AuthProvider } from '../lib/auth-context';
import './globals.css';

export const metadata = {
  title: 'Noir CRM Dashboard',
  description: 'Membership CRM and Lounge Reservation Portal',
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
            {children}
          </AuthProvider>
        </ChakraClientProvider>
      </body>
    </html>
  );
} 