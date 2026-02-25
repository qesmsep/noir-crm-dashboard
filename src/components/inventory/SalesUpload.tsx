import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  X,
  Check,
  AlertTriangle,
  TrendingDown,
  Clock,
  DollarSign,
} from 'lucide-react';
import type {
  SalesRecord,
  SalesItem,
  InventoryItem,
  Recipe,
} from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';

interface SalesUploadProps {
  inventory: InventoryItem[];
  recipes: Recipe[];
  salesHistory: SalesRecord[];
  onProcessSales: (record: SalesRecord) => void;
}

export default function SalesUpload({
  inventory,
  recipes,
  salesHistory,
  onProcessSales,
}: SalesUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<SalesRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const formData = new FormData();
        formData.append('file', file);
        formData.append('recipes', JSON.stringify(recipes.map((r) => ({ id: r.id, name: r.name, ingredients: r.ingredients }))));
        formData.append('inventory', JSON.stringify(inventory.map((i) => ({ id: i.id, name: i.name, brand: i.brand }))));

        const res = await fetch('/api/inventory/sales', {
          method: 'POST',
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
      } catch (err: any) {
        setError(err.message || 'Failed to process file.');
      } finally {
        setUploading(false);
        setProcessing(false);
      }
    },
    [inventory, recipes]
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

  const handleConfirmProcess = () => {
    if (!pendingRecord) return;
    onProcessSales({ ...pendingRecord, status: 'processed' });
    setPendingRecord(null);
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
              Drop your weekend sales file here, or click to browse
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
                  updateSalesItem(
                    idx,
                    'quantity_sold',
                    parseInt(e.target.value) || 0
                  )
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
            >
              Cancel
            </button>
            <button
              className={styles.btnPrimary}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleConfirmProcess}
            >
              <Check size={16} /> Confirm & Deduct
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
                    <p className={styles.salesHistoryFilename}>
                      {record.source_filename}
                    </p>
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
