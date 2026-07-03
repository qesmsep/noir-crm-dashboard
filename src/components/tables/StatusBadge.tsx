import React from 'react';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
}

/**
 * Thin wrapper mapping a table's active/inactive status onto the shared Badge
 * variants (success/warning) instead of hand-rolled hex colors.
 */
export default function StatusBadge({ status }: StatusBadgeProps) {
  const isActive = status === 'active';

  return (
    <Badge variant={isActive ? 'success' : 'warning'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
