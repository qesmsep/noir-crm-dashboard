"use client";
import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../lib/auth-context';
import { debugLog } from '../../utils/debugLogger';
import styles from '../../styles/AdminLayout.module.css';

interface AdminLayoutProps {
  children: ReactNode;
  isFullScreen?: boolean;
}

export default function AdminLayout({ children, isFullScreen = false }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = router.pathname; // Use Pages Router pathname instead
  const { user, loading, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Debug: Log component mount and state
  useEffect(() => {
    debugLog.setup('ADMIN LAYOUT', 'Component mounted');
    debugLog.setup('ADMIN LAYOUT', 'Router pathname', { pathname });
    debugLog.setup('ADMIN LAYOUT', 'Router isReady', { isReady: router.isReady });
    debugLog.setup('ADMIN LAYOUT', 'User state', { user: !!user, loading });
    
    return () => {
      debugLog.setup('ADMIN LAYOUT', 'Component unmounting');
    };
  }, [pathname, router.isReady, user?.id, loading]);

  // Prevent redirects during navigation
  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      debugLog.nav('ADMIN LAYOUT', 'Navigation starting', { url, pathname: router.pathname });
      setIsNavigating(true);
    };
    
    const handleRouteChangeComplete = (url: string) => {
      debugLog.info('ADMIN LAYOUT', 'Navigation completed', { 
        url,
        pathname: router.pathname,
        newPathname: router.pathname,
        isReady: router.isReady,
        timestamp: new Date().toISOString()
      });
      setIsNavigating(false);
      debugLog.info('ADMIN LAYOUT', 'isNavigating set to false', { 
        isNavigating: false,
        timestamp: new Date().toISOString()
      });
    };
    
    const handleRouteChangeError = (err: Error, url: string) => {
      debugLog.error('ADMIN LAYOUT', 'Navigation error', err, { url });
      setIsNavigating(false);
    };

    if (router?.events) {
      debugLog.setup('ADMIN LAYOUT', 'Setting up router event listeners');
      router.events.on('routeChangeStart', handleRouteChangeStart);
      router.events.on('routeChangeComplete', handleRouteChangeComplete);
      router.events.on('routeChangeError', handleRouteChangeError);

      return () => {
        debugLog.setup('ADMIN LAYOUT', 'Cleaning up router event listeners');
        router.events?.off('routeChangeStart', handleRouteChangeStart);
        router.events?.off('routeChangeComplete', handleRouteChangeComplete);
        router.events?.off('routeChangeError', handleRouteChangeError);
      };
    } else {
      debugLog.warn('ADMIN LAYOUT', 'Router events not available');
    }
  }, [router]);

  useEffect(() => {
    debugLog.setup('ADMIN LAYOUT', 'Redirect check', { loading, isNavigating, user: !!user, pathname });
    
    // Don't redirect if we're already navigating or loading
    if (loading || isNavigating) {
      debugLog.setup('ADMIN LAYOUT', 'Skipping redirect - loading or navigating');
      return;
    }
    
    // If user is logged in, don't do any redirects - let navigation work normally
    if (user) {
      debugLog.info('ADMIN LAYOUT', 'User is logged in - no redirect needed');
      return;
    }
    
    // Only redirect if user is not logged in and we're not already on auth page
    if (!user && pathname && !pathname.startsWith('/auth') && router.isReady) {
      debugLog.error('ADMIN LAYOUT', 'User not logged in, scheduling redirect to /auth/admin');
      // Small delay to prevent redirect loops during normal navigation
      const timeoutId = setTimeout(() => {
        if (!user && pathname && !pathname.startsWith('/auth')) {
          debugLog.error('ADMIN LAYOUT', 'Executing redirect to /auth/admin');
          router.replace('/auth/admin').catch((err) => {
            debugLog.error('ADMIN LAYOUT', 'Redirect error', err);
          });
        } else {
          debugLog.setup('ADMIN LAYOUT', 'Redirect cancelled - conditions changed');
        }
      }, 100);
      
      return () => {
        debugLog.setup('ADMIN LAYOUT', 'Clearing redirect timeout');
        clearTimeout(timeoutId);
      };
    }
  }, [user, loading, router, pathname, isNavigating]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/admin');
  };

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.loadingState}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navItems = [
    { href: '/admin/dashboard-v2', label: 'Dashboard', icon: '📊' },
    { href: '/admin/reservations', label: 'Reservations', icon: '📋' },
    { href: '/admin/members', label: 'Members', icon: '👥' },
    { href: '/admin/waitlist', label: 'Waitlist', icon: '🧭' },
    { href: '/admin/event-calendar', label: 'Events', icon: '🎯' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ];

  const initials = user?.email?.[0]?.toUpperCase() || 'N';

  return (
    <div className={styles.root}>
      <header className={styles.topNav}>
        <div className={styles.brand}>
          <Link href="/admin/dashboard-v2" className={styles.brandLink}>
            <Image 
              src="/images/noir-wedding-day.png" 
              alt="Noir Logo" 
              width={72} 
              height={36} 
              priority 
              style={{ objectFit: 'contain' }}
            />
          </Link>
        </div>

        <nav className={styles.navIcons}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navIconButton} ${pathname === item.href ? styles.navIconButtonActive : ''}`}
              title={item.label}
              onClick={(e) => {
                debugLog.nav('ADMIN LAYOUT', 'Link clicked', { 
                  href: item.href, 
                  pathname, 
                  isNavigating, 
                  loading, 
                  user: !!user 
                });
                // Ensure body scroll is unlocked before navigation
                if (typeof document !== 'undefined') {
                  document.body.style.overflow = '';
                  document.body.style.pointerEvents = '';
                }
              }}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>
      </header>

      <main className={`${styles.main} ${isFullScreen ? styles.fullScreen : ''}`}>
        <div className={styles.content}>{children}</div>
      </main>

      <div className={styles.userControls}>
        <button
          className={styles.userButton}
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        >
          <span className={styles.userAvatar}>{initials}</span>
        </button>
        {isUserMenuOpen && (
          <div className={styles.userMenu}>
            <Link href="/admin/profile" className={styles.userMenuItem}>
              Profile
            </Link>
            <button onClick={handleSignOut} className={styles.userMenuItem}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}