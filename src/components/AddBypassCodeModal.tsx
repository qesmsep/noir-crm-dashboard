import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DateTime } from 'luxon';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { supabase } from '@/lib/supabase';

interface BypassCode {
  id: string;
  code: string;
  description: string;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
}

interface AddBypassCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationSlug: string;
  locationName: string;
  editingCode?: BypassCode | null;
  onSuccess: () => void;
}

const AddBypassCodeModal: React.FC<AddBypassCodeModalProps> = ({
  isOpen,
  onClose,
  locationSlug,
  locationName,
  editingCode = null,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [maxUses, setMaxUses] = useState<string>('');
  const [hasExpiration, setHasExpiration] = useState(false);
  const [hasMaxUses, setHasMaxUses] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when editing
  useEffect(() => {
    if (editingCode) {
      setCode(editingCode.code);
      setDescription(editingCode.description || '');
      if (editingCode.expires_at) {
        setHasExpiration(true);
        setExpiresAt(new Date(editingCode.expires_at));
      }
      if (editingCode.max_uses) {
        setHasMaxUses(true);
        setMaxUses(editingCode.max_uses.toString());
      }
    } else {
      // Reset form for new code
      setCode('');
      setDescription('');
      setExpiresAt(null);
      setMaxUses('');
      setHasExpiration(false);
      setHasMaxUses(false);
    }
  }, [editingCode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate code
    if (!code || code.length < 6) {
      setError('Code must be at least 6 characters long');
      return;
    }

    // Validate max uses if enabled
    if (hasMaxUses) {
      const maxUsesNum = parseInt(maxUses);
      if (isNaN(maxUsesNum) || maxUsesNum < 1) {
        setError('Max uses must be a positive number');
        return;
      }
    }

    setSaving(true);

    try {
      // Handle expiration date with timezone awareness
      let expiresAtISO = null;
      if (hasExpiration && expiresAt) {
        // Convert to America/Chicago timezone and set to end of day
        const expiresAtCentral = DateTime.fromJSDate(expiresAt, { zone: 'America/Chicago' })
          .endOf('day') // Expire at end of selected day (23:59:59)
          .toUTC(); // Convert to UTC for storage
        expiresAtISO = expiresAtCentral.toISO();
      }

      const payload = {
        code: code.toUpperCase(),
        description,
        expires_at: expiresAtISO,
        max_uses: hasMaxUses ? parseInt(maxUses) : null,
        is_active: true,
      };

      // Get admin session for authentication
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      let response;
      if (editingCode) {
        // Update existing code
        response = await fetch(`/api/locations/${locationSlug}/bypass-codes/${editingCode.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new code
        response = await fetch(`/api/locations/${locationSlug}/bypass-codes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save bypass code');
      }

      // Success!
      onSuccess();
    } catch (err: any) {
      console.error('Error saving bypass code:', err);
      setError(err.message || 'Failed to save bypass code');
    } finally {
      setSaving(false);
    }
  };

  const generateRandomCode = () => {
    // Use crypto API for secure random generation
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const array = new Uint8Array(8);

    // Generate cryptographically secure random values
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback to Math.random if crypto API not available
      for (let i = 0; i < 8; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }

    let randomCode = '';
    for (let i = 0; i < 8; i++) {
      randomCode += chars[array[i] % chars.length];
    }
    setCode(randomCode);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bypass-code-modal-title"
        style={{
          backgroundColor: '#ECEDE8',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          maxWidth: '500px',
          width: '100%',
          padding: '2rem',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="bypass-code-modal-title" style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>
            {editingCode ? 'Edit Bypass Code' : 'Add New Bypass Code'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B7280',
              transition: 'all 0.2s',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Code Input */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              Code <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="TENANT2024"
                disabled={!!editingCode}
                required
                minLength={6}
                maxLength={20}
                style={{
                  flex: 1,
                  height: '44px',
                  padding: '0 1rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  backgroundColor: editingCode ? '#F3F4F6' : 'white',
                  outline: 'none',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                }}
              />
              {!editingCode && (
                <button
                  type="button"
                  onClick={generateRandomCode}
                  style={{
                    height: '44px',
                    padding: '0 1rem',
                    backgroundColor: 'white',
                    color: '#A59480',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '10px',
                    border: '1px solid #A59480',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Generate
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
              {editingCode ? 'Code cannot be changed after creation' : 'Minimum 6 characters. Letters and numbers only.'}
            </p>
          </div>

          {/* Description Input */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Building tenants access code"
              maxLength={100}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 1rem',
                border: '1px solid #D1D5DB',
                borderRadius: '10px',
                fontSize: '0.875rem',
                backgroundColor: 'white',
                outline: 'none',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
              Optional. Helps you remember what this code is for.
            </p>
          </div>

          {/* Expiration Toggle */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasExpiration}
                onChange={(e) => setHasExpiration(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1F2937' }}>
                Set expiration date
              </span>
            </label>
            {hasExpiration && (
              <div style={{ marginTop: '0.75rem' }}>
                <DatePicker
                  selected={expiresAt}
                  onChange={(date) => setExpiresAt(date)}
                  minDate={new Date()}
                  placeholderText="Select expiration date"
                  dateFormat="MMM d, yyyy"
                  className="date-picker-input"
                  wrapperClassName="date-picker-wrapper"
                  customInput={
                    <input
                      style={{
                        width: '100%',
                        height: '44px',
                        padding: '0 1rem',
                        border: '1px solid #D1D5DB',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        backgroundColor: 'white',
                        outline: 'none',
                      }}
                    />
                  }
                />
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                  Code will stop working after this date
                </p>
              </div>
            )}
          </div>

          {/* Max Uses Toggle */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasMaxUses}
                onChange={(e) => setHasMaxUses(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1F2937' }}>
                Limit number of uses
              </span>
            </label>
            {hasMaxUses && (
              <div style={{ marginTop: '0.75rem' }}>
                <input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="100"
                  min="1"
                  max="9999"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                  Code will stop working after this many uses
                  {editingCode && editingCode.current_uses > 0 && (
                    <span style={{ display: 'block', marginTop: '0.25rem', color: '#EF4444' }}>
                      Current uses: {editingCode.current_uses}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}>
              <p style={{ fontSize: '0.875rem', color: '#DC2626', margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 1.5rem',
                backgroundColor: 'white',
                color: '#6B7280',
                fontSize: '0.9375rem',
                fontWeight: '600',
                borderRadius: '10px',
                border: '1px solid #D1D5DB',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !code || code.length < 6}
              style={{
                height: '44px',
                padding: '0 1.5rem',
                backgroundColor: saving ? '#D1D5DB' : '#A59480',
                color: 'white',
                fontSize: '0.9375rem',
                fontWeight: '600',
                borderRadius: '10px',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(165, 148, 128, 0.2)',
                transition: 'all 0.2s',
              }}
            >
              {saving ? 'Saving...' : (editingCode ? 'Update Code' : 'Create Code')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBypassCodeModal;