import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import styles from '../styles/SubscriptionTransactionHistory.module.css';
import { Download, ExternalLink, MoreVertical } from 'lucide-react';

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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
        {invoices.map((invoice) => (
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

            <span className={`${styles.statusBadge} ${getStatusBadgeClass(invoice.status)}`}>
              {invoice.status === 'paid' ? 'Paid' :
               invoice.status === 'uncollectible' ? 'Failed' :
               invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>

            <div className={styles.invoiceActions}>
              <button
                className={styles.menuButton}
                onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)}
              >
                <MoreVertical className={styles.icon} />
              </button>

              {openMenuId === invoice.id && (
                <div className={styles.actionMenu}>
                  {invoice.invoice_pdf && (
                    <a
                      href={invoice.invoice_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.menuItem}
                    >
                      <Download className={styles.menuIcon} />
                      Download PDF
                    </a>
                  )}
                  {invoice.hosted_invoice_url && (
                    <a
                      href={invoice.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.menuItem}
                    >
                      <ExternalLink className={styles.menuIcon} />
                      View Receipt
                    </a>
                  )}
                  {!invoice.invoice_pdf && !invoice.hosted_invoice_url && (
                    <div className={styles.menuItemDisabled}>
                      No actions available
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
