"use client";

import React from 'react';
import { Phone, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PhoneDialPadProps {
  value: string;
  onChange: (value: string) => void;
  onCall: () => void;
  maxLength?: number;
  className?: string;
}

export function PhoneDialPad({
  value,
  onChange,
  onCall,
  maxLength = 10,
  className,
}: PhoneDialPadProps) {
  // Format phone number as (555) 123-4567
  const formatPhoneNumber = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return `(${cleaned}`;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  // Keyboard support - listen for number keys
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys (0-9)
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleNumberPress(e.key);
      }
      // Backspace
      else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
      // Enter key to call
      else if (e.key === 'Enter' && value.length === maxLength) {
        e.preventDefault();
        handleCall();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, maxLength]); // Re-attach when value or maxLength changes

  const handleNumberPress = (num: string) => {
    if (value.length >= maxLength) return;

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    onChange(value + num);
  };

  const handleBackspace = () => {
    if (value.length === 0) return;

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    onChange(value.slice(0, -1));
  };

  const handleCall = () => {
    if (value.length !== maxLength) return;

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }

    onCall();
  };

  const isCallReady = value.length === maxLength;

  const dialPadButtons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
  ];

  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-sm mx-auto", className)}>
      {/* Phone Number Display */}
      <div className="relative">
        <div className="bg-white border-2 border-[#ECEAE5] rounded-xl px-6 py-4 text-center">
          <div className="text-2xl font-semibold text-[#1F1F1F] tracking-wide min-h-[32px] flex items-center justify-center">
            {value.length > 0 ? formatPhoneNumber(value) : (
              <span className="text-[#8C7C6D] text-lg">Enter your phone number</span>
            )}
          </div>
        </div>
      </div>

      {/* Dial Pad Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Numbers 1-9 */}
        {dialPadButtons.map((num) => (
          <button
            key={num}
            onClick={() => handleNumberPress(num)}
            className={cn(
              "aspect-square min-h-[64px] rounded-2xl bg-white border border-[#ECEAE5]",
              "text-2xl font-semibold text-[#1F1F1F]",
              "transition-all duration-200 ease-out",
              "hover:bg-[#F7F6F2] hover:border-[#A59480] hover:-translate-y-0.5",
              "active:bg-[#A59480] active:text-white active:scale-95 active:translate-y-0",
              "focus:outline-none focus:ring-2 focus:ring-[#A59480] focus:ring-offset-2",
              "shadow-[0_1px_2px_rgba(165,148,128,0.08),0_4px_8px_rgba(165,148,128,0.12),0_8px_16px_rgba(165,148,128,0.08)]",
              "hover:shadow-[0_2px_4px_rgba(165,148,128,0.1),0_8px_16px_rgba(165,148,128,0.15),0_16px_32px_rgba(165,148,128,0.12)]",
              value.length >= maxLength && "opacity-50 cursor-not-allowed"
            )}
            disabled={value.length >= maxLength}
            type="button"
          >
            {num}
          </button>
        ))}

        {/* Backspace Button */}
        <button
          onClick={handleBackspace}
          className={cn(
            "aspect-square min-h-[64px] rounded-2xl bg-white border border-[#ECEAE5]",
            "flex items-center justify-center",
            "transition-all duration-200 ease-out",
            "hover:bg-[#F7F6F2] hover:border-[#A59480] hover:-translate-y-0.5",
            "active:bg-[#A59480] active:scale-95 active:translate-y-0",
            "focus:outline-none focus:ring-2 focus:ring-[#A59480] focus:ring-offset-2",
            "shadow-[0_1px_2px_rgba(165,148,128,0.08),0_4px_8px_rgba(165,148,128,0.12),0_8px_16px_rgba(165,148,128,0.08)]",
            "hover:shadow-[0_2px_4px_rgba(165,148,128,0.1),0_8px_16px_rgba(165,148,128,0.15),0_16px_32px_rgba(165,148,128,0.12)]",
            value.length === 0 && "opacity-50 cursor-not-allowed"
          )}
          disabled={value.length === 0}
          type="button"
        >
          <Delete className={cn(
            "w-6 h-6",
            value.length === 0 ? "text-[#8C7C6D]" : "text-[#1F1F1F]"
          )} />
        </button>

        {/* Number 0 */}
        <button
          onClick={() => handleNumberPress('0')}
          className={cn(
            "aspect-square min-h-[64px] rounded-2xl bg-white border border-[#ECEAE5]",
            "text-2xl font-semibold text-[#1F1F1F]",
            "transition-all duration-200 ease-out",
            "hover:bg-[#F7F6F2] hover:border-[#A59480] hover:-translate-y-0.5",
            "active:bg-[#A59480] active:text-white active:scale-95 active:translate-y-0",
            "focus:outline-none focus:ring-2 focus:ring-[#A59480] focus:ring-offset-2",
            "shadow-[0_1px_2px_rgba(165,148,128,0.08),0_4px_8px_rgba(165,148,128,0.12),0_8px_16px_rgba(165,148,128,0.08)]",
            "hover:shadow-[0_2px_4px_rgba(165,148,128,0.1),0_8px_16px_rgba(165,148,128,0.15),0_16px_32px_rgba(165,148,128,0.12)]",
            value.length >= maxLength && "opacity-50 cursor-not-allowed"
          )}
          disabled={value.length >= maxLength}
          type="button"
        >
          0
        </button>

        {/* Call Button */}
        <button
          onClick={handleCall}
          className={cn(
            "aspect-square min-h-[64px] rounded-2xl",
            "flex items-center justify-center",
            "transition-all duration-200 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-[#A59480] focus:ring-offset-2",
            isCallReady ? [
              "bg-[#A59480] border border-[#A59480] text-white",
              "hover:bg-[#8C7C6D] hover:border-[#8C7C6D] hover:-translate-y-0.5",
              "active:scale-95 active:translate-y-0",
              "shadow-[0_1px_2px_rgba(165,148,128,0.15),0_4px_8px_rgba(165,148,128,0.25),0_8px_16px_rgba(165,148,128,0.18)]",
              "hover:shadow-[0_2px_4px_rgba(165,148,128,0.2),0_8px_16px_rgba(165,148,128,0.3),0_16px_32px_rgba(165,148,128,0.25)]",
              "animate-pulse-subtle"
            ] : [
              "bg-white border border-[#ECEAE5] text-[#8C7C6D]",
              "opacity-50 cursor-not-allowed",
              "shadow-[0_1px_2px_rgba(165,148,128,0.08),0_4px_8px_rgba(165,148,128,0.12),0_8px_16px_rgba(165,148,128,0.08)]"
            ]
          )}
          disabled={!isCallReady}
          type="button"
        >
          <Phone className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
