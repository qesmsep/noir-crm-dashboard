"use client";
import { ReactNode, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import styles from '../../styles/AdminLayout.module.css';
import Image from 'next/image';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/admin');
  };

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/admin/members', label: 'Members', icon: '👥' },
    { href: '/admin/waitlist', label: 'Waitlist', icon: '⏳' },
    { href: '/admin/calendar', label: 'Calendar', icon: '📅' },
    { href: '/admin/templates', label: 'Templates', icon: '📝' },
    { href: '/admin/questionnaires', label: 'Questionnaires', icon: '🧾' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
    { href: '/admin/admins', label: 'Admins', icon: '👑' },
  ];

  return (
    <div className={styles.container}>
      {/* Mobile transparent header with logo and hamburger menu */}
      <header className={styles.mobileHeader}>
        <Link href="/" className={styles.mobileLogo} aria-label="Home">
          <Image src="/images/noir-wedding-day.png" alt="Noir Logo" width={100} height={40} style={{ objectFit: 'contain' }} />
        </Link>
        <button
          className={styles.menuButton}
          aria-label="Open navigation menu"
          onClick={() => setIsMenuOpen((open) => !open)}
          type="button"
        >
          <span style={{ fontSize: 32, lineHeight: 1, fontWeight: 700 }}>☰</span>
        </button>
      </header>
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

      <main className={styles.main} style={{ background: 'none', boxShadow: 'none', border: 'none' }}>
        <div className={styles.content}>{children}</div>
      </main>

      {/* Mobile menu: only nav links, no logo or sidebar content */}
      <div className={`${styles.mobileMenu} ${isMenuOpen ? 'open' : ''}`} role="navigation" aria-label="Mobile navigation menu">
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
        </nav>
      </div>
    </div>
  );
} 