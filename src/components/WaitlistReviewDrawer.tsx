import React, { useState } from 'react';
import styles from '../styles/WaitlistReviewDrawer.module.css';

interface WaitlistEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  city_state?: string;
  referral?: string;
  visit_frequency?: string;
  go_to_drink?: string;
  status: 'review' | 'approved' | 'denied' | 'waitlisted' | 'archived';
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
  typeform_response_id?: string;
}

interface WaitlistReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entry: WaitlistEntry | null;
  onStatusUpdate: () => void;
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}

const WaitlistReviewDrawer: React.FC<WaitlistReviewDrawerProps> = ({
  isOpen,
  onClose,
  entry,
  onStatusUpdate
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  const handleStatusUpdate = async (status: 'approved' | 'waitlisted') => {
    if (!entry) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/waitlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          status,
          review_notes: reviewNotes
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast(`Application ${status === 'waitlisted' ? 'denied and waitlisted' : status} successfully`, 'success');
        onStatusUpdate();
        setTimeout(() => onClose(), 1000);
      } else {
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating waitlist status:', error);
      showToast('Failed to update application status', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!entry) return null;

  const getStatusClass = () => {
    switch (entry.status) {
      case 'review': return styles.statusReview;
      case 'approved': return styles.statusApproved;
      case 'waitlisted': return styles.statusWaitlisted;
      case 'denied': return styles.statusDenied;
      case 'archived': return styles.statusArchived;
      default: return '';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h2 className={styles.title}>Review Application</h2>
            <span className={`${styles.statusBadge} ${getStatusClass()}`}>
              {entry.status.toUpperCase()}
            </span>
          </div>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <h3 className={styles.name}>
              {entry.first_name} {entry.last_name}
            </h3>
            <p className={styles.submittedDate}>
              Submitted {formatDate(entry.submitted_at)}
            </p>
          </div>

          <div className={styles.section}>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>📧 Email</div>
                <div className={styles.infoValue}>{entry.email}</div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>📱 Phone</div>
                <div className={styles.infoValue}>{formatPhone(entry.phone)}</div>
              </div>
            </div>
          </div>

          {(entry.company || entry.city_state || entry.referral || entry.visit_frequency || entry.go_to_drink) && (
            <>
              <div className={styles.divider} />
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Additional Information</h4>
                <div className={styles.additionalInfo}>
                  {entry.company && (
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>Company</div>
                      <div className={styles.infoText}>{entry.company}</div>
                    </div>
                  )}
                  {entry.city_state && (
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>Location</div>
                      <div className={styles.infoText}>{entry.city_state}</div>
                    </div>
                  )}
                  {entry.referral && (
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>Referral</div>
                      <div className={styles.infoText}>{entry.referral}</div>
                    </div>
                  )}
                  {entry.visit_frequency && (
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>Visit Frequency</div>
                      <div className={styles.infoText}>{entry.visit_frequency}</div>
                    </div>
                  )}
                  {entry.go_to_drink && (
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>Go-to Drink</div>
                      <div className={styles.infoText}>{entry.go_to_drink}</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className={styles.divider} />

          <div className={styles.section}>
            <label htmlFor="reviewNotes" className={styles.textareaLabel}>
              Review Notes (Optional)
            </label>
            <textarea
              id="reviewNotes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add any notes about this application..."
              rows={4}
              className={styles.textarea}
            />
          </div>

          <div className={styles.metaInfo}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Submitted:</span>
              <span className={styles.metaValue}>{formatDate(entry.submitted_at)}</span>
            </div>
            {entry.typeform_response_id && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Response ID:</span>
                <span className={styles.metaValue}>{entry.typeform_response_id.slice(0, 8)}...</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button
            onClick={() => handleStatusUpdate('waitlisted')}
            disabled={isLoading}
            className={styles.denyButton}
          >
            {isLoading ? 'Processing...' : 'Deny & Waitlist'}
          </button>
          <button
            onClick={() => handleStatusUpdate('approved')}
            disabled={isLoading}
            className={styles.approveButton}
          >
            {isLoading ? 'Processing...' : 'Approve'}
          </button>
        </div>

        {toast.show && (
          <div className={`${styles.toast} ${styles[toast.type]}`}>
            {toast.message}
          </div>
        )}
      </div>
    </>
  );
};

export default WaitlistReviewDrawer;
