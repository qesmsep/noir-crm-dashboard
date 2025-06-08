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
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import FullCalendarTimeline from './components/FullCalendarTimeline';
import CalendarAvailabilityControl from './components/CalendarAvailabilityControl';
import { toCST, toCSTISOString, createDateFromTimeString } from './utils/dateUtils';
import PrivateEventBooking from './components/PrivateEventBooking';
import TotalMembersCard from './components/dashboard/TotalMembersCard';
import MonthlyRevenueCard from './components/dashboard/MonthlyRevenueCard';
import UpcomingPaymentsCard from './components/dashboard/UpcomingPaymentsCard';
import TotalBalanceCard from './components/dashboard/TotalBalanceCard';
import DashboardPage from './components/pages/DashboardPage';
import MembersPage from './components/pages/MembersPage';
import AdminPage from './components/pages/AdminPage';
import CalendarPage from './components/pages/CalendarPage';
import CreditCardHoldModal from './components/CreditCardHoldModal';

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
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseKey);
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function App() {
  // Restore the full original App component logic here, removing the forced debug UI.
  return (
    <div style={{ padding: 40 }}>
      <h2>DEBUG ENV</h2>
      <div>REACT_APP_SUPABASE_URL: {String(process.env.REACT_APP_SUPABASE_URL)}</div>
      <div>REACT_APP_SUPABASE_ANON_KEY: {String(process.env.REACT_APP_SUPABASE_ANON_KEY)}</div>
      <div>REACT_APP_STRIPE_PUBLISHABLE_KEY: {String(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)}</div>
    </div>
  );
}

export default App;