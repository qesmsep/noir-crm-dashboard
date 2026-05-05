'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';
import SimpleReservationRequestModal from './member/SimpleReservationRequestModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  locationSlug: string;
  onReservationCreated?: () => void;
}

export default function PublicReservationFlow({
  isOpen,
  onClose,
  locationSlug,
  onReservationCreated,
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<'phone' | 'fee-notice' | 'reservation'>('phone');
  const [phone, setPhone] = useState('');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [locationName, setLocationName] = useState<string>(locationSlug);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Constants
  const MEMBERSHIP_PHONE = '9137774488';
  const MEMBERSHIP_SMS_BODY = 'MEMBERSHIP';

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setStep('phone');
        setPhone('');
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Fetch location display name
  useEffect(() => {
    const fetchLocationName = async () => {
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('name')
          .eq('slug', locationSlug)
          .single();

        if (data && !error) {
          setLocationName(data.name);
        } else if (error) {
          console.error('Error fetching location name:', error);
          // Keep using slug as fallback
        }
      } catch (error) {
        console.error('Error fetching location name:', error);
        // Keep using slug as fallback
      }
    };

    if (isOpen && locationSlug) {
      fetchLocationName();
    }
  }, [isOpen, locationSlug]);

  // Format phone number as (XXX)XXX-XXXX
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)})${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handlePhoneSubmit = async () => {
    if (!phone.trim()) {
      toast({
        title: 'Phone Required',
        description: 'Please enter your phone number',
        variant: 'error',
      });
      return;
    }

    setIsCheckingPhone(true);

    try {
      const response = await fetch(`/api/members?phone=${encodeURIComponent(phone)}`);
      const data = await response.json();

      if (response.ok && data.members && data.members.length > 0) {
        // Member found - redirect to member portal login
        const member = data.members[0];
        toast({
          title: `Welcome back, ${member.first_name}!`,
          description: 'Please log in to your member portal to make a reservation.',
          variant: 'default',
        });

        // Redirect to member login after a short delay
        redirectTimeoutRef.current = setTimeout(() => {
          window.location.href = '/member/login';
        }, 2000);
      } else {
        // Not a member - show fee notice first
        setStep('fee-notice');
      }
    } catch (error) {
      console.error('Error checking phone:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify phone number. Please try again.',
        variant: 'error',
      });
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handleClose = () => {
    setStep('phone');
    setPhone('');
    onClose();
  };

  if (!isOpen) return null;

  // Step 1: Phone number input
  if (step === 'phone') {
    return (
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
        onClick={handleClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="phone-modal-title"
          style={{
            backgroundColor: '#ECEDE8',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
            maxWidth: '500px',
            width: '100%',
            padding: '2rem',
            position: 'relative',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 id="phone-modal-title" style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>
              Make a Reservation for {locationName}
            </h2>
            <button
              onClick={handleClose}
              aria-label="Close reservation modal"
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
              }}
            >
              <X size={24} />
            </button>
          </div>

          {/* Phone input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>
              Enter your phone number to get started
            </p>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePhoneSubmit();
                }
              }}
              placeholder="(555)555-5555"
              maxLength={13}
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

            {/* SMS Agreement */}
            <div style={{
              fontSize: '0.8125rem',
              color: '#6B7280',
              textAlign: 'center',
              lineHeight: '1.5',
              marginTop: '0.5rem',
            }}>
              By requesting this reservation, you agree to receive SMS messages regarding your reservation. Message and data rates may apply. We are not responsible for carrier charges or delivery failures. You can opt out at any time.
            </div>

            <button
              onClick={handlePhoneSubmit}
              disabled={isCheckingPhone}
              style={{
                width: '100%',
                height: '48px',
                backgroundColor: isCheckingPhone ? '#D1D5DB' : '#A59480',
                color: 'white',
                fontSize: '1rem',
                fontWeight: '600',
                borderRadius: '10px',
                border: 'none',
                cursor: isCheckingPhone ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(165, 148, 128, 0.2)',
                transition: 'background-color 0.2s',
              }}
            >
              {isCheckingPhone ? 'Checking...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Fee notice
  if (step === 'fee-notice') {
    return (
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
        onClick={handleClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fee-modal-title"
          style={{
            backgroundColor: '#ECEDE8',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
            maxWidth: '500px',
            width: '100%',
            padding: '2rem',
            position: 'relative',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 id="fee-modal-title" style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>
              Reservation Fee
            </h2>
            <button
              onClick={handleClose}
              aria-label="Close reservation fee modal"
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
              }}
            >
              <X size={24} />
            </button>
          </div>

          {/* Fee Notice */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Reservation Fee Section */}
            <div style={{
              backgroundColor: 'white',
              padding: '1.25rem',
              borderRadius: '10px',
              border: '1px solid #D1D5DB',
            }}>
              <p style={{ fontSize: '0.9375rem', color: '#1F2937', fontWeight: '600', margin: '0 0 0.5rem 0', lineHeight: '1.5', textAlign: 'center' }}>
                $20/person Reservation Fee
              </p>
              <p style={{ fontSize: '0.875rem', color: '#4B5563', margin: '0 0 0.5rem 0', lineHeight: '1.5', textAlign: 'center' }}>
                (includes first drink)
              </p>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0 0 1rem 0', lineHeight: '1.4', textAlign: 'center' }}>
                Non-refundable unless cancelled by RooftopKC
              </p>
              <button
                onClick={() => setStep('reservation')}
                style={{
                  width: '100%',
                  height: '44px',
                  backgroundColor: '#A59480',
                  color: 'white',
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(165, 148, 128, 0.2)',
                  transition: 'background-color 0.2s',
                }}
              >
                Continue with Reservation
              </button>
            </div>

            {/* Membership Benefits Section */}
            <div style={{
              backgroundColor: '#F9FAFB',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
            }}>
              <p style={{ fontSize: '0.9375rem', color: '#1F2937', fontWeight: '600', margin: '0 0 0.5rem 0', textAlign: 'center' }}>
                Request Invitation to Noir
              </p>
              <p style={{ fontSize: '0.875rem', color: '#4B5563', margin: '0 0 1rem 0', lineHeight: '1.5', textAlign: 'center' }}>
                No reservation fee + exclusive benefits
              </p>
              <button
                onClick={() => {
                  window.location.href = `sms:${MEMBERSHIP_PHONE}?body=${encodeURIComponent(MEMBERSHIP_SMS_BODY)}`;
                }}
                style={{
                  width: '100%',
                  height: '44px',
                  backgroundColor: 'white',
                  color: '#A59480',
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: '2px solid #A59480',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Request Membership
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Reservation form (non-members only)
  return (
    <SimpleReservationRequestModal
      isOpen={true}
      onClose={handleClose}
      memberPhone={phone}
      locationSlug={locationSlug}
      hideTableSelection={true}
      onBack={() => setStep('fee-notice')}
      onReservationCreated={() => {
        if (onReservationCreated) {
          onReservationCreated();
        }
        handleClose();
      }}
    />
  );
}
