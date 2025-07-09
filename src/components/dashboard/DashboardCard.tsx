import React from 'react';
import styles from '../../styles/DashboardCard.module.css';

interface DashboardCardProps {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ label, value, children, className }) => {
  return (
    <div className={`${styles.card} ${className || ''}`}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
      {children && <div className={styles.extra}>{children}</div>}
    </div>
  );
};

export default DashboardCard; 