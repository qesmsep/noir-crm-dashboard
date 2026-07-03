import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
  /** Disables both actions while a confirmed operation is in flight. */
  disabled?: boolean;
}

/**
 * Confirmation dialog built on the shared Radix AlertDialog primitives, so
 * focus trapping, Escape handling, and scroll-lock come from the design system
 * rather than a hand-rolled portal.
 *
 * Close handling uses a single path: `onOpenChange(false)` (fired by Escape or
 * the Cancel button) calls `onCancel` exactly once. The confirm button sets a
 * ref before running `onConfirm` so the close it triggers does NOT also fire
 * `onCancel`. This avoids the double-invocation you'd get from wiring both an
 * `onClick` and `onOpenChange` to the same handler.
 *
 * Note: AlertDialog intentionally does NOT close on overlay/outside click,
 * which is the desired guard for a destructive action.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  disabled = false,
}: ConfirmDialogProps) {
  // Set when the confirm button triggers the close, so onOpenChange skips onCancel.
  const confirmingRef = React.useRef(false);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        if (confirmingRef.current) {
          confirmingRef.current = false;
          return;
        }
        onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            onClick={() => {
              confirmingRef.current = true;
              onConfirm();
            }}
            className={variant === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : ''}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
