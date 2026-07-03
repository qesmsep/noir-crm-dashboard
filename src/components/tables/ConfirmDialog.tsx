import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const portalContent = (
    <div
      className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center pointer-events-none"
      style={{ zIndex: 999999999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      {/* Overlay */}
      <div
        className="fixed top-0 left-0 w-screen h-screen bg-black/70 pointer-events-auto cursor-pointer"
        style={{ zIndex: 999999998 }}
        onClick={onCancel}
      />

      {/* Dialog Content */}
      <div
        className="relative pointer-events-auto max-w-[400px] w-[90vw] shadow-2xl flex flex-col"
        style={{
          zIndex: 999999999,
          backgroundColor: '#ecede8',
          borderRadius: '10px',
          border: '2px solid #353535',
          fontFamily: 'Montserrat, sans-serif',
        }}
      >
        {/* Header */}
        <div className="border-b p-4 pb-3 pt-3 flex-shrink-0" style={{ fontFamily: 'IvyJournal, sans-serif' }}>
          <h2 className="text-xl font-bold" style={{ color: '#353535' }}>
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="p-4">
          <p style={{ color: '#353535', lineHeight: 1.5 }}>{message}</p>
        </div>

        {/* Footer */}
        <div
          className="border-t p-3 flex justify-end items-center gap-2 flex-shrink-0"
          style={{
            backgroundColor: '#f9f9f7',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
          }}
        >
          <Button variant="outline" onClick={onCancel} type="button">
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            type="button"
            className={variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : ''}
            style={
              variant === 'danger'
                ? { backgroundColor: '#dc2626', borderColor: '#dc2626', color: 'white' }
                : { backgroundColor: '#A59480', borderColor: '#A59480', color: 'white' }
            }
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(portalContent, document.body);
}
