import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'member' | 'admin'>('member');
  const router = useRouter();

  return (
    <div className={styles.container}>
      <Head>
        <title>Lounge Reservation Portal</title>
        <meta name="description" content="Member and admin portal for lounge reservations" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to the Lounge
        </h1>

        <div className={styles.authToggle}>
          <button
            className={`${styles.tabButton} ${activeTab === 'member' ? styles.active : ''}`}
            onClick={() => setActiveTab('member')}
          >
            Member Login
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'admin' ? styles.active : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Admin Login
          </button>
        </div>

        <div className={styles.authContainer}>
          {activeTab === 'member' ? (
            <div className={styles.memberAuth}>
              <h2>Member Access</h2>
              <p>Sign in to manage your reservations and profile</p>
              <button
                className={styles.primaryButton}
                onClick={() => router.push('/auth/member')}
              >
                Continue as Member
              </button>
            </div>
          ) : (
            <div className={styles.adminAuth}>
              <h2>Admin Access</h2>
              <p>Secure admin portal with MFA required</p>
              <button
                className={styles.primaryButton}
                onClick={() => router.push('/auth/admin')}
              >
                Continue as Admin
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Lounge Reservation Portal</p>
      </footer>
    </div>
  );
} 