import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDateTime, utcToLocalInput, localInputToUTC } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
import { Trash2 } from 'lucide-react';

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

interface ReservationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string | null;
  onReservationUpdated: () => void;
}

/**
 * ReservationEditModal - Centered popup modal for editing reservations
 * Uses portal to document.body to avoid z-index issues
 */
const ReservationEditModal: React.FC<ReservationEditModalProps> = ({
  isOpen,
  onClose,
  reservationId,
  onReservationUpdated,
}) => {
  const [reservation, setReservation] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [messageSuccess, setMessageSuccess] = useState('');
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';

  useEffect(() => {
    setMounted(true);
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }
    
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConfirmingDelete) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, isConfirmingDelete]);

  useEffect(() => {
    if (isOpen && reservationId) {
      fetchReservation();
      fetchTables();
    }
  }, [isOpen, reservationId]);

  const fetchTables = async () => {
    try {
      const response = await fetch('/api/tables');
      if (response.ok) {
        const result = await response.json();
        setTables(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const fetchReservation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reservation');
      }
      
      const data = await response.json();
      setReservation(data);
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        party_size: data.party_size || 2,
        event_type: data.event_type || '',
        notes: data.notes || '',
        table_id: data.table_id || '',
        start_time: data.start_time ? utcToLocalInput(data.start_time, timezone) : '',
        end_time: data.end_time ? utcToLocalInput(data.end_time, timezone) : '',
      });
    } catch (error) {
      console.error('Error in fetchReservation:', error);
      toast({ title: 'Error', description: 'Failed to load reservation details', status: 'error', duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const startTimeUTC = formData.start_time ? localInputToUTC(formData.start_time, timezone) : undefined;
      const endTimeUTC = formData.end_time ? localInputToUTC(formData.end_time, timezone) : undefined;
      const cleanedPhone = formData.phone ? formData.phone.replace(/\D/g, '') : formData.phone;
      const tableId = formData.table_id === '' ? null : formData.table_id;
      
      const updateData: any = {
        ...formData,
        phone: cleanedPhone,
        table_id: tableId,
      };
      
      if (startTimeUTC) updateData.start_time = startTimeUTC;
      if (endTimeUTC) updateData.end_time = endTimeUTC;
      
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update reservation`);
      }
      
      toast({ title: 'Success', description: 'Reservation updated successfully', status: 'success', duration: 3000 });
      onReservationUpdated();
      onClose();
    } catch (error: any) {
      console.error('Error in handleSave:', error);
      toast({ title: 'Error', description: `Failed to update reservation: ${error.message}`, status: 'error', duration: 5000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckInToggle = async () => {
    if (!reservation) return;
    
    setIsSaving(true);
    try {
      const newCheckedInStatus = !reservation.checked_in;
      
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked_in: newCheckedInStatus }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update check-in status');
      }
      
      setReservation((prev: any) => ({
        ...prev,
        checked_in: newCheckedInStatus,
        checked_in_at: newCheckedInStatus ? new Date().toISOString() : null
      }));
      
      if (newCheckedInStatus && reservation.payment_intent_id && reservation.hold_status === 'confirmed') {
        try {
          const holdResponse = await fetch('/api/release-holds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservation_id: reservationId }),
          });
          
          if (holdResponse.ok) {
            setReservation((prev: any) => ({
              ...prev,
              hold_status: 'released',
              hold_released_at: new Date().toISOString()
            }));
            
            toast({
              title: 'Success',
              description: 'Reservation checked in and credit card hold released',
              status: 'success',
              duration: 3000,
            });
          } else {
            toast({
              title: 'Warning',
              description: 'Reservation checked in but failed to release credit card hold. Please release manually.',
              status: 'warning',
              duration: 5000,
            });
          }
        } catch (holdError) {
          console.error('Error releasing hold:', holdError);
          toast({
            title: 'Warning',
            description: 'Reservation checked in but failed to release credit card hold. Please release manually.',
            status: 'warning',
            duration: 5000,
          });
        }
      } else {
        toast({
          title: 'Success',
          description: newCheckedInStatus ? 'Reservation checked in successfully' : 'Check-in status removed',
          status: 'success',
          duration: 3000,
        });
      }
      
      onReservationUpdated();
      
    } catch (error) {
      console.error('Error toggling check-in status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update check-in status',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete reservation');
      }
      toast({
        title: 'Success',
        description: 'Reservation deleted successfully',
        status: 'success',
        duration: 3000,
      });
      onReservationUpdated();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete reservation',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
      setIsConfirmingDelete(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      setMessageError('Please enter a message');
      return;
    }

    if (!reservation?.phone) {
      setMessageError('No phone number available for this reservation');
      return;
    }

    setIsSendingMessage(true);
    setMessageError('');
    setMessageSuccess('');

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Failed to get user session');
      }

      const userEmail = session?.user?.email;
      if (!userEmail) {
        throw new Error('User email not found in session');
      }

      if (reservation.membership_type === 'member') {
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('member_id, account_id')
          .eq('phone', reservation.phone)
          .single();

        if (memberError || !member) {
          throw new Error('Member not found for this reservation');
        }

        const res = await fetch('/api/sendText', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-email': userEmail
          },
          body: JSON.stringify({
            member_ids: [String(member.member_id)],
            content: messageText,
            account_id: member.account_id
          })
        });

        const result = await res.json();

        if (res.ok && result.results && result.results.every((r: any) => r.status === 'sent')) {
          setMessageSuccess('Message sent successfully!');
          setMessageText('');
          toast({
            title: 'Success',
            description: 'Message sent successfully!',
            status: 'success',
            duration: 3000,
          });
        } else {
          throw new Error(result.results?.[0]?.error || 'Failed to send message');
        }
      } else {
        const res = await fetch('/api/sendGuestMessage', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: reservation.phone,
            content: messageText,
            reservation_id: reservationId,
            sent_by: userEmail
          })
        });

        const result = await res.json();

        if (res.ok && result.success) {
          setMessageSuccess('Message sent successfully!');
          setMessageText('');
          toast({
            title: 'Success',
            description: 'Message sent successfully!',
            status: 'success',
            duration: 3000,
          });
        } else {
          throw new Error(result.error || result.details || 'Failed to send message');
        }
      }
    } catch (err: any) {
      setMessageError(err.message);
      toast({
        title: 'Error',
        description: err.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleClose = useCallback(() => {
    document.body.style.overflow = '';
    setMessageText('');
    setMessageError('');
    setMessageSuccess('');
    setIsConfirmingDelete(false);
    onClose();
  }, [onClose]);

  if (!mounted || !isOpen || !reservationId) return null;

  const eventIcon = eventTypes.find(e => e.value === formData.event_type)?.label.split(' ')[0];

  const portalContent = (
    <div
      className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center pointer-events-none"
      style={{ zIndex: 99999999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirmingDelete) {
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
        className="relative pointer-events-auto max-w-[600px] w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{
          zIndex: 99999999,
          backgroundColor: '#ecede8',
          borderRadius: '10px',
          border: '2px solid #353535',
          fontFamily: 'Montserrat, sans-serif'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b p-4 pb-2 pt-3 relative" style={{ fontFamily: 'IvyJournal, sans-serif' }}>
          {isLoading ? (
            <h2 className="text-xl font-bold" style={{ color: '#353535' }}>Loading...</h2>
          ) : reservation ? (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center w-full">
                <h2 className="text-xl font-bold" style={{ color: '#353535' }}>
                  {formData.first_name} {formData.last_name}
                </h2>
                <div className="flex gap-2 items-center">
                  <Badge variant={reservation.membership_type === 'member' ? 'default' : 'secondary'}>
                    {reservation.membership_type === 'member' ? '🖤' : 'Guest'}
                  </Badge>
                  <Button
                    size="sm"
                    variant={reservation.checked_in ? 'default' : 'outline'}
                    onClick={handleCheckInToggle}
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                    className={reservation.checked_in ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    {reservation.checked_in ? 'Checked In' : 'Check In'}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Table {reservation.tables?.table_number || 'N/A'} | Party Size {formData.party_size} {eventIcon && `| ${eventIcon}`}
              </p>
            </div>
          ) : (
            <h2 className="text-xl font-bold" style={{ color: '#353535' }}>Edit Reservation</h2>
          )}
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
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 160px)' }}>
          {isLoading ? (
            <div className="flex justify-center items-center h-[200px]">
              <Spinner size="lg" />
            </div>
          ) : reservation ? (
            <div className="flex flex-col gap-4">
              {/* Contact Information */}
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-0.5 block">First Name</label>
                    <Input
                      className="h-8"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-0.5 block">Last Name</label>
                    <Input
                      className="h-8"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-0.5 block">Email</label>
                    <Input
                      className="h-8"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-0.5 block">Phone</label>
                    <Input
                      className="h-8"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Reservation Details */}
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-0.5 block">Party Size</label>
                    <select
                      className="h-8 w-full rounded-lg border border-gray-300 px-3 text-sm"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                      value={formData.party_size}
                      onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))}
                    >
                      {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>{num} {num === 1 ? 'person' : 'people'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-0.5 block">Event Type</label>
                    <select
                      className="h-8 w-full rounded-lg border border-gray-300 px-3 text-sm"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                      value={formData.event_type}
                      onChange={(e) => handleInputChange('event_type', e.target.value)}
                    >
                      <option value="">Select an occasion</option>
                      {eventTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-0.5 block">Table</label>
                    <select
                      className="h-8 w-full rounded-lg border border-gray-300 px-3 text-sm"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                      value={formData.table_id}
                      onChange={(e) => handleInputChange('table_id', e.target.value)}
                    >
                      <option value="">Select a table</option>
                      {tables.map(table => (
                        <option key={table.id} value={table.id}>
                          Table {table.table_number} ({table.seats} seats)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-0.5 block">Start Time</label>
                    <Input
                      className="h-8"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => handleInputChange('start_time', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-0.5 block">End Time</label>
                    <Input
                      className="h-8"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => handleInputChange('end_time', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-0.5 block">Notes</label>
                <Textarea
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Special requests..."
                  rows={3}
                  className="text-sm"
                />
              </div>

              {/* Send Message Section */}
              <div>
                <p className="text-sm font-bold mb-2">Send Message</p>

                {messageError && (
                  <Alert variant="error" className="text-sm rounded-md mb-2">
                    <AlertDescription>{messageError}</AlertDescription>
                  </Alert>
                )}

                {messageSuccess && (
                  <Alert variant="success" className="text-sm rounded-md mb-2">
                    <AlertDescription>{messageSuccess}</AlertDescription>
                  </Alert>
                )}

                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message here..."
                  rows={3}
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                  className="mb-2 text-sm"
                />

                <Button
                  onClick={handleSendMessage}
                  disabled={isSendingMessage || !messageText.trim() || !reservation?.phone}
                  size="sm"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    backgroundColor: '#353535',
                    color: '#ecede8'
                  }}
                  className="hover:bg-[#2a2a2a]"
                >
                  {isSendingMessage ? 'Sending...' : 'Send Message'}
                </Button>
              </div>

              {/* System Info */}
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <p className="text-xs text-gray-600">
                  Created {reservation.created_at ? formatDateTime(new Date(reservation.created_at), timezone, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                </p>
                <Badge variant="default" style={{ fontFamily: 'Montserrat, sans-serif' }} className="mt-1">
                  {(reservation.source && reservation.source !== '') ? reservation.source : 'unknown'}
                </Badge>
              </div>
            </div>
          ) : (
            <p>Reservation not found</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex justify-between items-center">
          {isConfirmingDelete ? (
            <div className="flex justify-between items-center w-full">
              <p className="font-bold">Are you sure?</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsConfirmingDelete(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isSaving ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConfirmingDelete(true)}
                className="text-red-600 hover:text-red-700"
                aria-label="Delete reservation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(portalContent, document.body)
    : null;
};

export default ReservationEditModal;

