import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isActive = status === 'active';

  return (
    <span
      style={{
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500,
        background: isActive ? '#E8F5E9' : '#FFF3E0',
        color: isActive ? '#2E7D32' : '#EF6C00',
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
