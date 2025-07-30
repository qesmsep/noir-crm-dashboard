"use client";
import { ReactNode, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import styles from '../../styles/AdminLayout.module.css';
import Image from 'next/image';

interface AdminLayoutProps {
  children: ReactNode;
  isFullScreen?: boolean;
}

export default function AdminLayout({ children, isFullScreen = false }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/admin');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/admin');
  };

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated
  if (!user) {
    return null;
  }

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/admin/members', label: 'Members', icon: '👥' },
    { href: '/admin/waitlist', label: 'Waitlist', icon: '⏳' },
    { href: '/admin/calendar', label: 'Calendar', icon: '📅' },
    { href: '/admin/communication', label: 'Communication', icon: '📝' },
    { href: '/admin/questionnaires', label: 'Questionnaires', icon: '🧾' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
    { href: '/admin/admins', label: 'Admins', icon: '👑' },
  ];

  return (
    <div className={styles.container}>
      {/* Mobile header with logo and hamburger menu */}
      <div className={styles.mobileHeader}>
        <div className={styles.mobileLogo}>
          <Link href="/">
            <Image src="/images/noir-wedding-day.png" alt="Noir Logo" width={80} height={40} style={{ objectFit: 'contain' }} />
          </Link>
        </div>
        <button
          className={styles.menuButton}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <span className={styles.menuIcon}>☰</span>
        </button>
      </div>
      
      {!isFullScreen && (
        <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <Link href="/">
            <Image src="/images/noir-wedding-day.png" alt="Noir Logo" width={120} height={60} style={{ objectFit: 'contain', marginBottom: '1rem' }} />
          </Link>
        </div>
        <div className={styles.navItems} style={{ marginTop: '1rem' }}>
          <Link
            href="/"
            className={styles.navItem}
          >
            <span className={styles.icon} style={{ marginRight: '0.75rem' }}>🏠</span>
            <span>Home</span>
          </Link>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
            >
              <span className={styles.icon} style={{ marginRight: '0.75rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className={styles.userSection}>
          <button
            className={styles.userButton}
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <span className={styles.userAvatar}>
              {user?.email?.[0].toUpperCase()}
            </span>
            <span className={styles.userEmail}>{user?.email}</span>
          </button>

          {isUserMenuOpen && (
            <div className={styles.userMenu}>
              <Link href="/admin/profile" className={styles.menuItem}>
                Profile
              </Link>
              <button onClick={handleSignOut} className={styles.menuItem}>
                Sign Out
              </button>
            </div>
          )}
        </div>
        </nav>
      )}

      <main className={styles.main} style={{ background: 'none', boxShadow: 'none', border: 'none' }}>
        <div className={styles.content}>{children}</div>
      </main>

      {/* Mobile menu: only nav links, no logo or sidebar content */}
      <div className={`${styles.mobileMenu} ${isMenuOpen ? styles.open : ''}`} role="navigation" aria-label="Mobile navigation menu">
        <nav className={styles.mobileNavLinks}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.mobileNavItem} ${pathname === item.href ? styles.active : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          
          {/* Sign Out Button */}
          <button
            onClick={() => {
              setIsMenuOpen(false);
              handleSignOut();
            }}
            className={styles.mobileNavItem}
            style={{ background: 'none', border: 'none', cursor: 'pointer', width: '90%' }}
          >
            <span className={styles.icon}>🚪</span>
            <span>Sign Out</span>
          </button>
        </nav>
      </div>
    </div>
  );
} 