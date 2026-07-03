import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog from './ConfirmDialog';
import { formatTableNumber } from '@/lib/utils';

interface TableData {
  id: string;
  table_number: number;
  seats: number;
  status: string;
  location_id: string;
}

interface TableFormData {
  table_number: number;
  seats: number;
  status: 'active' | 'inactive';
}

// While editing, the numeric fields may be transiently empty (user cleared the
// input to retype). We keep '' in local state so the field doesn't snap back to
// a default, and coerce to numbers on submit.
interface TableFormState {
  table_number: number | '';
  seats: number | '';
  status: 'active' | 'inactive';
}

interface TableEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TableFormData) => void;
  onDelete?: (id: string) => void;
  editTable: TableData | null;
  saving: boolean;
  locationName?: string;
  error?: string | null;
}

const EMPTY_FORM: TableFormState = {
  table_number: 1,
  seats: 2,
  status: 'active',
};

export default function TableEditModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editTable,
  saving,
  locationName = '',
  error = null,
}: TableEditModalProps) {
  const [form, setForm] = useState<TableFormState>(EMPTY_FORM);
  const [mounted, setMounted] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (editTable) {
      setForm({
        table_number: editTable.table_number,
        seats: editTable.seats,
        status: editTable.status as 'active' | 'inactive',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editTable, isOpen]);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    // Lock body scroll when modal is open
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      // When the delete-confirmation dialog is open, let it handle Escape
      // (dismissing only itself) rather than also closing the whole modal
      // and discarding in-progress edits.
      if (e.key === 'Escape' && !showConfirmDelete) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, showConfirmDelete]);

  const handleChange = (
    field: keyof TableFormState,
    value: string | number
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against submitting while a numeric field is transiently empty
    // (the `required`/`min` attributes normally block this at the browser).
    if (form.table_number === '' || form.seats === '') {
      return;
    }
    onSave({
      table_number: Number(form.table_number),
      seats: Number(form.seats),
      status: form.status,
    });
  };

  const handleDeleteClick = () => {
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = () => {
    if (editTable && onDelete) {
      onDelete(editTable.id);
      setShowConfirmDelete(false);
    }
  };

  // Don't render portal if not open or not mounted
  if (!mounted) return null;

  if (!isOpen) {
    return null;
  }

  // Create portal content directly - matching ReservationModalFixed style
  const portalContent = (
    <div
      className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center pointer-events-none"
      style={{ zIndex: 99999999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Overlay */}
      <div
        className="fixed top-0 left-0 w-screen h-screen bg-black/70 pointer-events-auto cursor-pointer"
        style={{ zIndex: 99999998 }}
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className="relative pointer-events-auto max-w-[400px] w-[90vw] shadow-2xl flex flex-col"
        style={{
          zIndex: 99999999,
          backgroundColor: '#ecede8',
          borderRadius: '10px',
          border: '2px solid #353535',
          fontFamily: 'Montserrat, sans-serif',
          maxHeight: 'calc(100vh - 40px)',
        }}
      >
        {/* Header */}
        <div className="border-b p-4 pb-2 pt-3 flex-shrink-0" style={{ fontFamily: 'IvyJournal, sans-serif' }}>
          <h2 className="text-xl font-bold" style={{ color: '#353535' }}>
            {editTable ? `Edit Table ${formatTableNumber(editTable.table_number)}` : 'Add Table'}
            {locationName && <span className="text-sm font-normal ml-2">({locationName})</span>}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2 right-2 text-2xl"
          >
            ×
          </Button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-3 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3">
            {/* Error (rendered inline so it isn't hidden behind the overlay) */}
            {error && (
              <div
                role="alert"
                className="text-sm rounded px-3 py-2"
                style={{ backgroundColor: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7' }}
              >
                {error}
              </div>
            )}
            {/* Table Number */}
            <div>
              <label className="text-sm md:text-xs font-semibold mb-1 block">
                Table Number *
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                className="h-8"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
                value={form.table_number}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    handleChange('table_number', '');
                    return;
                  }
                  const value = parseInt(raw, 10);
                  if (value >= 1) {
                    handleChange('table_number', value);
                  }
                }}
                required
              />
              <p className="text-xs text-gray-600 mt-1">
                Unique number for this table at this location
              </p>
            </div>

            {/* Seats */}
            <div>
              <label className="text-sm md:text-xs font-semibold mb-1 block">
                Seats *
              </label>
              <Input
                type="number"
                min="1"
                max="20"
                step="1"
                className="h-8"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
                value={form.seats}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    handleChange('seats', '');
                    return;
                  }
                  const value = parseInt(raw, 10);
                  if (value >= 1 && value <= 20) {
                    handleChange('seats', value);
                  }
                }}
                required
              />
              <p className="text-xs text-gray-600 mt-1">
                Number of seats (1-20)
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm md:text-xs font-semibold mb-1 block">
                Status
              </label>
              <select
                className="h-8 w-full rounded-lg border border-gray-300 px-3 text-sm"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
                value={form.status}
                onChange={(e) =>
                  handleChange('status', e.target.value as 'active' | 'inactive')
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="text-xs text-gray-600 mt-1">
                Inactive tables won't be available for reservations
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div
          className="border-t p-3 flex justify-between items-center flex-shrink-0"
          style={{
            backgroundColor: '#f9f9f7',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px'
          }}
        >
          <div>
            {editTable && onDelete && (
              <Button
                variant="ghost"
                onClick={handleDeleteClick}
                type="button"
                disabled={saving}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              type="button"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                saving ||
                !form.table_number ||
                !form.seats ||
                form.seats < 1 ||
                form.seats > 20
              }
              style={{
                backgroundColor: '#A59480',
                borderColor: '#A59480',
                color: 'white',
              }}
            >
              {saving
                ? 'Saving...'
                : editTable
                ? 'Update'
                : 'Add Table'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Portal to document.body with explicit positioning
  return (
    <>
      {createPortal(portalContent, document.body)}
      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Table"
        message={`Are you sure you want to delete Table ${editTable ? formatTableNumber(editTable.table_number) : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        disabled={saving}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </>
  );
}