import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, Loader2 } from 'lucide-react';
import type { ScannedItem, InventoryItem } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';

interface InventoryPhotoScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (items: ScannedItem[]) => void;
  existingItems: InventoryItem[];
}

export default function InventoryPhotoScanner({
  isOpen,
  onClose,
  onConfirm,
  existingItems,
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

      const res = await fetch('/api/inventory/scan', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Scan failed. Please try again.');
      }

      const data = await res.json();
      setScanResults(data.items || []);
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

  const removeScannedItem = (index: number) => {
    if (!scanResults) return;
    setScanResults(scanResults.filter((_, i) => i !== index));
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
      <div
        className={`${styles.drawerOverlay} ${styles.drawerOverlayVisible}`}
        onClick={onClose}
      />
      <div className={`${styles.drawer} ${styles.drawerVisible}`} role="dialog" aria-modal="true" aria-label="Scan Inventory">
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Scan Inventory</h2>
          <button className={styles.drawerClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.drawerBody}>
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
                  Upload a photo of your bar
                </h3>
                <p className={styles.scannerSubtext}>
                  Drag and drop an image or click to browse
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
                  <p className={styles.processingText}>Analyzing your inventory...</p>
                  <p className={styles.processingSubtext}>
                    AI is identifying bottles and counting quantities
                  </p>
                </div>
              )}

              {/* Scan Results */}
              {scanResults && (
                <div className={styles.scanResults}>
                  <h4 className={styles.scanResultsTitle}>
                    Found {scanResults.length} items — Review & Edit
                  </h4>

                  {scanResults.map((item, idx) => (
                    <div key={idx} className={styles.scanItem}>
                      <div className={styles.scanItemInfo}>
                        <p className={styles.scanItemName}>
                          {item.brand ? `${item.brand} ` : ''}
                          {item.name}
                        </p>
                        <p className={styles.scanItemMeta}>
                          {item.category}
                          {item.matched_inventory_id && ' — matches existing item'}
                        </p>
                      </div>
                      <span
                        className={`${styles.scanConfidence} ${getConfidenceClass(item.confidence)}`}
                      >
                        {Math.round(item.confidence * 100)}%
                      </span>
                      <input
                        type="number"
                        min="0"
                        className={styles.scanItemQuantity}
                        value={item.estimated_quantity}
                        onChange={(e) =>
                          updateScannedQuantity(
                            idx,
                            parseInt(e.target.value) || 0
                          )
                        }
                      />
                      <button
                        className={styles.ingredientRemoveBtn}
                        onClick={() => removeScannedItem(idx)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
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

        <div className={styles.drawerFooter}>
          <button className={styles.btnTertiary} onClick={onClose}>
            Cancel
          </button>
          {scanResults && scanResults.length > 0 && (
            <button className={styles.btnPrimary} onClick={handleConfirm}>
              <Check size={16} /> Add to Inventory
            </button>
          )}
        </div>
      </div>
    </>
  );
}
