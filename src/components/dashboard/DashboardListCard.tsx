import React from 'react';
import styles from '../../styles/DashboardListCard.module.css';

interface DashboardListCardProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

const DashboardListCard: React.FC<DashboardListCardProps> = ({ label, children, className }) => {
  return (
    <div className={`${styles.listCard} ${className || ''}`}>
      <div className={styles.label}>{label}</div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};

export default DashboardListCard; 