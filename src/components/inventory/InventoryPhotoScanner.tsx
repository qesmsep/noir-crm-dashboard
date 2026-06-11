import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, Loader2 } from 'lucide-react';
import type { ScannedItem, InventoryItem, LocationSlug } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';
import { getAuthHeaders } from '../../lib/client-auth';

interface InventoryPhotoScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (items: ScannedItem[]) => void;
  existingItems: InventoryItem[];
  locations: Array<{ slug: LocationSlug; name: string }>;
}

export default function InventoryPhotoScanner({
  isOpen,
  onClose,
  onConfirm,
  existingItems,
  locations,
}: InventoryPhotoScannerProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScannedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    setError(null);
    setImageFile(file);
    setScanResults(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    setScanResults(null);
    setError(null);
  };

  const handleScan = async () => {
    if (!imageFile) return;
    setScanning(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append(
        'existing_items',
        JSON.stringify(
          existingItems.map((i) => ({ id: i.id, name: i.name, brand: i.brand }))
        )
      );

      // Get auth headers and remove Content-Type (auto-set for FormData)
      const authHeaders = await getAuthHeaders();
      const { 'Content-Type': _, ...headers } = authHeaders;

      const res = await fetch('/api/inventory/scan', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Scan failed. Please try again.');
      }

      const data = await res.json();
      // Initialize items with location_quantities and match info
      const itemsWithDefaults = (data.items || []).map((item: ScannedItem) => {
        // Find matched item details from existingItems
        let matchedName, matchedStock;
        if (item.matched_inventory_id) {
          const matched = existingItems.find(i => i.id === item.matched_inventory_id);
          if (matched) {
            matchedName = `${matched.brand ? matched.brand + ' ' : ''}${matched.name}`;
            matchedStock = matched.quantity;
          }
        }

        return {
          ...item,
          location_quantities: {},
          create_new: !item.matched_inventory_id, // Default to create new if no match
          matched_inventory_name: matchedName,
          matched_inventory_stock: matchedStock,
        };
      });
      setScanResults(itemsWithDefaults);
    } catch (err: any) {
      setError(err.message || 'Failed to scan image.');
    } finally {
      setScanning(false);
    }
  };

  const updateScannedQuantity = (index: number, quantity: number) => {
    if (!scanResults) return;
    const updated = [...scanResults];
    updated[index] = { ...updated[index], estimated_quantity: quantity };
    setScanResults(updated);
  };

  const updateUnitPrice = (index: number, price: number) => {
    if (!scanResults) return;
    const updated = [...scanResults];
    updated[index] = { ...updated[index], unit_price: price };
    setScanResults(updated);
  };

  const updateItemBrand = (index: number, brand: string) => {
    if (!scanResults) return;
    const updated = [...scanResults];
    updated[index] = { ...updated[index], brand };
    setScanResults(updated);
  };

  const updateItemName = (index: number, name: string) => {
    if (!scanResults) return;
    const updated = [...scanResults];
    updated[index] = { ...updated[index], name };
    setScanResults(updated);
  };

  const toggleMatchMode = (index: number, createNew: boolean) => {
    if (!scanResults) return;
    const updated = [...scanResults];
    updated[index] = { ...updated[index], create_new: createNew };
    setScanResults(updated);
  };

  const toggleLocationForItem = (itemIndex: number, locationSlug: LocationSlug) => {
    if (!scanResults) return;
    const updated = [...scanResults];
    const currentQuantities = updated[itemIndex].location_quantities || {};

    if (currentQuantities[locationSlug] !== undefined) {
      // Location is selected, remove it
      const { [locationSlug]: removed, ...rest } = currentQuantities;
      updated[itemIndex] = { ...updated[itemIndex], location_quantities: rest };
    } else {
      // Location not selected, add it with 0 quantity
      updated[itemIndex] = {
        ...updated[itemIndex],
        location_quantities: { ...currentQuantities, [locationSlug]: 0 }
      };
    }
    setScanResults(updated);
  };

  const updateLocationQuantity = (itemIndex: number, locationSlug: LocationSlug, quantity: number) => {
    if (!scanResults) return;
    const updated = [...scanResults];
    const currentQuantities = updated[itemIndex].location_quantities || {};

    updated[itemIndex] = {
      ...updated[itemIndex],
      location_quantities: { ...currentQuantities, [locationSlug]: quantity }
    };
    setScanResults(updated);
  };

  const removeScannedItem = (index: number) => {
    if (!scanResults) return;
    const item = scanResults[index];
    const itemName = `${item.brand ? item.brand + ' ' : ''}${item.name}`;

    if (confirm(`Remove ${itemName} from the scan?`)) {
      setScanResults(scanResults.filter((_, i) => i !== index));
    }
  };

  const handleConfirm = () => {
    if (scanResults && scanResults.length > 0) {
      onConfirm(scanResults);
      clearImage();
    }
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.8) return styles.confidenceHigh;
    if (confidence >= 0.5) return styles.confidenceMedium;
    return styles.confidenceLow;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Scan Receipt or Inventory">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Scan Receipt or Inventory</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {!imagePreview ? (
            <>
              <div
                className={styles.scannerArea}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={40} className={styles.scannerIcon} />
                <h3 className={styles.scannerTitle}>
                  Upload a receipt or photo
                </h3>
                <p className={styles.scannerSubtext}>
                  Scan purchase receipts, invoices, or photos of your inventory
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  className={styles.btnTertiary}
                  style={{ flex: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} /> Upload Photo
                </button>
                <button
                  className={styles.btnPrimary}
                  style={{ flex: 1 }}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera size={16} /> Take Photo
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Image Preview */}
              <div className={styles.scannerPreview}>
                <img
                  src={imagePreview}
                  alt="Inventory scan"
                  className={styles.scannerPreviewImage}
                />
                <button
                  className={styles.scannerPreviewRemove}
                  onClick={clearImage}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scan Button */}
              {!scanResults && !scanning && (
                <button
                  className={styles.btnPrimary}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleScan}
                >
                  <Camera size={16} /> Analyze with AI
                </button>
              )}

              {/* Scanning State */}
              {scanning && (
                <div className={styles.processingOverlay}>
                  <div className={styles.spinner} />
                  <p className={styles.processingText}>Analyzing image...</p>
                  <p className={styles.processingSubtext}>
                    AI is extracting items, quantities, and prices
                  </p>
                </div>
              )}

              {/* Scan Results */}
              {scanResults && (
                <div className={styles.scanResults}>
                  <h4 className={styles.scanResultsTitle}>
                    Found {scanResults.length} items — Review & Edit
                  </h4>

                  {scanResults.map((item, idx) => {
                    const allocated = item.location_quantities || {};
                    const totalAllocated = Object.values(allocated).reduce((sum, qty) => sum + qty, 0);
                    const unitPrice = item.unit_price || 0;
                    // Always calculate total from qty * unit price (not stored total_price)
                    const totalPrice = item.estimated_quantity * unitPrice;

                    return (
                      <div key={idx} style={{
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        marginBottom: '1rem',
                        background: '#fff',
                        position: 'relative'
                      }}>
                        {/* Close button - top right */}
                        <button
                          onClick={() => removeScannedItem(idx)}
                          style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6B7280',
                            padding: '0.25rem'
                          }}
                        >
                          <X size={20} />
                        </button>

                        {/* Item Title - Editable Product Name and Brand */}
                        <div style={{
                          marginBottom: '1rem',
                          paddingRight: '2rem',
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr',
                          gap: '0.75rem'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>Product Name</div>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItemName(idx, e.target.value)}
                              placeholder="Product Name"
                              style={{
                                width: '100%',
                                fontSize: '0.9375rem',
                                fontWeight: 500,
                                color: '#111827',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                padding: '0.5rem',
                                background: '#fff'
                              }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>Brand</div>
                            <input
                              type="text"
                              value={item.brand || ''}
                              onChange={(e) => updateItemBrand(idx, e.target.value)}
                              placeholder="Brand"
                              style={{
                                width: '100%',
                                fontSize: '0.9375rem',
                                fontWeight: 500,
                                color: '#111827',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                padding: '0.5rem',
                                background: '#fff'
                              }}
                            />
                          </div>
                        </div>

                        {/* Row: Qty | Unit Price | Total */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto auto auto 1fr',
                          gap: '1.5rem',
                          alignItems: 'start',
                          marginBottom: '1.5rem'
                        }}>
                          <div style={{ minWidth: '80px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>Qty</div>
                            <input
                              type="number"
                              min="0"
                              value={item.estimated_quantity}
                              onChange={(e) => updateScannedQuantity(idx, parseInt(e.target.value) || 0)}
                              style={{
                                width: '100%',
                                fontSize: '1.125rem',
                                fontWeight: 600,
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                padding: '0.25rem 0.5rem'
                              }}
                            />
                          </div>

                          <div style={{ minWidth: '100px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>Unit price</div>
                            <div style={{ position: 'relative' }}>
                              <span style={{
                                position: 'absolute',
                                left: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: '1.125rem',
                                fontWeight: 600,
                                color: '#6B7280',
                                pointerEvents: 'none'
                              }}>$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={unitPrice}
                                onChange={(e) => updateUnitPrice(idx, parseFloat(e.target.value) || 0)}
                                style={{
                                  width: '100%',
                                  fontSize: '1.125rem',
                                  fontWeight: 600,
                                  border: '1px solid #D1D5DB',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem 0.25rem 1.5rem'
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ minWidth: '120px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>Total</div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>${totalPrice.toFixed(2)}</div>
                          </div>

                          <div></div>
                        </div>

                        {/* Inventory Match - No title */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          {/* Current Match Display (if exists) */}
                          {item.matched_inventory_id && (
                            <div style={{
                              padding: '0.5rem 1rem',
                              border: '1px solid #D1D5DB',
                              borderRadius: '6px',
                              background: '#F0FDF4',
                              fontSize: '0.875rem',
                              color: '#374151',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '0.75rem'
                            }}>
                              <span>
                                {item.matched_inventory_name} — current stock: {item.matched_inventory_stock}
                              </span>
                              <span style={{ color: '#9CA3AF' }}>▼</span>
                            </div>
                          )}

                          {/* Create New / Match to Existing Buttons - 50% height */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <button
                              onClick={() => toggleMatchMode(idx, true)}
                              style={{
                                padding: '0.375rem 0.75rem',
                                border: item.create_new ? '2px solid #2563EB' : '1px solid #D1D5DB',
                                borderRadius: '6px',
                                background: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: item.create_new ? '#2563EB' : '#374151',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <span style={{ fontSize: '1rem' }}>+</span> Create new
                            </button>
                            <button
                              onClick={() => toggleMatchMode(idx, false)}
                              disabled={!item.matched_inventory_id}
                              style={{
                                padding: '0.375rem 0.75rem',
                                border: !item.create_new ? '2px solid #2563EB' : '1px solid #D1D5DB',
                                borderRadius: '6px',
                                background: item.matched_inventory_id ? '#fff' : '#F9FAFB',
                                cursor: item.matched_inventory_id ? 'pointer' : 'not-allowed',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: !item.create_new ? '#2563EB' : item.matched_inventory_id ? '#374151' : '#9CA3AF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <span style={{ fontSize: '1rem' }}>🔗</span> Match to existing
                            </button>
                          </div>
                        </div>

                        {/* Allocate by location */}
                        <div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.75rem'
                          }}>
                            <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                              Allocate by location
                            </div>
                            <div style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: totalAllocated < item.estimated_quantity ? '#DC2626' : '#92400E'
                            }}>
                              {totalAllocated} of {item.estimated_quantity} allocated
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                            {locations.map((location) => {
                              const isSelected = allocated[location.slug] !== undefined;
                              const qty = allocated[location.slug] || 0;

                              return (
                                <div
                                  key={location.slug}
                                  style={{
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '6px',
                                    padding: '0.75rem',
                                    background: '#F9FAFB'
                                  }}
                                >
                                  <div style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    marginBottom: '0.5rem',
                                    textAlign: 'center'
                                  }}>
                                    {location.name}
                                  </div>

                                  {/* Toggle Switch - 50% smaller */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    marginBottom: '0.5rem'
                                  }}>
                                    <button
                                      onClick={() => toggleLocationForItem(idx, location.slug)}
                                      style={{
                                        width: '44px',
                                        height: '24px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: isSelected ? '#2563EB' : '#D1D5DB',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                      }}
                                    >
                                      <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: '#fff',
                                        position: 'absolute',
                                        top: '3px',
                                        left: isSelected ? '23px' : '3px',
                                        transition: 'left 0.2s'
                                      }} />
                                    </button>
                                  </div>

                                  {/* Quantity Input - smaller, thinner font */}
                                  {isSelected && (
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={qty || ''}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        updateLocationQuantity(idx, location.slug, value);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '0.375rem',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: '4px',
                                        textAlign: 'center',
                                        fontSize: '0.875rem',
                                        fontWeight: 400
                                      }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Warning if not fully allocated */}
                          {totalAllocated < item.estimated_quantity && (
                            <div style={{
                              marginTop: '0.75rem',
                              padding: '0.5rem',
                              background: '#FEF2F2',
                              border: '1px solid #FCA5A5',
                              borderRadius: '4px',
                              fontSize: '0.8125rem',
                              color: '#DC2626'
                            }}>
                              ⚠️ {item.estimated_quantity - totalAllocated} unit(s) not allocated
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {error && (
            <p
              style={{
                color: '#DC2626',
                fontSize: '0.8125rem',
                marginTop: '0.75rem',
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnTertiary} onClick={onClose}>
            Cancel
          </button>
          {scanResults && scanResults.length > 0 && (() => {
            // Check if ALL items are fully allocated
            const allFullyAllocated = scanResults.every(item => {
              const quantities = item.location_quantities || {};
              const totalAllocated = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
              return totalAllocated === item.estimated_quantity && totalAllocated > 0;
            });

            return allFullyAllocated ? (
              <button className={styles.btnPrimary} onClick={handleConfirm}>
                <Check size={16} /> Add to Inventory
              </button>
            ) : (
              <button
                className={styles.btnPrimary}
                disabled
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                <Check size={16} /> Allocate all quantities
              </button>
            );
          })()}
        </div>
      </div>
    </>
  );
}
