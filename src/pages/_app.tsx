import { AppContextProvider } from '../context/AppContext';
import { SettingsProvider } from '../context/SettingsContext';
import MainNav from '../components/MainNav';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const hideNav = router.pathname.startsWith('/admin') || router.pathname === '/auth/admin' || router.pathname.startsWith('/questionnaire');

  return (
    <SettingsProvider>
      <AppContextProvider>
        {!hideNav && <MainNav />}
        <Component {...pageProps} />
      </AppContextProvider>
    </SettingsProvider>
  );
} 