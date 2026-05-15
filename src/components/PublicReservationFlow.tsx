'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

  // Bypass code state
  const [bypassCode, setBypassCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeValidated, setCodeValidated] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [validatedCodeId, setValidatedCodeId] = useState<string | null>(null);
  const [validationId, setValidationId] = useState<string | null>(null); // For idempotency

  // Constants
  const MEMBERSHIP_PHONE = '9137774488';
  const MEMBERSHIP_SMS_BODY = 'MEMBERSHIP';

  const handleClose = useCallback(() => {
    setStep('phone');
    setPhone('');
    setBypassCode('');
    setCodeValidated(false);
    setCodeError(null);
    setValidatedCodeId(null);
    setValidationId(null);
    onClose();
  }, [onClose]);

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
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleClose]);

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
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 0) {
      toast({
        title: 'Phone Required',
        description: 'Please enter your phone number',
        variant: 'error',
      });
      return;
    }

    if (digits.length !== 10) {
      toast({
        title: 'Invalid Phone',
        description: 'Please enter a valid 10-digit phone number',
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


  const validateBypassCode = async () => {
    if (!bypassCode.trim()) {
      setCodeError('Please enter a code');
      return;
    }

    setIsValidatingCode(true);
    setCodeError(null);

    try {
      const response = await fetch(`/api/locations/${locationSlug}/validate-bypass-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: bypassCode.trim(),
          partySize: 1, // We don't know party size yet, but it's mainly for logging
        }),
      });

      const data = await response.json();

      if (data.isValid) {
        setCodeValidated(true);
        setValidatedCodeId(data.bypassCodeId);
        setValidationId(data.validationId); // Store for idempotency
        toast({
          title: 'Code validated!',
          description: 'Reservation fee has been waived.',
          variant: 'default',
        });
      } else {
        setCodeError(data.message || 'Invalid code');
        setCodeValidated(false);
        setValidatedCodeId(null);
        setValidationId(null);
      }
    } catch (error) {
      console.error('Error validating bypass code:', error);
      setCodeError('Failed to validate code. Please try again.');
      setCodeValidated(false);
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleProceedToReservation = async () => {
    // If code is entered but not validated, validate it first
    if (bypassCode.trim() && !codeValidated && !isValidatingCode) {
      await validateBypassCode();
    }
    setStep('reservation');
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
              onKeyDown={(e) => {
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
                Non-refundable unless cancelled by {locationName}
              </p>

              <button
                onClick={handleProceedToReservation}
                style={{
                  width: '100%',
                  height: '44px',
                  backgroundColor: codeValidated ? '#10B981' : '#A59480',
                  color: 'white',
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: codeValidated ? '0 2px 8px rgba(16, 185, 129, 0.2)' : '0 2px 8px rgba(165, 148, 128, 0.2)',
                  transition: 'all 0.2s',
                  marginBottom: '1rem',
                }}
              >
                {codeValidated ? 'Continue (No Fee)' : 'Continue with Reservation'}
              </button>

              {/* Bypass Code Section */}
              <div style={{
                padding: '1rem',
                backgroundColor: '#F9FAFB',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
              }}>
                <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 0.75rem 0', textAlign: 'center' }}>
                  Have an access code?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    value={bypassCode}
                    onChange={(e) => {
                      setBypassCode(e.target.value.toUpperCase());
                      setCodeError(null);
                      setCodeValidated(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        validateBypassCode();
                      }
                    }}
                    placeholder="Enter code here"
                    disabled={isValidatingCode}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 0.75rem',
                      border: codeError ? '1px solid #DC2626' : (codeValidated ? '1px solid #10B981' : '1px solid #D1D5DB'),
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: isValidatingCode ? '#F3F4F6' : 'white',
                      outline: 'none',
                      fontFamily: 'monospace',
                      letterSpacing: '0.05em',
                      cursor: isValidatingCode ? 'not-allowed' : 'text',
                    }}
                  />
                  <button
                    onClick={validateBypassCode}
                    disabled={isValidatingCode || !bypassCode.trim()}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 1rem',
                      backgroundColor: isValidatingCode ? '#D1D5DB' : '#A59480',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: isValidatingCode || !bypassCode.trim() ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    {isValidatingCode ? 'Checking...' : 'Validate'}
                  </button>
                </div>
                {codeError && (
                  <p style={{ fontSize: '0.75rem', color: '#DC2626', margin: '0.25rem 0 0 0' }}>
                    {codeError}
                  </p>
                )}
                {codeValidated && (
                  <p style={{ fontSize: '0.75rem', color: '#10B981', margin: '0.25rem 0 0 0', fontWeight: '600' }}>
                    ✓ Code valid! Reservation fee waived.
                  </p>
                )}
              </div>
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
      bypassCodeValidated={codeValidated}
      bypassCodeId={validatedCodeId}
      bypassCodeUsed={codeValidated ? bypassCode : null}
      validationId={validationId}
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
