import ChakraClientProvider from '../components/ChakraClientProvider';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata = {
  title: 'Noir CRM Dashboard',
  description: 'Membership CRM and Lounge Reservation Portal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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