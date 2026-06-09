import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowRight, X, AlertCircle } from 'lucide-react';
import type { InventoryItem, LocationSlug, UILocationSlug } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';
import { getAuthHeaders } from '../../lib/client-auth';

interface InventoryTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferComplete: () => void;
  items: InventoryItem[];
  locations: Array<{ id: string; slug: LocationSlug; name: string }>;
  currentLocation: UILocationSlug;
}

export default function InventoryTransferModal({
  isOpen,
  onClose,
  onTransferComplete,
  items,
  locations,
  currentLocation,
}: InventoryTransferModalProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [fromLocationId, setFromLocationId] = useState<string>('');
  const [toLocationId, setToLocationId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get selected item details
  const selectedItem = useMemo(
    () => items.find(item => item.id === selectedItemId),
    [items, selectedItemId]
  );

  // Locations are already real (no synthetic 'all').
  const availableLocations = locations;

  // Tracks the post-success close timer so it can be cleared if the component
  // unmounts (or the modal closes) before it fires.
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedItemId('');
      setFromLocationId('');
      setToLocationId('');
      setQuantity(1);
      setNotes('');
      setError(null);
      setSuccess(false);

      // Pre-select current location as source if not 'all'
      if (currentLocation !== 'all') {
        const currentLoc = locations.find(loc => loc.slug === currentLocation);
        if (currentLoc) {
          setFromLocationId(currentLoc.id);
        }
      }
    }
  }, [isOpen, currentLocation, locations]);

  // Update max quantity when item is selected (not when quantity changes)
  useEffect(() => {
    if (selectedItem && quantity > selectedItem.quantity) {
      setQuantity(selectedItem.quantity);
    }
  }, [selectedItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTransfer = async () => {
    if (!selectedItemId || !fromLocationId || !toLocationId) {
      setError('Please fill in all required fields');
      return;
    }

    if (quantity <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }

    if (selectedItem && quantity > selectedItem.quantity) {
      setError(`Maximum available quantity is ${selectedItem.quantity}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          item_id: selectedItemId,
          from_location_id: fromLocationId,
          to_location_id: toLocationId,
          quantity,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Transfer failed');
      }

      setSuccess(true);
      successTimerRef.current = setTimeout(() => {
        onTransferComplete();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer inventory');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="transfer-modal-title">
        <div className={styles.modalHeader}>
          <h2 id="transfer-modal-title" className={styles.modalTitle}>
            Transfer Inventory
          </h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {success ? (
            <div className={styles.successMessage}>
              <div className={styles.successIcon}>✓</div>
              <p>Transfer completed successfully!</p>
            </div>
          ) : (
            <>
              {/* Item Selection */}
              <div className={styles.formGroup}>
                <label htmlFor="transfer-item" className={styles.formLabel}>
                  Item to Transfer
                </label>
                <select
                  id="transfer-item"
                  className={styles.formSelect}
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select an item...</option>
                  {items
                    .filter(item => fromLocationId ? item.location_id === fromLocationId : true)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.brand ? `${item.brand} ` : ''}
                        {item.name} ({item.quantity} {item.unit}
                        {item.quantity !== 1 && item.unit !== 'oz' ? 's' : ''} available)
                      </option>
                    ))}
                </select>
              </div>

              {/* Location Transfer Row */}
              <div className={styles.transferLocations}>
                {/* From Location */}
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label htmlFor="transfer-from" className={styles.formLabel}>
                    From
                  </label>
                  <select
                    id="transfer-from"
                    className={styles.formSelect}
                    value={fromLocationId}
                    onChange={(e) => {
                      setFromLocationId(e.target.value);
                      setSelectedItemId(''); // Reset item selection
                      setQuantity(1); // Reset quantity when changing location
                    }}
                    disabled={loading}
                  >
                    <option value="">Select source...</option>
                    {availableLocations.map((loc) => (
                      <option key={loc.id} value={loc.id} disabled={loc.id === toLocationId}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.transferArrow}>
                  <ArrowRight size={20} />
                </div>

                {/* To Location */}
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label htmlFor="transfer-to" className={styles.formLabel}>
                    To
                  </label>
                  <select
                    id="transfer-to"
                    className={styles.formSelect}
                    value={toLocationId}
                    onChange={(e) => setToLocationId(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Select destination...</option>
                    {availableLocations.map((loc) => (
                      <option key={loc.id} value={loc.id} disabled={loc.id === fromLocationId}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity */}
              <div className={styles.formGroup}>
                <label htmlFor="transfer-quantity" className={styles.formLabel}>
                  Quantity
                  {selectedItem && (
                    <span className={styles.formLabelHint}>
                      (max: {selectedItem.quantity})
                    </span>
                  )}
                </label>
                <input
                  id="transfer-quantity"
                  type="number"
                  className={styles.formInput}
                  value={quantity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    setQuantity(isNaN(value) ? 1 : Math.max(1, value));
                  }}
                  min={1}
                  max={selectedItem?.quantity || 999}
                  disabled={loading || !selectedItem}
                />
              </div>

              {/* Notes */}
              <div className={styles.formGroup}>
                <label htmlFor="transfer-notes" className={styles.formLabel}>
                  Notes (optional)
                </label>
                <textarea
                  id="transfer-notes"
                  className={styles.formTextarea}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this transfer..."
                  rows={3}
                  maxLength={500}
                  disabled={loading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className={styles.errorMessage}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {!success && (
          <div className={styles.modalFooter}>
            <button
              className={styles.btnTertiary}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleTransfer}
              disabled={loading || !selectedItemId || !fromLocationId || !toLocationId}
            >
              {loading ? 'Transferring...' : 'Transfer'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
