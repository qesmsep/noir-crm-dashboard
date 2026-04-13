import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/hooks/useToast';
import { formatDateTime, utcToLocalInput, localInputToUTC } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
import { Trash2, X } from 'lucide-react';

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
  locationSlug?: string;
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
  locationSlug,
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
      const url = locationSlug ? `/api/tables?location=${locationSlug}` : '/api/tables';
      const response = await fetch(url);
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
      toast({ title: 'Error', description: 'Failed to load reservation details', variant: 'error' });
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
      
      toast({ title: 'Success', description: 'Reservation updated successfully', variant: 'success' });
      onReservationUpdated();
      onClose();
    } catch (error: any) {
      console.error('Error in handleSave:', error);
      toast({ title: 'Error', description: `Failed to update reservation: ${error.message}`, variant: 'error' });
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
          variant: 'success',
        });
      }
      
      onReservationUpdated();
      
    } catch (error) {
      console.error('Error toggling check-in status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update check-in status',
        variant: 'error',
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
        variant: 'error',
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
        variant: 'error',
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirmingDelete) {
          handleClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#ECEDE8',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ borderBottom: '1px solid #D1D5DB', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isLoading ? (
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>Loading...</h2>
          ) : reservation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, paddingRight: '3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>
                  {formData.first_name} {formData.last_name}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: reservation.membership_type === 'member' ? '#353535' : '#D1D5DB',
                    color: reservation.membership_type === 'member' ? 'white' : '#1F1F1F',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}>
                    {reservation.membership_type === 'member' ? '🖤' : 'Guest'}
                  </span>
                  <button
                    onClick={handleCheckInToggle}
                    style={{
                      minHeight: '36px',
                      padding: '0 1rem',
                      backgroundColor: reservation.checked_in ? '#16A34A' : 'transparent',
                      color: reservation.checked_in ? 'white' : '#1F1F1F',
                      border: reservation.checked_in ? 'none' : '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (reservation.checked_in) {
                        e.currentTarget.style.backgroundColor = '#15803D';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (reservation.checked_in) {
                        e.currentTarget.style.backgroundColor = '#16A34A';
                      }
                    }}
                  >
                    {reservation.checked_in ? 'Checked In' : 'Check In'}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>
                Table {reservation.tables?.table_number || 'N/A'} | Party Size {formData.party_size} {eventIcon && `| ${eventIcon}`}
              </p>
            </div>
          ) : (
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>Edit Reservation</h2>
          )}
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B7280',
              transition: 'all 0.2s',
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
              e.currentTarget.style.color = '#1F1F1F';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6B7280';
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>Loading...</div>
            </div>
          ) : reservation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Contact Information */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="First Name"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                  }}
                />
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Last Name"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                  }}
                />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Email"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                  }}
                />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Phone"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Reservation Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <select
                  value={formData.party_size}
                  onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num} {num === 1 ? 'person' : 'people'}</option>
                  ))}
                </select>
                <select
                  value={formData.event_type}
                  onChange={(e) => handleInputChange('event_type', e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Event Type (Optional)</option>
                  {eventTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <select
                  value={formData.table_id}
                  onChange={(e) => handleInputChange('table_id', e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Table (Optional)</option>
                  {tables.map(table => (
                    <option key={table.id} value={table.id}>
                      Table {table.table_number} ({table.seats} seats)
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => handleInputChange('start_time', e.target.value)}
                  placeholder="Start Time"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                  }}
                />
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => handleInputChange('end_time', e.target.value)}
                  placeholder="End Time"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Notes */}
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Notes (Optional)"
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.75rem 1rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />

              {/* Send Message Section */}
              <div style={{ borderTop: '1px solid #D1D5DB', paddingTop: '1.25rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: '#1F1F1F' }}>Send Message</p>

                {messageError && (
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '10px',
                    marginBottom: '0.75rem',
                    fontSize: '0.875rem',
                    color: '#DC2626',
                  }}>
                    {messageError}
                  </div>
                )}

                {messageSuccess && (
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#D1FAE5',
                    border: '1px solid #6EE7B7',
                    borderRadius: '10px',
                    marginBottom: '0.75rem',
                    fontSize: '0.875rem',
                    color: '#059669',
                  }}>
                    {messageSuccess}
                  </div>
                )}

                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message here..."
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '0.75rem 1rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    marginBottom: '0.75rem',
                  }}
                />

                <button
                  onClick={handleSendMessage}
                  disabled={isSendingMessage || !messageText.trim() || !reservation?.phone}
                  style={{
                    height: '36px',
                    padding: '0 1rem',
                    backgroundColor: isSendingMessage || !messageText.trim() || !reservation?.phone ? '#D1D5DB' : '#353535',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: isSendingMessage || !messageText.trim() || !reservation?.phone ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSendingMessage && messageText.trim() && reservation?.phone) {
                      e.currentTarget.style.backgroundColor = '#2a2a2a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSendingMessage && messageText.trim() && reservation?.phone) {
                      e.currentTarget.style.backgroundColor = '#353535';
                    }
                  }}
                >
                  {isSendingMessage ? 'Sending...' : 'Send Message'}
                </button>
              </div>

              {/* System Info */}
              <div style={{
                backgroundColor: '#F9FAFB',
                padding: '0.75rem',
                borderRadius: '10px',
                border: '1px solid #E5E7EB',
              }}>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0, marginBottom: '0.5rem' }}>
                  Created {reservation.created_at ? formatDateTime(new Date(reservation.created_at), timezone, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                </p>
                <span style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#353535',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                }}>
                  {(reservation.source && reservation.source !== '') ? reservation.source : 'unknown'}
                </span>
              </div>
            </div>
          ) : (
            <p>Reservation not found</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #D1D5DB', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isConfirmingDelete ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <p style={{ fontWeight: '600', fontSize: '0.875rem', color: '#1F1F1F', margin: 0 }}>Are you sure?</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  style={{
                    height: '36px',
                    padding: '0 1rem',
                    backgroundColor: 'white',
                    color: '#1F1F1F',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  style={{
                    height: '36px',
                    padding: '0 1rem',
                    backgroundColor: isSaving ? '#D1D5DB' : '#DC2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSaving) e.currentTarget.style.backgroundColor = '#B91C1C';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSaving) e.currentTarget.style.backgroundColor = '#DC2626';
                  }}
                >
                  {isSaving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setIsConfirmingDelete(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                  e.currentTarget.style.color = '#B91C1C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#DC2626';
                }}
                aria-label="Delete reservation"
              >
                <Trash2 size={16} />
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleClose}
                  style={{
                    height: '36px',
                    padding: '0 1rem',
                    backgroundColor: 'white',
                    color: '#1F1F1F',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    height: '36px',
                    padding: '0 1rem',
                    backgroundColor: isSaving ? '#D1D5DB' : '#A59480',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSaving) e.currentTarget.style.backgroundColor = '#8C7C6D';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSaving) e.currentTarget.style.backgroundColor = '#A59480';
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
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

