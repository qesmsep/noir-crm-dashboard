import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import WaitlistReviewDrawer from '../../components/WaitlistReviewDrawer';
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
  status: 'review' | 'approved' | 'denied' | 'waitlisted';
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

export default function WaitlistPage() {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
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
        // Add cache control for mobile
        cache: 'no-cache',
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
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
      console.error('Error fetching waitlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch waitlist entries';
      showToast(errorMessage, 'error');
      // Set empty state on error to prevent infinite loading
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
    <AdminLayout>
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
          {statusCounts.map((statusCount) => (
            <div key={statusCount.status} className={styles.statusCard}>
              <div className={styles.statusLabel}>
                {statusCount.status.charAt(0).toUpperCase() + statusCount.status.slice(1)}
              </div>
              <div className={styles.statusNumber}>{statusCount.count}</div>
            </div>
          ))}
        </div>

        <div className={styles.filters}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.select}
          >
            <option value="">All Statuses</option>
            <option value="review">Review</option>
            <option value="approved">Approved</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="denied">Denied</option>
          </select>

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
                  <div className={styles.entryHeader}>
                    <div>
                      <h3 className={styles.entryName}>
                        {entry.first_name} {entry.last_name}
                      </h3>
                      <span className={`${styles.statusBadge} ${getStatusColor(entry.status)}`}>
                        {entry.status.toUpperCase()}
                      </span>
                    </div>
                    <div className={styles.entryDate}>{formatDate(entry.submitted_at)}</div>
                  </div>

                  <div className={styles.entryInfo}>
                    <div className={styles.infoRow}>
                      <svg className={styles.infoIcon} viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      <span className={styles.infoText}>{entry.email}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <svg className={styles.infoIcon} viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      <span className={styles.infoText}>{formatPhone(entry.phone)}</span>
                    </div>
                    {(entry.company || entry.city_state) && (
                      <div className={styles.infoRow}>
                        <svg className={styles.infoIcon} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                        </svg>
                        <div className={styles.infoText}>
                          {entry.company || '-'}
                          {entry.company && entry.city_state && (
                            <span className={styles.infoSubtext}>{entry.city_state}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {(entry.why_noir || entry.occupation || entry.how_did_you_hear) && (
                    <details className={styles.details}>
                      <summary className={styles.detailsToggle}>More Details</summary>
                      <div className={styles.detailsContent}>
                        {entry.why_noir && (
                          <div className={styles.detailItem}>
                            <div className={styles.detailLabel}>Why Noir?</div>
                            <div className={styles.detailValue}>{entry.why_noir}</div>
                          </div>
                        )}
                        {entry.occupation && (
                          <div className={styles.detailItem}>
                            <div className={styles.detailLabel}>Occupation</div>
                            <div className={styles.detailValue}>{entry.occupation}</div>
                          </div>
                        )}
                        {entry.how_did_you_hear && (
                          <div className={styles.detailItem}>
                            <div className={styles.detailLabel}>How did you hear about us?</div>
                            <div className={styles.detailValue}>{entry.how_did_you_hear}</div>
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  <div className={styles.entryActions}>
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        setIsModalOpen(true);
                      }}
                      className={styles.primaryButton}
                    >
                      Review
                    </button>
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
      </div>

      <WaitlistReviewDrawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entry={selectedEntry}
        onStatusUpdate={handleStatusUpdate}
      />
    </AdminLayout>
  );
}
