import '../app/globals.css';
import { AppContextProvider } from '../context/AppContext';
import { SettingsProvider } from '../context/SettingsContext';
import { AuthProvider } from '../lib/auth-context';
import MainNav from '../components/MainNav';
import ViewportHeightProvider from '../components/ViewportHeightProvider';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from '@vercel/analytics/react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const hideNav = router.pathname.startsWith('/admin') || router.pathname === '/auth/admin' || router.pathname.startsWith('/questionnaire');

  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContextProvider>
          <Head>
            {/* Overrides Next's default `width=device-width, initial-scale=1`.
                `viewport-fit=cover` is the part that matters: without it
                `env(safe-area-inset-*)` resolves to 0, so every safe-area
                padding rule in globals.css is a no-op and the iOS home
                indicator sits on top of drawer footer buttons. The scale
                allowances mirror app/layout.js and keep pinch-zoom available. */}
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover"
            />
          </Head>
          {/* Sets --vh to a real pixel value. globals.css declares `--vh: 1vh`
              only as a fallback and every `calc(100 * var(--vh))` drawer rule
              depends on this overwriting it. It was mounted in app/layout.js
              (App Router) but not here, so on every Pages Router page — which
              is all of /admin — those rules silently resolved to plain 100vh
              and overflowed on mobile browsers, where 100vh includes the URL
              bar. */}
          <ViewportHeightProvider />
          {!hideNav && <MainNav />}
          <Component {...pageProps} />
          <Toaster />
          <Analytics />
        </AppContextProvider>
      </SettingsProvider>
    </AuthProvider>
  );
} 