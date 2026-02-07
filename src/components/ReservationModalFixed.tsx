import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { localInputToUTC } from '../utils/dateUtils';
import { useSettings } from '../context/SettingsContext';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialTableId?: string;
  onReservationCreated: () => void;
}

const eventTypes = [
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'engagement', label: '💍 Engagement' },
  { value: 'anniversary', label: '🥂 Anniversary' },
  { value: 'party', label: '🎉 Party / Celebration' },
  { value: 'graduation', label: '🎓 Graduation' },
  { value: 'corporate', label: '🧑‍💼 Corporate Event' },
  { value: 'holiday', label: '❄️ Holiday Gathering' },
  { value: 'networking', label: '🤝 Networking' },
  { value: 'fundraiser', label: '🎗️ Fundraiser / Charity' },
  { value: 'bachelor', label: '🥳 Bachelor / Bachelorette Party' },
  { value: 'fun', label: '🍸 Fun Night Out' },
  { value: 'date', label: '💕 Date Night' },
];

/**
 * ReservationModalFixed - Forces portal to document.body with explicit positioning
 * This mimics how the drawer works by using position: fixed directly
 */
const ReservationModalFixed: React.FC<ReservationModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialTableId,
  onReservationCreated,
}) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    party_size: 2,
    event_type: '',
    notes: '',
    table_id: initialTableId || '',
    start_time: '',
    end_time: '',
    is_checked_in: false,
    send_access_instructions: false,
    send_reminder: false,
    send_confirmation: false,
  });
  const [tables, setTables] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';

  const handleClose = useCallback(() => {
    // Unlock body scroll immediately
    document.body.style.overflow = '';

    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      party_size: 2,
      event_type: '',
      notes: '',
      table_id: '',
      start_time: '',
      end_time: '',
      is_checked_in: false,
      send_access_instructions: false,
      send_reminder: false,
      send_confirmation: false,
    });

    onClose();
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
    return () => {
      // Cleanup: ensure body scroll is unlocked
      document.body.style.overflow = '';
    };
  }, []);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }
    
    // Lock body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (isOpen) {
      fetchTables();
      const startTime = initialDate ? new Date(initialDate) : new Date();
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
      
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        party_size: 2,
        event_type: '',
        notes: '',
        table_id: initialTableId || '',
        start_time: startTime.toISOString().slice(0, 16),
        end_time: endTime.toISOString().slice(0, 16),
        is_checked_in: false,
        send_access_instructions: false,
        send_reminder: false,
        send_confirmation: false,
      });
    }
  }, [isOpen, initialDate, initialTableId]);

  useEffect(() => {
    if (isOpen && initialTableId) {
      setFormData(prev => ({
        ...prev,
        table_id: initialTableId
      }));
    }
  }, [isOpen, initialTableId]);

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        party_size: 2,
        event_type: '',
        notes: '',
        table_id: '',
        start_time: '',
        end_time: '',
        is_checked_in: false,
        send_access_instructions: false,
        send_reminder: false,
        send_confirmation: false,
      });
    }
  }, [isOpen]);

  const fetchTables = async () => {
    try {
      const response = await fetch('/api/tables');
      if (response.ok) {
        const result = await response.json();
        setTables(result.data || []);
      } else {
        console.error('Failed to fetch tables:', response.status);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!formData.first_name || !formData.last_name || !formData.phone) {
        toast({
          title: 'Required fields missing',
          description: 'Please fill in first name, last name, and phone number.',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      if (!formData.start_time || !formData.end_time) {
        toast({
          title: 'Time required',
          description: 'Please select start and end times.',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      const startTimeUTC = localInputToUTC(formData.start_time, timezone);
      const endTimeUTC = localInputToUTC(formData.end_time, timezone);
      const cleanedPhone = formData.phone.replace(/\D/g, '');
      const tableId = formData.table_id === '' ? null : formData.table_id;

      const reservationData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: cleanedPhone,
        party_size: formData.party_size,
        event_type: formData.event_type,
        notes: formData.notes,
        table_id: tableId,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        is_checked_in: formData.is_checked_in,
        send_access_instructions: formData.send_access_instructions,
        send_reminder: formData.send_reminder,
        send_confirmation: formData.send_confirmation,
        source: 'manual'
      };

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create reservation');
      }

      toast({
        title: 'Success',
        description: 'Reservation created successfully!',
        status: 'success',
        duration: 3000,
      });

      // Close modal FIRST to prevent blocking - just call onClose directly
      onClose();
      // Small delay to ensure modal portal is fully removed before reload
      setTimeout(() => {
        onReservationCreated();
      }, 150);
      
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create reservation',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Don't render portal if not open or not mounted
  if (!mounted) return null;
  
  if (!isOpen) {
    // Ensure body scroll is unlocked when modal is closed
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    // Return null to ensure portal is completely removed
    return null;
  }
  
  // Ensure body scroll is locked when modal is open
  if (typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  }

  // Create portal content directly - similar to how drawer works
  const portalContent = (
    <div
      className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center pointer-events-none"
      style={{ zIndex: 99999999 }}
      onClick={(e) => {
        // Close if clicking on the backdrop (the container itself)
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      {/* Overlay */}
      <div
        className="fixed top-0 left-0 w-screen h-screen bg-black/70 pointer-events-auto cursor-pointer"
        style={{ zIndex: 99999998 }}
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div
        className="relative pointer-events-auto max-w-[500px] w-[90vw] max-h-[85vh] overflow-y-auto shadow-2xl"
        style={{
          zIndex: 99999999,
          backgroundColor: '#ecede8',
          borderRadius: '10px',
          border: '2px solid #353535',
          fontFamily: 'Montserrat, sans-serif'
        }}
      >
        {/* Header */}
        <div className="border-b p-4 pb-2 pt-3" style={{ fontFamily: 'IvyJournal, sans-serif' }}>
          <h2 className="text-xl font-bold" style={{ color: '#353535' }}>
            New Reservation
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-2 right-2"
          >
            ×
          </Button>
        </div>

        {/* Body */}
        <div className="p-3 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-2">
                  <label className="text-xs font-semibold mb-0.5 block">First Name *</label>
                  <Input
                    className="h-8"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label className="text-xs font-semibold mb-0.5 block">Last Name *</label>
                  <Input
                    className="h-8"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label className="text-xs font-semibold mb-0.5 block">Email</label>
                  <Input
                    className="h-8"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label className="text-xs font-semibold mb-0.5 block">Phone *</label>
                  <Input
                    className="h-8"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-2">
                  <label className="text-xs font-semibold mb-0.5 block">Party Size *</label>
                  <select
                    className="h-8 w-full rounded-lg border border-gray-300 px-3 text-sm"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                    value={formData.party_size}
                    onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))}
                    required
                  >
                    {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label className="text-xs font-semibold mb-0.5 block">Event Type</label>
                  <select
                    className="h-8 w-full rounded-lg border border-gray-300 px-3 text-sm"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                    value={formData.event_type}
                    onChange={(e) => handleInputChange('event_type', e.target.value)}
                  >
                    <option value="">Select</option>
                    {eventTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-2">
                  <label className="text-xs font-semibold mb-0.5 block">Start Time *</label>
                  <Input
                    className="h-8"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label className="text-xs font-semibold mb-0.5 block">End Time *</label>
                  <Input
                    className="h-8"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="mb-2">
              <label className="text-xs font-semibold mb-0.5 block">Table</label>
              <select
                className="h-8 w-full rounded-lg border border-gray-300 px-3 text-sm"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
                value={formData.table_id}
                onChange={(e) => handleInputChange('table_id', e.target.value)}
              >
                <option value="">Select table</option>
                {tables.map(table => (
                  <option key={table.id} value={table.id}>Table {table.table_number}</option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="text-xs font-semibold mb-0.5 block">Notes</label>
              <Textarea
                style={{ fontFamily: 'Montserrat, sans-serif' }}
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={2}
                placeholder="Special requests..."
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.is_checked_in}
                  onCheckedChange={(checked) => handleInputChange('is_checked_in', checked)}
                />
                <label className="text-xs" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Check in
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.send_confirmation}
                  onCheckedChange={(checked) => handleInputChange('send_confirmation', checked)}
                />
                <label className="text-xs" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Send confirmation
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.send_access_instructions}
                  onCheckedChange={(checked) => handleInputChange('send_access_instructions', checked)}
                />
                <label className="text-xs" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Send access instructions
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.send_reminder}
                  onCheckedChange={(checked) => handleInputChange('send_reminder', checked)}
                />
                <label className="text-xs" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Send reminder
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex justify-end">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} size="sm" className="h-8">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(portalContent, document.body)
    : null;
};

export default ReservationModalFixed;

