'use client';

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function TestReservationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [partySize, setPartySize] = useState(2);
  const [time, setTime] = useState('18:00');
  const [phone, setPhone] = useState('');

  if (!isOpen) {
    return (
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 99999 }}>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: '#A59480',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          TEST RESERVATION
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          background: 'white',
          padding: '32px',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>
          Test Reservation
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Party Size
          </label>
          <select
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '16px',
            }}
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
              <option key={size} value={size}>
                {size} people
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Date
          </label>
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="MMMM d, yyyy"
            minDate={new Date()}
            customInput={
              <input
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                }}
              />
            }
            popperPlacement="bottom-start"
            wrapperClassName="test-datepicker-wrapper"
            popperClassName="test-datepicker-popper"
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Time
          </label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '16px',
            }}
          >
            {['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '16px',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              flex: 1,
              padding: '12px',
              background: '#f5f5f5',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              alert(`Reservation: ${partySize} people on ${selectedDate?.toLocaleDateString()} at ${time}`);
              setIsOpen(false);
            }}
            style={{
              flex: 1,
              padding: '12px',
              background: '#A59480',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Make Reservation
          </button>
        </div>
      </div>
    </div>
  );
}
