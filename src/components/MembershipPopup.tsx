"use client";

import React, { useEffect, useState } from 'react';
import styles from '../styles/MembershipPopup.module.css';

interface MembershipPopupProps {
  initialDelayMs?: number;
  reappearDays?: number;
}

const STORAGE_KEY = 'noir.membership_popup.dismissed_at';

export default function MembershipPopup({ initialDelayMs = 5000, reappearDays = 7 }: MembershipPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    const dismissedAtIso = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (dismissedAtIso) {
      const dismissedAt = new Date(dismissedAtIso);
      const now = new Date();
      const ms = reappearDays * 24 * 60 * 60 * 1000;
      if (now.getTime() - dismissedAt.getTime() < ms) {
        return; // still within cool-down
      }
    }

    const timer = setTimeout(() => setIsVisible(true), initialDelayMs);
    return () => clearTimeout(timer);
  }, [initialDelayMs, reappearDays]);

  const close = () => {
    setIsAnimatingOut(true);
    const nowIso = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, nowIso);
    } catch {}
    setTimeout(() => setIsVisible(false), 250);
  };

  if (!isVisible) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="membership-popup-title">
      <div className={`${styles.card} ${isAnimatingOut ? styles.cardExit : styles.cardEnter}`}>
        <button className={styles.close} onClick={close} aria-label="Close">
          ×
        </button>
        <div className={styles.logoWrap} aria-label="Noir KC">
          <img src="/images/noir-wedding-day.png" alt="Noir KC" className={styles.logo} />
        </div>
        <h2 id="membership-popup-title" className={styles.headline}>
          <span className={styles.accent}>Exclusive Access</span> is coming
        </h2>
        <div className={styles.subline}>
          Noir will be exclusively for Members on <strong>January 1, 2026</strong> — or once membership capacity is reached.
        </div>
        <div className={styles.body}>
          <p className={styles.keyline}>
            <span className={styles.highlight}>Limited memberships available.</span>
          </p>
          <p className={styles.infoLine}>For more information or to ask questions:</p>
          <p className={styles.ctaLine}>
            Text <strong>MEMBERSHIP</strong> to <a href="sms:9137774488?body=MEMBERSHIP" className={styles.link} aria-label="Text MEMBERSHIP to 913.777.4488">913.777.4488</a>
          </p>
        </div>
        <div className={styles.actions}>
          <a href="sms:9137774488?body=MEMBERSHIP" className={styles.cta} aria-label="Start SMS about membership">
            Text MEMBERSHIP
          </a>
          <button className={styles.secondary} onClick={close} aria-label="Dismiss">Dismiss</button>
        </div>
      </div>
    </div>
  );
}


