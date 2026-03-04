import { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import styles from '../styles/AddSecondaryMemberModal.module.css';

interface Props {
  accountId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddSecondaryMemberModal({ accountId, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    dob: '',
    photo: '',
    company: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone || !formData.dob) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields',
        variant: 'error',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/members/add-to-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          member_data: {
            ...formData,
            primary: false,
            member_type: 'secondary',
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to add secondary member');
      }

      toast({
        title: 'Success',
        description: 'Member added successfully. Account will be charged $25/month for this additional member.',
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add member',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add Member to Account</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="first_name" className={styles.label}>
                First Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="last_name" className={styles.label}>
                Last Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email <span className={styles.required}>*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phone" className={styles.label}>
                Phone <span className={styles.required}>*</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="(555) 555-5555"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="dob" className={styles.label}>
                Date of Birth <span className={styles.required}>*</span>
              </label>
              <input
                type="date"
                id="dob"
                name="dob"
                value={formData.dob}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="company" className={styles.label}>
                Company
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="photo" className={styles.label}>
              Photo URL
            </label>
            <input
              type="url"
              id="photo"
              name="photo"
              value={formData.photo}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="https://..."
            />
          </div>

          <div className={styles.divider} />

          <div className={styles.pricingNotice}>
            <div className={styles.pricingIcon}>💳</div>
            <div className={styles.pricingText}>
              <strong>$25/month administration fee</strong>
              <p className={styles.pricingSubtext}>
                This additional member will increase monthly dues by $25. No additional beverage credit included.
              </p>
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Adding Member...' : 'Add Member (+$25/mo)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
