import React, { useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import styles from '../../styles/Inventory.module.css';
import t from '../../styles/ToastInventory.module.css';
import { getAuthHeaders } from '../../lib/client-auth';

interface PreviewResult {
  format: 'item_selections' | 'product_mix';
  rows: number;
  drinks: number;
  period_start: string;
  period_end: string;
  conflicts: { business_date: string; source: string; period_start: string | null }[];
  error?: string;
}

function yesterdayChicago(): string {
  const d = new Date(Date.now() - 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

const FORMAT_LABEL: Record<PreviewResult['format'], string> = {
  product_mix: 'Toast Product Mix report',
  item_selections: 'Toast ItemSelectionDetails (nightly export file)',
};

/**
 * Backup to the nightly Toast sync: upload a Product Mix CSV exported from
 * Toast Web (or paste it), or a day's ItemSelectionDetails.csv. Imported days
 * join the same review-and-approve list.
 */
export default function ManualSalesUpload({ onImported }: { onImported: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('pasted report');
  const [start, setStart] = useState(yesterdayChicago());
  const [end, setEnd] = useState(yesterdayChicago());
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setContent('');
    setFilename('pasted report');
    setPreview(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (f: File | undefined) => {
    setPreview(null);
    setError(null);
    if (!f) return;
    if (!/\.(csv|tsv|txt)$/i.test(f.name)) {
      setError('Export the report from Toast as CSV — Excel and PDF files can’t be read here.');
      return;
    }
    setFilename(f.name);
    setContent(await f.text());
  };

  const send = async (dryRun: boolean) => {
    setError(null);
    if (!content.trim()) return setError('Choose a file or paste the report first');
    setBusy(true);
    try {
      const res = await fetch('/api/inventory/toast/manual-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ content, filename, period_start: start, period_end: end, preview: dryRun }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Upload failed (${res.status})`);
        if (body.format) setPreview(body);
        return;
      }
      if (dryRun) {
        setPreview(body);
      } else {
        onImported(
          body.closed_no_sales
            ? 'Report imported — nothing in it comes out of stock, so there’s nothing to approve.'
            : 'Report imported — review and apply it in the list above.'
        );
        reset();
        setOpen(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className={styles.btnTertiary} onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start' }}>
        <Upload size={16} /> Upload a Toast report by hand
      </button>
    );
  }

  return (
    <div className={t.syncBar} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div>
        <p className={t.syncTitle}>Upload a Toast report</p>
        <p className={t.syncMeta}>
          Backup to the nightly sync, or for days before it started. Toast Web → Reports → Product Mix → export CSV (or copy the table and paste it below).
          The dates must be the dates the report covers.
        </p>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>First business day</label>
          <input className={styles.formInput} type="date" value={start} onChange={e => { setStart(e.target.value); setPreview(null); }} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Last business day</label>
          <input className={styles.formInput} type="date" value={end} onChange={e => { setEnd(e.target.value); setPreview(null); }} />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>CSV file</label>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" onChange={e => onFile(e.target.files?.[0])} style={{ minHeight: 44 }} />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>…or paste the report</label>
        <textarea
          className={styles.formTextarea}
          rows={4}
          placeholder="Menu Item	Menu Group	Menu	Avg Price	Item Qty	…"
          value={filename === 'pasted report' ? content : ''}
          onChange={e => {
            setFilename('pasted report');
            setContent(e.target.value);
            setPreview(null);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
      </div>

      {preview && (
        <div className={t.notice} style={{ background: preview.conflicts.length ? '#FEE2E2' : '#F7F6F2', color: '#1F1F1F' }}>
          <FileText size={14} style={{ verticalAlign: '-2px' }} /> {FORMAT_LABEL[preview.format]} · {preview.rows} rows · {preview.drinks.toLocaleString('en-US', { maximumFractionDigits: 2 })} items sold ·{' '}
          {preview.period_start === preview.period_end ? preview.period_start : `${preview.period_start} to ${preview.period_end}`}
          {preview.conflicts.length > 0 && (
            <div className={t.reason}>
              Already imported: {preview.conflicts.map(c => (c.period_start && c.period_start !== c.business_date ? `${c.period_start}–${c.business_date}` : c.business_date)).join(', ')} — uploading would count those sales twice.
            </div>
          )}
        </div>
      )}
      {error && <div className={`${t.notice} ${t.noticeError}`}>{error}</div>}

      <div className={t.syncActions} style={{ justifyContent: 'flex-end' }}>
        <button className={styles.btnSecondary} onClick={() => { reset(); setOpen(false); }} disabled={busy}>
          Cancel
        </button>
        <button className={styles.btnSecondary} onClick={() => send(true)} disabled={busy || !content.trim()}>
          Check file
        </button>
        <button className={styles.btnPrimary} onClick={() => send(false)} disabled={busy || !preview || preview.conflicts.length > 0}>
          {busy ? 'Working…' : 'Import'}
        </button>
      </div>
    </div>
  );
}
