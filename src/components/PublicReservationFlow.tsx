'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
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
  const [step, setStep] = useState<'phone' | 'reservation'>('phone');
  const [phone, setPhone] = useState('');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [memberData, setMemberData] = useState<any>(null);

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
        setTimeout(() => {
          window.location.href = '/member/login';
        }, 2000);
      } else {
        // Not a member - proceed to reservation form
        setStep('reservation');
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
    setMemberData(null);
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
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>
              Make a Reservation
            </h2>
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

  // Step 2: Reservation form (non-members only)
  return (
    <SimpleReservationRequestModal
      isOpen={true}
      onClose={handleClose}
      memberPhone={phone}
      locationSlug={locationSlug}
      hideTableSelection={true}
      onReservationCreated={() => {
        if (onReservationCreated) {
          onReservationCreated();
        }
        handleClose();
      }}
    />
  );
}
