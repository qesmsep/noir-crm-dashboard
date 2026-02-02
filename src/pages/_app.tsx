import '../app/globals.css';
import { AppContextProvider } from '../context/AppContext';
import { SettingsProvider } from '../context/SettingsContext';
import { AuthProvider } from '../lib/auth-context';
import MainNav from '../components/MainNav';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from '@vercel/analytics/react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const hideNav = router.pathname.startsWith('/admin') || router.pathname === '/auth/admin' || router.pathname.startsWith('/questionnaire');

  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContextProvider>
          {!hideNav && <MainNav />}
          <Component {...pageProps} />
          <Toaster />
          <Analytics />
        </AppContextProvider>
      </SettingsProvider>
    </AuthProvider>
  );
} 