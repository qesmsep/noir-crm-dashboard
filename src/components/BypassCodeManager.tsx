import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Plus, Copy, Check } from 'lucide-react';
import AddBypassCodeModal from './AddBypassCodeModal';
import styles from '../styles/Settings.module.css';
import { DateTime } from 'luxon';
import { supabase } from '@/lib/supabase';

interface BypassCode {
  id: string;
  code: string;
  description: string;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
  usage_percentage: number | null;
  is_expired: boolean;
  is_maxed_out: boolean;
}

interface BypassCodeManagerProps {
  locationSlug: string;
  locationName: string;
}

const BypassCodeManager: React.FC<BypassCodeManagerProps> = ({
  locationSlug,
  locationName
}) => {
  const [codes, setCodes] = useState<BypassCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCode, setEditingCode] = useState<BypassCode | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Fetch bypass codes
  const fetchCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get admin session for authentication
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/locations/${locationSlug}/bypass-codes`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch bypass codes');
      }

      const data = await response.json();
      setCodes(data.codes || []);
    } catch (err: any) {
      console.error('Error fetching bypass codes:', err);
      setError(err.message || 'Failed to load bypass codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, [locationSlug]);

  // Copy code to clipboard
  const copyToClipboard = (code: string, codeId: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCodeId(codeId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    });
  };

  // Delete (deactivate) a code
  const handleDelete = async (codeId: string) => {
    if (!confirm('Are you sure you want to deactivate this bypass code?')) {
      return;
    }

    try {
      // Get admin session for authentication
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/locations/${locationSlug}/bypass-codes/${codeId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate bypass code');
      }

      // Refresh the list
      fetchCodes();
    } catch (err: any) {
      console.error('Error deactivating bypass code:', err);
      alert(err.message || 'Failed to deactivate bypass code');
    }
  };

  // Format date for display
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    return DateTime.fromISO(dateStr)
      .setZone('America/Chicago')
      .toFormat('MMM d, yyyy');
  };

  // Format date and time for display
  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    return DateTime.fromISO(dateStr)
      .setZone('America/Chicago')
      .toFormat('MMM d, yyyy h:mm a');
  };

  // Get status badge color
  const getStatusColor = (code: BypassCode): string => {
    if (!code.is_active) return styles.statusInactive;
    if (code.is_expired) return styles.statusExpired;
    if (code.is_maxed_out) return styles.statusMaxed;
    return styles.statusActive;
  };

  // Get status text
  const getStatusText = (code: BypassCode): string => {
    if (!code.is_active) return 'Inactive';
    if (code.is_expired) return 'Expired';
    if (code.is_maxed_out) return 'Max Uses Reached';
    return 'Active';
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Loading bypass codes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>{error}</p>
        <button onClick={fetchCodes} className={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.bypassCodeManager}>
        <div className={styles.bypassCodeHeader}>
          <h3 className={styles.subsectionTitle}>Reservation Fee Bypass Codes</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className={styles.addCodeButton}
          >
            <Plus size={16} />
            Add New Code
          </button>
        </div>

        <p className={styles.inputHint}>
          Special codes that allow users to skip the reservation fee (e.g., for building tenants)
        </p>

        {codes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No bypass codes created yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className={styles.primaryButton}
            >
              Create Your First Code
            </button>
          </div>
        ) : (
          <div className={styles.codesList}>
            {codes.map((code) => (
              <div
                key={code.id}
                className={`${styles.codeCard} ${!code.is_active ? styles.codeCardInactive : ''}`}
              >
                <div className={styles.codeHeader}>
                  <div className={styles.codeMain}>
                    <div className={styles.codeDisplay}>
                      <code className={styles.codeText}>{code.code}</code>
                      <button
                        onClick={() => copyToClipboard(code.code, code.id)}
                        className={styles.copyButton}
                        title="Copy code"
                      >
                        {copiedCodeId === code.id ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                    <span className={`${styles.statusBadge} ${getStatusColor(code)}`}>
                      {getStatusText(code)}
                    </span>
                  </div>
                  <div className={styles.codeActions}>
                    <button
                      onClick={() => setEditingCode(code)}
                      className={styles.iconButton}
                      title="Edit code"
                      disabled={!code.is_active}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(code.id)}
                      className={styles.iconButton}
                      title="Deactivate code"
                      disabled={!code.is_active}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {code.description && (
                  <p className={styles.codeDescription}>{code.description}</p>
                )}

                <div className={styles.codeStats}>
                  <div className={styles.codeStat}>
                    <span className={styles.statLabel}>Uses:</span>
                    <span className={styles.statValue}>
                      {code.current_uses}
                      {code.max_uses && ` / ${code.max_uses}`}
                      {code.usage_percentage !== null && (
                        <span className={styles.statPercent}> ({code.usage_percentage}%)</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.codeStat}>
                    <span className={styles.statLabel}>Expires:</span>
                    <span className={styles.statValue}>
                      {formatDate(code.expires_at)}
                    </span>
                  </div>
                  <div className={styles.codeStat}>
                    <span className={styles.statLabel}>Created:</span>
                    <span className={styles.statValue}>
                      {formatDateTime(code.created_at)}
                    </span>
                  </div>
                </div>

                {code.usage_percentage !== null && (
                  <div className={styles.usageBar}>
                    <div
                      className={styles.usageBarFill}
                      style={{ width: `${Math.min(code.usage_percentage, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingCode) && (
        <AddBypassCodeModal
          isOpen={showAddModal || !!editingCode}
          onClose={() => {
            setShowAddModal(false);
            setEditingCode(null);
          }}
          locationSlug={locationSlug}
          locationName={locationName}
          editingCode={editingCode}
          onSuccess={() => {
            fetchCodes();
            setShowAddModal(false);
            setEditingCode(null);
          }}
        />
      )}
    </>
  );
};

export default BypassCodeManager;