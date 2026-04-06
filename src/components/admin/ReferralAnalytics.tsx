import React, { useState, useEffect } from 'react';
import styles from '../../styles/ReferralAnalytics.module.css';

interface ReferralStats {
  member_id: string;
  first_name: string;
  last_name: string;
  referral_code: string;
  total_clicks: number;
  conversions: number;
  conversion_rate: number;
}

interface UnconvertedClick {
  referrer_name: string;
  clicked_at: string;
  ip_address: string | null;
}

interface ConvertedReferral {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  submitted_at: string;
}

export default function ReferralAnalytics() {
  const [stats, setStats] = useState<ReferralStats[]>([]);
  const [unconvertedClicks, setUnconvertedClicks] = useState<UnconvertedClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'stats' | 'unconverted'>('stats');
  const [selectedMember, setSelectedMember] = useState<ReferralStats | null>(null);
  const [convertedReferrals, setConvertedReferrals] = useState<ConvertedReferral[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/referral-analytics');

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setStats(data.stats || []);
      setUnconvertedClicks(data.unconvertedClicks || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConvertedReferrals = async (memberId: string) => {
    setDetailsLoading(true);
    try {
      const response = await fetch(`/api/admin/referral-details?memberId=${memberId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch referral details');
      }

      const data = await response.json();
      setConvertedReferrals(data.referrals || []);
    } catch (error) {
      console.error('Error fetching referral details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCardClick = (member: ReferralStats) => {
    setSelectedMember(member);
    fetchConvertedReferrals(member.member_id);
  };

  const handleDeleteReferral = async (referralId: string) => {
    if (!confirm('Are you sure you want to delete this referral entry?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/referral-delete?id=${referralId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete referral');
      }

      // Refresh the data
      if (selectedMember) {
        fetchConvertedReferrals(selectedMember.member_id);
      }
      fetchAnalytics();
    } catch (error) {
      console.error('Error deleting referral:', error);
      alert('Failed to delete referral');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h2>Referral Analytics</h2>
          <p>Track referral link clicks and conversion rates</p>
        </div>
        <button onClick={fetchAnalytics} className={styles.refreshButton}>
          <svg className={styles.refreshIcon} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* View Toggle */}
      <div className={styles.viewToggle}>
        <button
          onClick={() => setView('stats')}
          className={`${styles.toggleButton} ${view === 'stats' ? styles.toggleButtonActive : ''}`}
        >
          Member Stats
        </button>
        <button
          onClick={() => setView('unconverted')}
          className={`${styles.toggleButton} ${view === 'unconverted' ? styles.toggleButtonActive : ''}`}
        >
          Unconverted Clicks ({unconvertedClicks.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      ) : view === 'stats' ? (
        <div className={styles.statsGrid}>
          {stats.length === 0 ? (
            <div className={styles.empty}>
              <p>No referral activity yet</p>
            </div>
          ) : (
            stats.map((stat) => (
              <div
                key={stat.member_id}
                className={styles.statCard}
                onClick={() => handleCardClick(stat)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.statHeader}>
                  <div>
                    <div className={styles.memberName}>
                      {stat.first_name} {stat.last_name}
                    </div>
                    <div className={styles.referralCode}>{stat.referral_code}</div>
                  </div>
                  <div className={styles.conversionBadge}>
                    {stat.conversion_rate}%
                  </div>
                </div>
                <div className={styles.statMetrics}>
                  <div className={styles.metric}>
                    <div className={styles.metricLabel}>Referrals</div>
                    <div className={styles.metricValue}>{stat.total_clicks}</div>
                  </div>
                  <div className={styles.metric}>
                    <div className={styles.metricLabel}>Converted</div>
                    <div className={styles.metricValue}>{stat.conversions}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className={styles.clicksList}>
          {unconvertedClicks.length === 0 ? (
            <div className={styles.empty}>
              <p>No unconverted clicks</p>
            </div>
          ) : (
            unconvertedClicks.map((click, idx) => (
              <div key={idx} className={styles.clickCard}>
                <div className={styles.clickInfo}>
                  <div className={styles.clickMember}>{click.referrer_name}'s link</div>
                  <div className={styles.clickTime}>{formatDate(click.clicked_at)}</div>
                </div>
                {click.ip_address && (
                  <div className={styles.clickIp}>{click.ip_address}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Referral Details Modal */}
      {selectedMember && (
        <div className={styles.modalOverlay} onClick={() => setSelectedMember(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{selectedMember.first_name} {selectedMember.last_name}'s Referrals</h3>
                <p className={styles.modalSubtitle}>
                  {selectedMember.conversions} converted out of {selectedMember.total_clicks} total
                </p>
              </div>
              <button onClick={() => setSelectedMember(null)} className={styles.closeButton}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {detailsLoading ? (
              <div className={styles.modalLoading}>
                <div className={styles.spinner} />
              </div>
            ) : (
              <div className={styles.referralsList}>
                {convertedReferrals.length === 0 ? (
                  <div className={styles.empty}>
                    <p>No converted referrals yet</p>
                  </div>
                ) : (
                  convertedReferrals.map((referral) => (
                    <div key={referral.id} className={styles.referralItem}>
                      <div className={styles.referralInfo}>
                        <div className={styles.referralName}>
                          {referral.first_name} {referral.last_name}
                        </div>
                        <div className={styles.referralDate}>
                          {formatDate(referral.submitted_at)}
                        </div>
                      </div>
                      <div className={styles.referralActions}>
                        <div className={`${styles.referralStatus} ${styles[`status${referral.status}`]}`}>
                          {referral.status.toUpperCase()}
                        </div>
                        <button
                          onClick={() => handleDeleteReferral(referral.id)}
                          className={styles.deleteButton}
                          title="Delete referral"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
