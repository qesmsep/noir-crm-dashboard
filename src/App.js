import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { v4 as uuidv4 } from 'uuid';
import MemberDetail from './MemberDetail';
import CalendarView from './components/CalendarView';
import ReservationForm from './components/ReservationForm';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import FullCalendarTimeline from './components/FullCalendarTimeline';
import CalendarAvailabilityControl from './components/CalendarAvailabilityControl';
import { toCST, toCSTISOString, createDateFromTimeString } from './utils/dateUtils';
import PrivateEventBooking from './components/PrivateEventBooking';
import { Routes, Route, useParams } from 'react-router-dom';

// Responsive helper
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 700);
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 700);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
}

// Formatting helpers
function formatPhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  return phone;
}
function formatDOB(dob) {
  if (!dob) return "";
  // Parse as UTC date if in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const [year, month, day] = dob.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  const d = new Date(dob);
  if (isNaN(d)) return dob;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function PrivateEventBookingWrapper() {
  const { id } = useParams();
  return <PrivateEventBooking eventId={id} />;
}

function MainAppLayout(props) {
  // The full main app UI (sidebar, layout, and all section logic) from the previous if (session) { return (...) } block
  // Paste the full JSX content here
  return (
    <>
      {/* Transaction Modal */}
      {showTransactionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            minWidth: '300px',
            maxWidth: '90%',
            textAlign: 'center',
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#333' }}>Transaction Status</h3>
            <p style={{ marginBottom: '2rem', color: '#666' }}>{transactionModalMessage}</p>
            <button
              onClick={() => {
                setShowTransactionModal(false);
                if (selectedMember?.account_id) {
                  fetchLedger(selectedMember.account_id);
                }
              }}
              style={{
                background: '#a59480',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
      {/* ...rest of the main app UI (sidebar, layout, and all section logic) goes here... */}
    </>
  );
}

function App() {
  // ...all your state and handlers...

  if (!session) {
    return (
      <div className="auth-container">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          theme="dark"
          magicLink={true}
          view="magic_link"
        />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/private-event/:id" element={<PrivateEventBookingWrapper />} />
      <Route path="*" element={<MainAppLayout />} />
    </Routes>
  );
}

export default App;