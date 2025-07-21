import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '../../styles/DashboardCard.module.css';

interface BreakdownItem {
  id?: string;
  member_id?: string;
  member_name?: string;
  name?: string;
  amount?: number;
  date?: string;
  note?: string;
  membership?: string;
  monthly_dues?: number;
}

interface DashboardCardProps {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  description?: string;
  breakdown?: BreakdownItem[];
  breakdownTitle?: string;
  showBreakdown?: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ 
  label, 
  value, 
  children, 
  className,
  description,
  breakdown,
  breakdownTitle,
  showBreakdown = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    if (breakdown && breakdown.length > 0) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsExpanded(false);
    }
  };

  const isClickable = breakdown && breakdown.length > 0;

  const renderBreakdown = () => {
    if (!isExpanded || !breakdown) return null;

    const breakdownContent = (
      <>
        <div className={styles.backdrop} onClick={handleBackdropClick}></div>
        <div className={styles.breakdown}>
          <div className={styles.breakdownHeader}>
            <div>
              <h4>{breakdownTitle || 'Breakdown'}</h4>
              {description && (
                <div className={styles.breakdownDescription}>{description}</div>
              )}
            </div>
            <button 
              className={styles.closeButton}
              onClick={handleClose}
              type="button"
            >
              ×
            </button>
          </div>
          <div className={styles.breakdownContent}>
            {breakdown.map((item, index) => (
              <div key={item.id || index} className={styles.breakdownItem}>
                <div className={styles.breakdownName}>
                  {item.member_name || item.name || 'Unknown'}
                </div>
                <div className={styles.breakdownAmount}>
                  ${item.amount?.toFixed(2) || item.monthly_dues?.toFixed(2) || '0.00'}
                </div>
                {item.note && (
                  <div className={styles.breakdownNote}>{item.note}</div>
                )}
                {item.date && (
                  <div className={styles.breakdownDate}>
                    {new Date(item.date).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </>
    );

    // Use portal to render at document body level
    return createPortal(breakdownContent, document.body);
  };

  return (
    <div className={`${styles.card} ${className || ''} ${isClickable ? styles.clickable : ''}`}>
      <div 
        className={styles.cardContent}
        onClick={isClickable ? handleClick : undefined}
        style={{ cursor: isClickable ? 'pointer' : 'default' }}
      >
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{label}</div>
        {description && (
          <div className={styles.description} title={description}>
            ℹ️
          </div>
        )}
        {children && <div className={styles.extra}>{children}</div>}
      </div>
      
      {renderBreakdown()}
    </div>
  );
};

export default DashboardCard; 