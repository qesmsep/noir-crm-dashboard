import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import styles from '../styles/SubscriptionTransactionHistory.module.css';
import { Download, ExternalLink } from 'lucide-react';

interface Invoice {
  id: string;
  number: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  paid_at: number | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  description: string | null;
  lines: {
    description: string | null;
    amount: number;
    quantity: number | null;
    period: {
      start: number;
      end: number;
    } | null;
  }[];
}

interface Props {
  accountId: string;
}

export default function SubscriptionTransactionHistory({ accountId }: Props) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (accountId) {
      fetchInvoices();
    }
  }, [accountId]);

  const fetchInvoices = async () => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/invoices?limit=20`);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setInvoices(result.invoices || []);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'Error',
        description: 'Failed to load transaction history',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'paid':
        return styles.statusPaid;
      case 'open':
        return styles.statusOpen;
      case 'void':
      case 'uncollectible':
        return styles.statusFailed;
      case 'draft':
        return styles.statusDraft;
      default:
        return styles.statusDefault;
    }
  };

  const displayedInvoices = showAll ? invoices : invoices.slice(0, 5);

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>Transaction History</h3>
        </div>
        <div className={styles.loading}>Loading transactions...</div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>Transaction History</h3>
        </div>
        <div className={styles.empty}>
          <p>No subscription transactions found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Transaction History</h3>
        <span className={styles.count}>{invoices.length} transactions</span>
      </div>

      <div className={styles.invoiceList}>
        {displayedInvoices.map((invoice) => (
          <div key={invoice.id} className={styles.invoiceRow}>
            <div className={styles.invoiceDescription}>
              {invoice.lines.length > 0
                ? (invoice.lines[0].description || invoice.description || 'Subscription payment')
                : (invoice.description || 'Subscription payment')}
            </div>

            <div className={styles.invoiceDate}>
              {formatDate(invoice.paid_at || invoice.created)}
            </div>

            <div className={styles.amount}>
              {formatCurrency(invoice.amount_paid || invoice.amount_due, invoice.currency)}
            </div>

            <div className={styles.invoiceActions}>
              {invoice.invoice_pdf && (
                <a
                  href={invoice.invoice_pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.actionLink}
                >
                  <Download className={styles.icon} />
                  PDF
                </a>
              )}
              {invoice.hosted_invoice_url && (
                <a
                  href={invoice.hosted_invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.actionLink}
                >
                  <ExternalLink className={styles.icon} />
                  View
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {invoices.length > 5 && (
        <div className={styles.footer}>
          <button
            className={styles.showMoreButton}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : `Show All (${invoices.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
