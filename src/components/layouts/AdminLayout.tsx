import { ReactNode, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import styles from '@/styles/AdminLayout.module.css';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
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
    { href: '/admin/reservations', label: 'Reservations', icon: '📅' },
    { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className={styles.container}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <Link href="/admin/dashboard">
            <span>Noir CRM</span>
          </Link>
        </div>

        <div className={styles.navItems}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${
                router.pathname === item.href ? styles.active : ''
              }`}
            >
              <span className={styles.icon}>{item.icon}</span>
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

      <main className={styles.main}>
        <header className={styles.header}>
          <button
            className={styles.menuButton}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className={styles.menuIcon}>☰</span>
          </button>
          <h1 className={styles.pageTitle}>
            {navItems.find((item) => item.href === router.pathname)?.label ||
              'Dashboard'}
          </h1>
        </header>

        <div className={styles.content}>{children}</div>
      </main>

      {isMenuOpen && (
        <div className={styles.mobileMenu}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.mobileNavItem} ${
                router.pathname === item.href ? styles.active : ''
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 