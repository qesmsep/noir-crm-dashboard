import React, { useState, useEffect, useCallback } from 'react';
import WaitlistReviewDrawer from '../WaitlistReviewDrawer';
import styles from '../../styles/Waitlist.module.css';

interface WaitlistEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  referral?: string;
  how_did_you_hear?: string;
  why_noir?: string;
  occupation?: string;
  industry?: string;
  city_state?: string;
  visit_frequency?: string;
  go_to_drink?: string;
  application_token?: string;
  application_link_sent_at?: string;
  application_expires_at?: string;
  application_link_opened_at?: string;
  status: 'review' | 'approved' | 'denied' | 'waitlisted' | 'archived';
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
  typeform_response_id?: string;
}

interface StatusCounts {
  status: string;
  count: number;
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}

export default function WaitlistManager() {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('review');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  const ITEMS_PER_PAGE = 20;

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: ((currentPage - 1) * ITEMS_PER_PAGE).toString()
      });

      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/waitlist?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          errorData = { error: errorText || 'Failed to fetch waitlist' };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch waitlist`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setWaitlistEntries(data.data || []);
      setTotalCount(data.count || 0);
      setStatusCounts(data.statusCounts || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch waitlist entries';
      showToast(errorMessage, 'error');
      setWaitlistEntries([]);
      setTotalCount(0);
      setStatusCounts([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

  const handleStatusUpdate = () => {
    fetchWaitlist();
    showToast('Waitlist updated successfully', 'success');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'review': return styles.statusReview;
      case 'approved': return styles.statusApproved;
      case 'waitlisted': return styles.statusWaitlisted;
      case 'denied': return styles.statusDenied;
      case 'archived': return styles.statusArchived;
      default: return '';
    }
  };

  const filteredEntries = waitlistEntries.filter(entry => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        entry.first_name.toLowerCase().includes(searchLower) ||
        entry.last_name.toLowerCase().includes(searchLower) ||
        entry.email.toLowerCase().includes(searchLower) ||
        entry.company?.toLowerCase().includes(searchLower) ||
        entry.occupation?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Waitlist</h1>
        <button onClick={fetchWaitlist} className={styles.refreshButton}>
          <svg className={styles.refreshIcon} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className={styles.statusGrid}>
        {statusCounts
          .filter((statusCount) => statusCount.status !== 'waitlisted' && statusCount.status !== 'denied')
          .map((statusCount) => {
            const displayName = statusCount.status === 'referrals' ? 'Referrals' :
                               statusCount.status.charAt(0).toUpperCase() + statusCount.status.slice(1);
            return (
              <div
                key={statusCount.status}
                className={`${styles.statusCard} ${statusFilter === statusCount.status ? styles.statusCardActive : ''}`}
                onClick={() => setStatusFilter(statusCount.status)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.statusLabel}>
                  {displayName}
                </div>
                <div className={styles.statusNumber}>{statusCount.count}</div>
              </div>
            );
          })}
        <div
          className={`${styles.statusCard} ${statusFilter === '' ? styles.statusCardActive : ''}`}
          onClick={() => setStatusFilter('')}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.statusLabel}>All</div>
          <div className={styles.statusNumber}>
            {statusCounts.reduce((sum, s) => sum + s.count, 0)}
          </div>
        </div>
      </div>

      <div className={styles.filters}>

        <div className={styles.searchContainer}>
          <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className={styles.empty}>No waitlist entries found</div>
        ) : (
          <div className={styles.entriesList}>
            {filteredEntries.map((entry) => (
              <div key={entry.id} className={styles.entryCard}>
                <div
                  className={styles.entryCol}
                  onClick={() => {
                    setSelectedEntry(entry);
                    setIsModalOpen(true);
                  }}
                >
                  <div className={styles.entryName}>
                    {entry.first_name} {entry.last_name}
                  </div>
                  <span className={`${styles.statusBadge} ${getStatusColor(entry.status)}`}>
                    {entry.status.toUpperCase()}
                  </span>
                </div>
                <div
                  className={styles.entryCol}
                  onClick={() => {
                    setSelectedEntry(entry);
                    setIsModalOpen(true);
                  }}
                >
                  {formatPhone(entry.phone)}
                </div>
                <div
                  className={styles.entryCol}
                  onClick={() => {
                    setSelectedEntry(entry);
                    setIsModalOpen(true);
                  }}
                >
                  {entry.referral || entry.how_did_you_hear || '-'}
                </div>
                <div
                  className={styles.entryCol}
                  onClick={() => {
                    setSelectedEntry(entry);
                    setIsModalOpen(true);
                  }}
                >
                  {formatDate(entry.submitted_at)}
                </div>
                <div className={styles.entryColActions}>
                  {entry.status === 'review' && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Approve ${entry.first_name} ${entry.last_name}?`)) {
                          try {
                            const response = await fetch('/api/waitlist', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                id: entry.id,
                                status: 'approved'
                              }),
                            });

                            const data = await response.json();

                            if (response.ok) {
                              showToast('Entry approved successfully', 'success');
                              fetchWaitlist();
                            } else {
                              const errorMessage = data.message || data.error || 'Failed to approve entry';
                              throw new Error(errorMessage);
                            }
                          } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'Failed to approve entry';
                            showToast(errorMessage, 'error');
                          }
                        }
                      }}
                      className={styles.approveButton}
                      title="Approve"
                      aria-label="Approve entry"
                    >
                      <svg className={styles.iconButtonIcon} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Approve
                    </button>
                  )}
                  {entry.status !== 'archived' && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Archive ${entry.first_name} ${entry.last_name}? This will archive the inquiry and filter it out from the main view.`)) {
                          try {
                            const response = await fetch('/api/waitlist', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                id: entry.id,
                                status: 'archived'
                              }),
                            });

                            const data = await response.json();

                            if (response.ok) {
                              showToast('Entry archived successfully', 'success');
                              fetchWaitlist();
                            } else {
                              const errorMessage = data.message || data.error || 'Failed to archive entry';
                              throw new Error(errorMessage);
                            }
                          } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'Failed to archive entry';
                            showToast(errorMessage, 'error');
                          }
                        }
                      }}
                      className={styles.archiveIconButton}
                      title="Archive"
                      aria-label="Archive entry"
                    >
                      <svg className={styles.iconButtonIcon} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3.33334 5.83334H16.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7.5 9.16667H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M4.16667 5.83334L4.58334 14.1667C4.58334 15.0871 5.32959 15.8333 6.25001 15.8333H13.75C14.6704 15.8333 15.4167 15.0871 15.4167 14.1667L15.8333 5.83334" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7.5 5.83334V4.16667C7.5 3.70643 7.8731 3.33334 8.33334 3.33334H11.6667C12.1269 3.33334 12.5 3.70643 12.5 4.16667V5.83334" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={styles.paginationButton}
          >
            Previous
          </button>
          <span className={styles.paginationText}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className={styles.paginationButton}
          >
            Next
          </button>
        </div>
      )}

      {toast.show && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}

      <WaitlistReviewDrawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entry={selectedEntry}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  );
}
