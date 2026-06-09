import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, X, Check, AlertTriangle, Clock } from 'lucide-react';
import type { SalesRecord, SalesItem, UILocationSlug } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';
import { getAuthHeaders } from '../../lib/client-auth';

interface EnhancedSalesUploadProps {
  /** The currently selected location (or 'all'). */
  currentLocation: UILocationSlug;
  /** Called after a sales upload has been confirmed and inventory deducted. */
  onUploadComplete: () => void;
}

/**
 * Enhanced sales upload component.
 *
 * Handles the full upload flow against /api/inventory/sales:
 *   1. Upload a PDF/CSV/Excel sales report (AI-parsed)
 *   2. Review and edit the extracted line items
 *   3. Confirm to deduct ingredients from inventory
 *
 * Self-contained: fetches its own inventory/recipe context for better AI
 * matching and refreshes its own sales history after each upload.
 */
export default function EnhancedSalesUpload({
  currentLocation,
  onUploadComplete,
}: EnhancedSalesUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<SalesRecord | null>(null);
  const [salesHistory, setSalesHistory] = useState<SalesRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSalesHistory = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inventory/sales', { headers });
      if (res.ok) {
        const data = await res.json();
        setSalesHistory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch sales history:', err);
    }
  }, []);

  useEffect(() => {
    fetchSalesHistory();
  }, [fetchSalesHistory]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      const validTypes = [
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!validTypes.includes(file.type) && !['csv', 'pdf', 'xlsx', 'xls'].includes(ext || '')) {
        setError('Please upload a PDF, CSV, or Excel file.');
        return;
      }

      setError(null);
      setUploading(true);
      setProcessing(true);

      try {
        // Fetch context to improve AI matching, scoped to the active location.
        const headers = await getAuthHeaders();
        const locationQuery =
          currentLocation === 'all' ? '' : `?location_slug=${currentLocation}`;
        const [invRes, recRes] = await Promise.all([
          fetch(`/api/inventory${locationQuery}`, { headers }),
          fetch(`/api/inventory/recipes${locationQuery}`, { headers }),
        ]);
        const inventory = invRes.ok ? (await invRes.json()).data || [] : [];
        const recipes = recRes.ok ? (await recRes.json()).data || [] : [];

        const formData = new FormData();
        formData.append('file', file);
        formData.append(
          'recipes',
          JSON.stringify(
            recipes.map((r: { id: string; name: string; ingredients: unknown }) => ({
              id: r.id,
              name: r.name,
              ingredients: r.ingredients,
            }))
          )
        );
        formData.append(
          'inventory',
          JSON.stringify(
            inventory.map((i: { id: string; name: string; brand?: string }) => ({
              id: i.id,
              name: i.name,
              brand: i.brand,
            }))
          )
        );

        // Reuse auth headers from above, removing Content-Type for FormData
        const { 'Content-Type': _, ...headersWithoutContentType } = headers;
        const res = await fetch('/api/inventory/sales', {
          method: 'POST',
          headers: headersWithoutContentType,
          body: formData,
        });

        if (!res.ok) {
          throw new Error('Failed to process file. Please try again.');
        }

        const data = await res.json();
        setPendingRecord({
          id: data.id || crypto.randomUUID(),
          upload_date: new Date().toISOString(),
          period_start: data.period_start || '',
          period_end: data.period_end || '',
          source_filename: file.name,
          items: data.items || [],
          total_revenue: data.total_revenue || 0,
          total_cost: data.total_cost || 0,
          status: 'reviewing',
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file.');
      } finally {
        setUploading(false);
        setProcessing(false);
      }
    },
    [currentLocation]
  );

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

  const updateSalesItem = (
    index: number,
    field: keyof SalesItem,
    value: number | string
  ) => {
    if (!pendingRecord) return;
    const updated = [...pendingRecord.items];
    updated[index] = { ...updated[index], [field]: value };
    const newRevenue = updated.reduce((sum, item) => sum + item.revenue, 0);
    setPendingRecord({ ...pendingRecord, items: updated, total_revenue: newRevenue });
  };

  const removeSalesItem = (index: number) => {
    if (!pendingRecord) return;
    const updated = pendingRecord.items.filter((_, i) => i !== index);
    const newRevenue = updated.reduce((sum, item) => sum + item.revenue, 0);
    setPendingRecord({ ...pendingRecord, items: updated, total_revenue: newRevenue });
  };

  const handleConfirmProcess = async () => {
    if (!pendingRecord) return;
    setConfirming(true);
    setError(null);
    try {
      const baseHeaders = await getAuthHeaders();
      const headers = { ...baseHeaders, 'Content-Type': 'application/json' };
      const res = await fetch('/api/inventory/sales', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          id: pendingRecord.id,
          items: pendingRecord.items,
          total_revenue: pendingRecord.total_revenue,
          total_cost: pendingRecord.total_cost,
          source_filename: pendingRecord.source_filename,
          period_start: pendingRecord.period_start,
          period_end: pendingRecord.period_end,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to process sales.');
      }

      setPendingRecord(null);
      await fetchSalesHistory();
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process sales.');
    } finally {
      setConfirming(false);
    }
  };

  const formatCurrency = (val: number) => '$' + val.toFixed(2);

  return (
    <>
      {/* Upload Area */}
      {!pendingRecord && !processing && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          <div
            className={`${styles.uploadZone} ${uploading ? styles.uploadZoneActive : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={44} className={styles.uploadIcon} />
            <h3 className={styles.uploadTitle}>Upload Sales Report</h3>
            <p className={styles.uploadSubtext}>
              Drop your sales file here, or click to browse
            </p>
            <div className={styles.uploadFormats}>
              <span className={styles.uploadFormat}>PDF</span>
              <span className={styles.uploadFormat}>CSV</span>
              <span className={styles.uploadFormat}>Excel</span>
            </div>
          </div>
        </>
      )}

      {/* Processing State */}
      {processing && (
        <div className={styles.processingOverlay}>
          <div className={styles.spinner} />
          <p className={styles.processingText}>Processing sales data...</p>
          <p className={styles.processingSubtext}>
            AI is reading and interpreting your sales report
          </p>
        </div>
      )}

      {/* Review Pending Sales */}
      {pendingRecord && !processing && (
        <div className={styles.salesReviewSection}>
          <div className={styles.salesReviewHeader}>
            <div>
              <h3 className={styles.salesReviewTitle}>
                Review Sales — {pendingRecord.source_filename}
              </h3>
              {pendingRecord.period_start && (
                <p style={{ fontSize: '0.75rem', color: '#868686', margin: '0.25rem 0 0' }}>
                  {pendingRecord.period_start}
                  {pendingRecord.period_end ? ` to ${pendingRecord.period_end}` : ''}
                </p>
              )}
            </div>
            <button
              className={styles.btnTertiary}
              style={{ padding: '0.375rem' }}
              onClick={() => setPendingRecord(null)}
              disabled={confirming}
            >
              <X size={16} />
            </button>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#868686', marginBottom: '0.75rem' }}>
            Review and edit the quantities below, then confirm to deduct from inventory.
          </p>

          {pendingRecord.items.map((item, idx) => (
            <div key={idx} className={styles.salesItemRow}>
              <span className={styles.salesItemName}>{item.name}</span>
              <input
                type="number"
                min="0"
                className={styles.salesItemInput}
                value={item.quantity_sold}
                onChange={(e) =>
                  updateSalesItem(idx, 'quantity_sold', parseInt(e.target.value) || 0)
                }
                title="Quantity sold"
              />
              <span className={styles.salesItemRevenue}>
                {formatCurrency(item.revenue)}
              </span>
              <button
                className={styles.ingredientRemoveBtn}
                onClick={() => removeSalesItem(idx)}
                title="Remove item"
                disabled={confirming}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <div className={styles.salesTotals}>
            <span className={styles.salesTotalLabel}>Total Revenue</span>
            <span className={styles.salesTotalValue}>
              {formatCurrency(pendingRecord.total_revenue)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              className={styles.btnTertiary}
              style={{ flex: 1 }}
              onClick={() => setPendingRecord(null)}
              disabled={confirming}
            >
              Cancel
            </button>
            <button
              className={styles.btnPrimary}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleConfirmProcess}
              disabled={confirming}
            >
              <Check size={16} /> {confirming ? 'Processing...' : 'Confirm & Deduct'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          style={{
            color: '#DC2626',
            fontSize: '0.8125rem',
            marginTop: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      {/* Sales History */}
      {salesHistory.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3
            style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: '#1F1F1F',
              marginBottom: '1rem',
            }}
          >
            Sales History
          </h3>
          <div className={styles.salesHistoryList}>
            {salesHistory.map((record) => (
              <div key={record.id} className={styles.salesHistoryCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileText size={20} style={{ color: '#ABA8A1', flexShrink: 0 }} />
                  <div className={styles.salesHistoryInfo}>
                    <p className={styles.salesHistoryFilename}>{record.source_filename}</p>
                    <p className={styles.salesHistoryMeta}>
                      <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      {new Date(record.upload_date).toLocaleDateString()}
                      {' — '}
                      {record.items.length} items
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    className={`${styles.statusBadge} ${
                      record.status === 'processed'
                        ? styles.statusProcessed
                        : record.status === 'reviewing'
                          ? styles.statusReviewing
                          : record.status === 'error'
                            ? styles.statusError
                            : styles.statusPending
                    }`}
                  >
                    {record.status}
                  </span>
                  <span className={styles.salesHistoryRevenue}>
                    {formatCurrency(record.total_revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
