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
  how_did_you_hear?: string;
  why_noir?: string;
  occupation?: string;
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
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    occupation: '',
    city_state: '',
    referral: '',
    how_did_you_hear: '',
    why_noir: '',
    visit_frequency: '',
    go_to_drink: ''
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Populate form data when entry changes
  React.useEffect(() => {
    if (entry) {
      setFormData({
        first_name: entry.first_name || '',
        last_name: entry.last_name || '',
        email: entry.email || '',
        phone: entry.phone || '',
        company: entry.company || '',
        occupation: entry.occupation || '',
        city_state: entry.city_state || '',
        referral: entry.referral || '',
        how_did_you_hear: entry.how_did_you_hear || '',
        why_noir: entry.why_noir || '',
        visit_frequency: entry.visit_frequency || '',
        go_to_drink: entry.go_to_drink || ''
      });
      setIsEditing(false);
    }
  }, [entry]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!entry) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/waitlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          ...formData
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Entry updated successfully', 'success');
        setIsEditing(false);
        onStatusUpdate();
      } else {
        throw new Error(data.error || 'Failed to update entry');
      }
    } catch (error) {
      console.error('Error updating waitlist entry:', error);
      showToast('Failed to update entry', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset form data to original entry values
    if (entry) {
      setFormData({
        first_name: entry.first_name || '',
        last_name: entry.last_name || '',
        email: entry.email || '',
        phone: entry.phone || '',
        company: entry.company || '',
        occupation: entry.occupation || '',
        city_state: entry.city_state || '',
        referral: entry.referral || '',
        how_did_you_hear: entry.how_did_you_hear || '',
        why_noir: entry.why_noir || '',
        visit_frequency: entry.visit_frequency || '',
        go_to_drink: entry.go_to_drink || ''
      });
    }
    setIsEditing(false);
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className={styles.editButton}
                aria-label="Edit entry"
              >
                Edit
              </button>
            )}
            <button onClick={onClose} className={styles.closeButton} aria-label="Close modal">
              ✕
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            {isEditing ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>First Name</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <h3 className={styles.name}>
                  {formData.first_name} {formData.last_name}
                </h3>
                <p className={styles.submittedDate}>
                  Submitted {formatDate(entry.submitted_at)}
                </p>
              </>
            )}
          </div>

          <div className={styles.section}>
            {isEditing ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>📧 Email</div>
                  <div className={styles.infoValue}>{formData.email}</div>
                </div>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>📱 Phone</div>
                  <div className={styles.infoValue}>{formatPhone(formData.phone)}</div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.divider} />
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Additional Information</h4>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Occupation</label>
                  <input
                    type="text"
                    value={formData.occupation}
                    onChange={(e) => handleInputChange('occupation', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Location</label>
                  <input
                    type="text"
                    value={formData.city_state}
                    onChange={(e) => handleInputChange('city_state', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Referral / How did you hear</label>
                  <input
                    type="text"
                    value={formData.referral || formData.how_did_you_hear}
                    onChange={(e) => handleInputChange('referral', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Why do you want to join Noir?</label>
                  <textarea
                    value={formData.why_noir}
                    onChange={(e) => handleInputChange('why_noir', e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Visit Frequency</label>
                  <input
                    type="text"
                    value={formData.visit_frequency}
                    onChange={(e) => handleInputChange('visit_frequency', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Go-to Drink</label>
                  <input
                    type="text"
                    value={formData.go_to_drink}
                    onChange={(e) => handleInputChange('go_to_drink', e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.additionalInfo}>
                {formData.company && (
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Company</div>
                    <div className={styles.infoText}>{formData.company}</div>
                  </div>
                )}
                {formData.occupation && (
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Occupation</div>
                    <div className={styles.infoText}>{formData.occupation}</div>
                  </div>
                )}
                {formData.city_state && (
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Location</div>
                    <div className={styles.infoText}>{formData.city_state}</div>
                  </div>
                )}
                {(formData.referral || formData.how_did_you_hear) && (
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Who referred you / How did you hear</div>
                    <div className={styles.infoText}>{formData.referral || formData.how_did_you_hear}</div>
                  </div>
                )}
                {formData.why_noir && (
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Why do you want to join Noir?</div>
                    <div className={styles.infoText}>{formData.why_noir}</div>
                  </div>
                )}
                {formData.visit_frequency && (
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Visit Frequency</div>
                    <div className={styles.infoText}>{formData.visit_frequency}</div>
                  </div>
                )}
                {formData.go_to_drink && (
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Go-to Drink</div>
                    <div className={styles.infoText}>{formData.go_to_drink}</div>
                  </div>
                )}
              </div>
            )}
          </div>

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
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={isLoading}
                className={styles.denyButton}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className={styles.approveButton}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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
