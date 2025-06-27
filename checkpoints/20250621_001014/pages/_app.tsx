import { AppContextProvider } from '../context/AppContext';
import MainNav from '../components/MainNav';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const hideNav = router.pathname.startsWith('/admin') || router.pathname === '/auth/admin';

  return (
    <AppContextProvider>
      {!hideNav && <MainNav />}
      <Component {...pageProps} />
    </AppContextProvider>
  );
} 