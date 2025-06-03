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
import Dashboard from './components/Dashboard';

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

function App() {
  // Reservation form extra state for calendar section
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteStatus, setPromoteStatus] = useState('');
  const [section, setSection] = useState('dashboard');
  const [reminderHour, setReminderHour] = useState('');
  const [customEmailTo, setCustomEmailTo] = useState('tim@828.life');
  const [customEmailSubject, setCustomEmailSubject] = useState('');
  const [customEmailBody, setCustomEmailBody] = useState('');
  const [lookupQuery, setLookupQuery] = useState('');
  // Sidebar state for mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Create User form state
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createStatus, setCreateStatus] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'view'
  });
  // User management state for Admin tab
  const [users, setUsers] = useState([]);
  const [editUserId, setEditUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "view"
  });
  // Member editing state
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dob: "",
    membership: "",
    balance: "",
    photo: "",
    first_name2: "",
    last_name2: "",
    email2: "",
    phone2: "",
    company2: "",
    photo2: ""
  });
  // Ledger modal state
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberLedger, setMemberLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ type: 'payment', amount: '', note: '' });
  const [transactionStatus, setTransactionStatus] = useState('');
  const isMobile = useIsMobile();
  // Calendar modal state
  const [slotInfo, setSlotInfo] = useState(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [partySize, setPartySize] = useState(1);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState('18:00');
  const [phone, setPhone] = useState('');
  const [membershipNumber, setMembershipNumber] = useState('');
  const [nonMemberFields, setNonMemberFields] = useState({ firstName: '', lastName: '', email: '' });
  const [memberLookup, setMemberLookup] = useState(null);
  const [reserveStatus, setReserveStatus] = useState('');
  const [showNonMemberModal, setShowNonMemberModal] = useState(false);
  const [eventType, setEventType] = useState('');
  const [nextAvailableTime, setNextAvailableTime] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionModalMessage, setTransactionModalMessage] = useState('');
  const [selectedTransactionMemberId, setSelectedTransactionMemberId] = useState('');
  const [charging, setCharging] = useState(false);
  const [chargeStatus, setChargeStatus] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editTransactionForm, setEditTransactionForm] = useState({
    note: '',
    amount: '',
    type: '',
    date: ''
  });
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    dob: '',
    membership: '',
    photo: ''
  });
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingReservation, setPendingReservation] = useState(null);
  const [baseHours, setBaseHours] = useState([]);
  const [exceptionalOpens, setExceptionalOpens] = useState([]);
  const [exceptionalClosures, setExceptionalClosures] = useState([]);
  const [bookingStartDate, setBookingStartDate] = useState(null);
  const [bookingEndDate, setBookingEndDate] = useState(null);
  const [privateEvents, setPrivateEvents] = useState([]);

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

  // Generate times array for 6:00pm to midnight, every 15 min
  const times = [];
  for (let h = 18; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      times.push(`${hh}:${mm}`);
    }
  }

  // Fetch ledger for a member using API route
  async function fetchLedger(accountId) {
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/ledger?account_id=${encodeURIComponent(accountId)}`);
      const result = await res.json();
      setLedgerLoading(false);
      if (res.ok && result.data) {
        setMemberLedger(result.data || []);
        return result.data || [];
      } else {
        setMemberLedger([]);
        return [];
      }
    } catch (err) {
      setLedgerLoading(false);
      setMemberLedger([]);
      return [];
    }
  }

  // Add new transaction to ledger via API route
  async function handleAddTransaction(memberId, accountId) {
    setTransactionStatus('');
    if (!newTransaction.amount || isNaN(Number(newTransaction.amount))) {
      setTransactionStatus('Enter a valid amount.');
      return;
    }
    setLedgerLoading(true);
    try {
      let amt = Number(newTransaction.amount);
      if (newTransaction.type === 'purchase') amt = -Math.abs(amt);
      else amt = Math.abs(amt);
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          account_id: accountId,
          type: newTransaction.type,
          amount: amt,
          note: newTransaction.note,
          date: newTransaction.date ? newTransaction.date : undefined
        })
      });
      const result = await res.json();
      if (res.ok && result.data) {
        setTransactionStatus('Transaction added!');
        setMemberLedger(prev => [...prev, result.data]);
        setNewTransaction({ type: 'payment', amount: '', note: '' });
        setSelectedTransactionMemberId('');
        // Recompute balance from the optimistically updated ledger
        const balance = [...memberLedger, result.data].reduce(
          (acc, t) => acc + Number(t.amount),
          0
        );
        setMembers(ms => ms.map(m => m.member_id === memberId ? { ...m, balance } : m));
        // Show modal with success message
        setTransactionModalMessage('Transaction added successfully!');
        setShowTransactionModal(true);
      } else {
        setTransactionStatus('Failed: ' + (result.error || 'Unknown error'));
        setTransactionModalMessage('Failed to add transaction: ' + (result.error || 'Unknown error'));
        setShowTransactionModal(true);
      }
    } catch (err) {
      setTransactionStatus('Failed: ' + err.message);
      setTransactionModalMessage('Failed to add transaction: ' + err.message);
      setShowTransactionModal(true);
    }
    setLedgerLoading(false);
  }
  useEffect(() => {
    async function fetchUsers() {
      if (section === "admin") {
        const res = await fetch('/api/listUsers');
        const data = await res.json();
        setUsers(data.users || []);
        // Fetch reminder setting
        fetch('/api/reminderSettings')
          .then(res => res.json())
          .then(d => setReminderHour(d.hour));
      }
    }
    fetchUsers();
  }, [section]);

  function handleEditUser(user) {
    setEditUserId(user.id);
    setEditForm({
      first_name: user.user_metadata?.first_name || "",
      last_name: user.user_metadata?.last_name || "",
      email: user.email,
      phone: user.user_metadata?.phone || "",
      role: user.user_metadata?.role || "view"
    });
  }

  function handleCancelEdit() {
    setEditUserId(null);
    setEditForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      role: "view"
    });
  }

  async function handleSaveUser(userId) {
    // Call your API to update user
    const res = await fetch('/api/updateUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, ...editForm })
    });
    const result = await res.json();
    if (result.success) {
      // Refresh user list
      const newUsers = users.map(u =>
        u.id === userId
          ? { ...u, email: editForm.email, user_metadata: { ...u.user_metadata, ...editForm, role: editForm.role } }
          : u
      );
      setUsers(newUsers);
      setEditUserId(null);
    } else {
      alert(result.error || "Failed to update user");
    }
  }

  // Member edit handlers
  function handleEditMember(member) {
    setEditingMemberId(member.member_id);
    setEditMemberForm({ ...member });
  }
  function handleCancelEditMember() {
    setEditingMemberId(null);
    setEditMemberForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      dob: "",
      membership: "",
      balance: "",
      photo: "",
      first_name2: "",
      last_name2: "",
      email2: "",
      phone2: "",
      company2: "",
      photo2: ""
    });
  }
  async function handleSaveEditMember() {
    const { member_id, ...fields } = editMemberForm;
    const { error } = await supabase.from('members').update(fields).eq('member_id', editingMemberId);
    if (!error) {
      setMembers(members.map(m => m.member_id === editingMemberId ? { ...m, ...fields } : m));
      setEditingMemberId(null);
    } else {
      alert('Failed to update member: ' + error.message);
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function fetchMembers() {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('join_date', { ascending: false });

      if (error) {
        console.error('Error fetching members:', error);
      } else {
        setMembers(data);
      }
    }
    fetchMembers();
  }, []);

  async function handlePromote(e) {
    e.preventDefault();
    setPromoteStatus(''); // Clear previous message
    try {
      const response = await fetch('/api/promoteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: promoteEmail }),
      });
      const data = await response.json();
      if (data.success) {
        setPromoteStatus('User promoted to admin!');
      } else {
        setPromoteStatus(data.error || 'Failed to promote user.');
      }
    } catch (err) {
      setPromoteStatus('Error: ' + err.message);
    }
  }

  // Handler for Create User form
  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateStatus('');
    try {
      const response = await fetch('/api/createUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createUserForm.email,
          first_name: createUserForm.first_name,
          last_name: createUserForm.last_name,
          phone: createUserForm.phone,
          role: createUserForm.role
        }),
      });
      const data = await response.json();
      if (data.success) {
        setCreateStatus('User created! Check their email for a magic link.');
        setCreateUserForm({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          role: 'view'
        });
        setShowCreateUserModal(false);
        // Refresh user list
        const res = await fetch('/api/listUsers');
        const userData = await res.json();
        setUsers(userData.users || []);
      } else {
        setCreateStatus(data.error || 'Failed to create user.');
      }
    } catch (err) {
      setCreateStatus('Error: ' + err.message);
    }
  }

  // Scroll to top on section or selectedMember change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section, selectedMember]);

  // Add this useEffect to fetch base hours
  useEffect(() => {
    async function fetchBaseHours() {
      const { data, error } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'base');
      
      if (!error && data) {
        console.log('Loaded base hours:', data);
        setBaseHours(data);
      } else if (error) {
        console.error('Error loading base hours:', error);
      }
    }
    fetchBaseHours();
  }, []);

  // Add at the top of App function:
  useEffect(() => {
    async function fetchExceptionalOpens() {
      const { data, error } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_open');
      if (!error && data) setExceptionalOpens(data);
    }
    fetchExceptionalOpens();
  }, []);

  // Add at the top of App function:
  useEffect(() => {
    async function fetchExceptionalClosures() {
      const { data, error } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_closure');
      if (!error && data) setExceptionalClosures(data);
    }
    fetchExceptionalClosures();
  }, []);

  // Helper function for generating times from time ranges
  function generateTimesFromRanges(time_ranges) {
    const times = [];
    time_ranges.forEach(range => {
      let [startHour, startMinute] = range.start.split(':').map(Number);
      let [endHour, endMinute] = range.end.split(':').map(Number);
      if (endHour === 0 && endMinute === 0) endHour = 24;
      let current = new Date(2000, 0, 1, startHour, startMinute, 0, 0);
      const end = new Date(2000, 0, 1, endHour, endMinute, 0, 0);
      while (current < end) {
        const hh = String(current.getHours()).padStart(2, '0');
        const mm = String(current.getMinutes()).padStart(2, '0');
        times.push(`${hh}:${mm}`);
        current.setMinutes(current.getMinutes() + 15);
      }
    });
    return times;
  }

  // Update getAvailableTimes:
  const getAvailableTimes = (selectedDate) => {
    const now = toCST(new Date());
    const selectedDateCST = toCST(selectedDate);
    if (selectedDateCST < now) {
      return [];
    }
    const selectedDateStr = selectedDateCST.toISOString().split('T')[0];
    // Block if a private event covers the whole day
    const privateEventAllDay = privateEvents.find(ev => {
      const evStart = new Date(ev.start_time);
      const evEnd = new Date(ev.end_time);
      return ev.private &&
        evStart.toISOString().split('T')[0] === selectedDateStr &&
        evEnd.toISOString().split('T')[0] === selectedDateStr &&
        (evStart.getHours() === 0 && evEnd.getHours() === 23);
    });
    if (privateEventAllDay) return [];
    // Get all private events for this date
    const privateEventsForDate = privateEvents.filter(ev => {
      const evStart = new Date(ev.start_time);
      const evEnd = new Date(ev.end_time);
      return ev.private &&
        evStart.toISOString().split('T')[0] === selectedDateStr;
    });
    // Get normal available times
    const baseHour = baseHours.find(h => Number(h.day_of_week) === selectedDateCST.getDay());
    if (!baseHour || !baseHour.time_ranges) return [];
    let times = generateTimesFromRanges(baseHour.time_ranges);
    // Remove times that overlap with private events
    times = times.filter(t => {
      const slot = createDateFromTimeString(t, selectedDateCST);
      return !privateEventsForDate.some(ev => {
        const evStart = new Date(ev.start_time);
        const evEnd = new Date(ev.end_time);
        return slot >= evStart && slot < evEnd;
      });
    });
    return times;
  };

  // Fetch booking window dates from Supabase on mount
  useEffect(() => {
    async function fetchBookingWindow() {
      const { data: startData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'booking_start_date')
        .single();
      const { data: endData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'booking_end_date')
        .single();
      if (startData && startData.value) setBookingStartDate(new Date(startData.value));
      if (endData && endData.value) setBookingEndDate(new Date(endData.value));
    }
    fetchBookingWindow();
  }, []);

  // Fetch private events on mount and whenever a new event is created
  useEffect(() => {
    async function fetchPrivateEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('private', true);
      if (!error && data) setPrivateEvents(data);
    }
    fetchPrivateEvents();
  }, []);

  // Add route for /private-event/:id
  const pathname = window.location.pathname;
  const privateEventMatch = pathname.match(/^\/private-event\/(\d+)/);
  if (privateEventMatch) {
    const eventId = privateEventMatch[1];
    return <PrivateEventBooking eventId={eventId} />;
  }

  // Add route for /private-event/:id/rsvp
  const privateEventRSVPMatched = pathname.match(/^\/private-event\/(\d+)\/rsvp/);
  if (privateEventRSVPMatched) {
    const eventId = privateEventRSVPMatched[1];
    return <PrivateEventBooking eventId={eventId} rsvpMode={true} />;
  }

  if (!session) {
    return (
      <div className="auth-container">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]} // No social sign-in
          theme="dark"
          magicLink={true}
          view="magic_link"
        />
      </div>
    );
  }

  if (session) {
    const isAdmin = session.user?.user_metadata?.role === "admin";
    
    if (!isAdmin) {
      return (
        <div style={{ padding: "4rem", textAlign: "center" }}>
          <h2>You do not have access to this dashboard.</h2>
          <button
            style={{
              marginTop: "2rem",
              padding: "0.5rem 1.5rem",
              background: "#a59480",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
          >
            Sign Out
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <div style={{
          width: 250,
          background: '#3a2c1a',
          color: '#fff',
          padding: '2rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <h2 style={{ margin: 0, padding: '0 1rem' }}>Noir CRM</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={() => setSection('dashboard')}
              style={{
                background: section === 'dashboard' ? '#a59480' : 'transparent',
                border: 'none',
                padding: '0.75rem 1rem',
                color: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Dashboard
            </button>
            <button
              onClick={() => setSection('members')}
              style={{
                background: section === 'members' ? '#a59480' : 'transparent',
                border: 'none',
                padding: '0.75rem 1rem',
                color: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Members
            </button>
            <button
              onClick={() => setSection('calendar')}
              style={{
                background: section === 'calendar' ? '#a59480' : 'transparent',
                border: 'none',
                padding: '0.75rem 1rem',
                color: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Calendar
            </button>
            <button
              onClick={() => setSection('makeReservation')}
              style={{
                background: section === 'makeReservation' ? '#a59480' : 'transparent',
                border: 'none',
                padding: '0.75rem 1rem',
                color: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Make Reservation
            </button>
            <button
              onClick={() => setSection('users')}
              style={{
                background: section === 'users' ? '#a59480' : 'transparent',
                border: 'none',
                padding: '0.75rem 1rem',
                color: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Users
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0.75rem 1rem',
                color: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '4px',
                marginTop: 'auto'
              }}
            >
              Sign Out
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, background: '#f7f6f3' }}>
          {section === 'dashboard' && <Dashboard />}
          {section === 'members' && (
            <>
              {/* Member Lookup UI at the top of Members section */}
              <div style={{ marginBottom: '2rem' }}>
                <input
                  type="text"
                  placeholder="Search by name, email, or phone"
                  value={lookupQuery}
                  onChange={e => setLookupQuery(e.target.value)}
                  style={{ fontSize: '1.2rem', padding: '0.5rem', margin: '1rem 0', borderRadius: '6px', border: '1px solid #ccc', width: '100%', maxWidth: '400px' }}
                />
                  <ul className="member-list">
                  {members.filter(m => {
                    const q = lookupQuery.trim().toLowerCase();
                    if (!q) return false;
                    return (
                      (m.first_name && m.first_name.toLowerCase().includes(q)) ||
                      (m.last_name && m.last_name.toLowerCase().includes(q)) ||
                      (m.email && m.email.toLowerCase().includes(q)) ||
                      (m.phone && m.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
                    );
                  }).length === 0 && lookupQuery ? (
                    <div style={{ margin: '2rem', color: '#999' }}>No results found.</div>
                  ) : (
                    members.filter(m => {
                      const q = lookupQuery.trim().toLowerCase();
                      if (!q) return false;
                      return (
                        (m.first_name && m.first_name.toLowerCase().includes(q)) ||
                        (m.last_name && m.last_name.toLowerCase().includes(q)) ||
                        (m.email && m.email.toLowerCase().includes(q)) ||
                        (m.phone && m.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
                      );
                    }).map(member => (
                      <li
                        key={member.member_id}
                        className="member-item"
                        style={{ position: "relative", cursor: "pointer", width: "100%" }}
                        onClick={() => {
                          setSelectedMember(member);
                          fetchLedger(member.account_id);
                        }}
                        tabIndex={0}
                        role="button"
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            setSelectedMember(member);
                            fetchLedger(member.account_id);
                          }
                        }}
                      >
                            {member.photo && (
                              <img
                                src={member.photo}
                                alt={`${member.first_name} ${member.last_name}`}
                                className="member-photo"
                              />
                            )}
                            <div className="member-info">
                              <strong>
                            {member.first_name} {member.last_name}
                              </strong>
                          <div>Member since: {formatDateLong(member.join_date)}</div>
                              <div>Phone: {formatPhone(member.phone)}</div>
                              <div>Email: {member.email}</div>
                              <div>Date of Birth: {formatDOB(member.dob)}</div>
                            </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              {/* End Member Lookup UI */}
              {/* Existing member list, filtered if no lookup query */}
              {!selectedMember ? (
                <>
                  <h1 className="app-title">Noir CRM – Members</h1>
                  {Object.entries(membersByAccount).map(([accountId, accountMembers]) => (
                    <div key={accountId} className="account-group" style={{
                      marginBottom: '1rem',
                      padding: '1rem',
                      background: '#fff',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.2rem'
                    }}>
                      {accountMembers.map((member, idx) => (
                        <div key={member.member_id} style={{
                          padding: '0.5rem 0',
                          background: 'none',
                          boxShadow: 'none',
                          borderRadius: 0,
                          marginBottom: 0
                        }}>
                          <li
                        className="member-item"
                            style={{ position: "relative", cursor: "pointer", listStyle: 'none', margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}
                            onClick={() => {
                              setSelectedMember(member);
                              fetchLedger(member.account_id);
                            }}
                          >
                            {member.photo && (
                              <img
                                src={member.photo}
                                alt={`${member.first_name} ${member.last_name}`}
                                    className="member-photo"
                                style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, marginRight: 20, background: '#f6f5f2' }}
                                  />
                                )}
                            <div className="member-info" style={{ flex: 1 }}>
                                <strong>
                                {member.first_name} {member.last_name}
                                </strong>
                              <div>Member since: {formatDateLong(member.join_date)}</div>
                              <div>Phone: {formatPhone(member.phone)}</div>
                              <div>Email: {member.email}</div>
                              <div>Date of Birth: {formatDOB(member.dob)}</div>
                              </div>
                        </li>
                          </div>
                      ))}
                    </div>
                  ))}
                </>
              ) : (
                // Member Detail View (not modal, full width minus sidebar)
                <div className="member-detail-view"
                  style={{
                    margin: "0 auto",
                    background: "#faf9f7",
                    borderRadius: "12px",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
                    boxSizing: "border-box",
                    overflowX: "hidden",
                    padding: '2rem 1.5rem',
                    position: 'relative'
                  }}
                >
                  {/* Add spacing above top bar */}
                  <div style={{ height: '1.5rem' }} />
                  
                  <div style={{ position: 'absolute', right: 0, bottom: 0, color: '#b3b1a7', fontSize: '0.75rem', fontStyle: 'italic', userSelect: 'all', margin: '0.5rem 1.5rem', opacity: 0.6 }}>
                    Account ID: {selectedMember.account_id}
                  </div>
                  <Elements stripe={stripePromise}>
                    {/* First row: member columns */}
                    <div style={{ display: 'flex', gap: 0, marginBottom: '2rem' }}>
                      {members.filter(m => m.account_id === selectedMember.account_id).map((member, idx, arr) => (
                        <div key={member.member_id} style={{ flex: 1, borderRight: idx < arr.length - 1 ? '1px solid #d1cfc7' : 'none', padding: '0 1.5rem' }}>
                    <MemberDetail
                            member={member}
                      session={session}
                            onEditMember={handleEditMember}
                    />
                </div>
                      ))}
                    </div>
                    {/* Second row: shared ledger for the account */}
                    <div style={{ width: '100%', position: 'relative' }}>
                      <h3>Ledger</h3>
                      <div style={{ marginBottom: '1rem' }}>
                        <strong>
                          {memberLedger && memberLedger.reduce((acc, t) => acc + Number(t.amount), 0) < 0 ? 'Balance Due:' : 'Current Credit:'}
                        </strong>{' '}
                        ${Math.abs((memberLedger || []).reduce((acc, t) => acc + Number(t.amount), 0)).toFixed(2)}
                        {session.user?.user_metadata?.role === 'admin' && selectedMember.stripe_customer_id && (
                          <>
                            <button
                              onClick={handleChargeBalance}
                              disabled={charging || (memberLedger && memberLedger.reduce((acc, t) => acc + Number(t.amount), 0) >= 0)}
                              style={{ marginLeft: '1rem', padding: '0.5rem 1rem', cursor: (memberLedger && memberLedger.reduce((acc, t) => acc + Number(t.amount), 0) < 0) ? 'pointer' : 'not-allowed' }}
                            >
                              {charging ? 'Charging...' : 'Charge Balance'}
                            </button>
                            {(memberLedger && memberLedger.reduce((acc, t) => acc + Number(t.amount), 0) >= 0) && (
                              <span style={{ marginLeft: '1rem', color: '#888' }}>
                                No outstanding balance to charge.
                              </span>
              )}
            </>
          )}
                        {chargeStatus && <span style={{ marginLeft: '1rem' }}>{chargeStatus}</span>}
                </div>
                      <table className="ledger-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Member</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Type</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Add Transaction Row */}
                          <tr>
                            <td>
                              <input
                                type="date"
                                name="date"
                                value={newTransaction.date || ''}
                                onChange={e => setNewTransaction({ ...newTransaction, date: e.target.value })}
                                className="add-transaction-input"
                                style={{ minWidth: 120 }}
                              />
                            </td>
                            <td>
                              <select
                                name="member_id"
                                value={selectedTransactionMemberId}
                                onChange={e => setSelectedTransactionMemberId(e.target.value)}
                                className="add-transaction-input"
                                style={{ minWidth: 120 }}
                              >
                                <option value="">Select Member</option>
                                {members.filter(m => m.account_id === selectedMember.account_id).map(m => (
                                  <option key={m.member_id} value={m.member_id}>
                                    {m.first_name} {m.last_name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                name="note"
                                placeholder="Note"
                                value={newTransaction.note || ''}
                                onChange={e => setNewTransaction({ ...newTransaction, note: e.target.value })}
                                className="add-transaction-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                name="amount"
                                placeholder="Amount"
                                value={newTransaction.amount || ''}
                                onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                                className="add-transaction-input"
                              />
                            </td>
                            <td>
                              <select
                                name="type"
                                value={newTransaction.type || ''}
                                onChange={e => setNewTransaction({ ...newTransaction, type: e.target.value })}
                                className="add-transaction-input"
                              >
                                <option value="">Type</option>
                                <option value="payment">Payment</option>
                                <option value="purchase">Purchase</option>
                              </select>
                            </td>
                            <td>
                              <button
                                onClick={e => {
                                  e.preventDefault();
                                  if (!selectedTransactionMemberId) {
                                    setTransactionStatus('Please select a member.');
                                    return;
                                  }
                                  handleAddTransaction(selectedTransactionMemberId, selectedMember.account_id);
                                }}
                                className="add-transaction-btn"
                                style={{ background: '#666', padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                                disabled={transactionStatus === 'loading'}
                              >
                                {transactionStatus === 'loading' ? 'Adding...' : 'Add'}
                              </button>
                            </td>
                          </tr>
                          {/* Ledger Rows */}
                          {memberLedger && memberLedger.length > 0 ? (
                            memberLedger.map((tx, idx) => {
                              const member = members.find(m => m.member_id === tx.member_id);
                              return (
                                <tr key={tx.id || idx}>
                                  <td>{formatDateLong(tx.date)}</td>
                                  <td>{member ? `${member.first_name} ${member.last_name}` : ''}</td>
                                  <td>{tx.note}</td>
                                  <td>${Number(tx.amount).toFixed(2)}</td>
                                  <td>{tx.type === 'payment' ? 'Payment' : tx.type === 'purchase' ? 'Purchase' : tx.type}</td>
                                  <td>
                                    <button
                                      onClick={() => handleEditTransaction(tx)}
                                      className="add-transaction-btn"
                                      style={{ background: '#666', padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                                    >
                                      Edit
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="6">No transactions found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {/* Manual Refresh Button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          onClick={() => fetchLedger(selectedMember.account_id)}
                          style={{
                            background: '#eee',
                            color: '#555',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '0.95rem',
                            padding: '0.3rem 0.9rem',
                            cursor: 'pointer',
                            opacity: 0.7,
                            transition: 'opacity 0.2s',
                          }}
                          onMouseOver={e => (e.currentTarget.style.opacity = 1)}
                          onMouseOut={e => (e.currentTarget.style.opacity = 0.7)}
                          aria-label="Refresh ledger"
                        >
                          Refresh
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem' }}>
                    <button
                      onClick={() => setSelectedMember(null)}
                      style={{ background: '#e5e1d8', color: '#555', border: 'none', borderRadius: '4px', padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Back to List
                    </button>
                    <button
                      onClick={() => setShowAddMemberModal(true)}
                      style={{ background: '#a59480', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + Add Member
                    </button>
                  </div>
                    </div>
                  </Elements>
                </div>
              )}
            </>
          )}
          {section === 'calendar' && (
            <div style={{ padding: '2rem', maxWidth: '100vw', width: '90%' }}>
              <h2>Seating Calendar</h2>
              <FullCalendarTimeline reloadKey={reloadKey} bookingStartDate={bookingStartDate} bookingEndDate={bookingEndDate} />
              {eventInfo && (
                <div style={{ marginTop: '1rem' }}>
                  <p>Event/Reservation ID: {eventInfo.id}</p>
                </div>
              )}
            </div>
          )}
          {section === 'makeReservation' && (() => {
            // --- Reserve On The Spot logic ---
            async function handleReserveNow() {
              setReserveStatus('');
              let formattedPhone = phone;
              if (/^\d{10}$/.test(phone)) {
                formattedPhone = '+1' + phone;
              }
              const res = await fetch(`/api/checkMemberByPhone?phone=${encodeURIComponent(formattedPhone)}`);
              const data = await res.json();
              if (data.member) {
                setPendingReservation({
                  name: `${data.member.first_name} ${data.member.last_name}`,
                  phone: data.member.phone,
                  email: data.member.email,
                  party_size: partySize,
                  notes: '',
                  start_time: getStartTime(),
                  end_time: getEndTime(),
                  source: 'member',
                  event_type: eventType
                });
                setShowConfirmationModal(true);
              } else {
                setShowNonMemberModal(true);
              }
            }

            function getStartTime() {
              const [hh, mm] = time.split(':');
              const start = toCST(new Date(date));
              start.setHours(Number(hh), Number(mm), 0, 0);
              return toCSTISOString(start);
            }
            function getEndTime() {
              const [hh, mm] = time.split(':');
              const start = toCST(new Date(date));
              start.setHours(Number(hh), Number(mm), 0, 0);
              const duration = partySize <= 2 ? 90 : 120;
              const end = new Date(start.getTime() + duration * 60000);
              return toCSTISOString(end);
            }

            async function createReservation(payload) {
              const res = await fetch('/api/reservations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...payload,
                  event_type: payload.event_type
                })
              });
              const result = await res.json();
              if (!res.ok) {
                if (res.status === 409 && result.next_available_time) {
                  setNextAvailableTime(result.next_available_time);
                  setReserveStatus('');
                } else {
                  alert(result.error || 'Reservation failed');
                }
                throw new Error(result.error || 'Reservation failed');
              }
            }

            async function confirmReservation() {
              try {
                await createReservation(pendingReservation);
                setMemberLookup(pendingReservation);
                setNonMemberFields({ firstName: '', lastName: '', email: '' });
                setShowReservationModal(false);
                setShowConfirmationModal(false);
                setSlotInfo(null);
                setReloadKey(k => k + 1);
              } catch (err) {
                console.log('Reservation failed (member):', err);
              }
            }

            return (
              <div style={{ padding: '2rem' }}>
                <div className="reserve-form">
                  <h2>Reserve On The Spot</h2>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      placeholder="Enter phone"
                      value={phone}
                      onChange={e => {
                        setPhone(e.target.value);
                        setNonMemberFields({ firstName: '', lastName: '', email: '' });
                        setMemberLookup(null);
                        setReserveStatus('');
                      }}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Party Size</label>
                    <div className="party-size-control">
                    <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))}>−</button>
                      <span>{partySize} guests</span>
                    <button type="button" onClick={() => setPartySize(partySize + 1)}>+</button>
                  </div>
                  </div>
                  <div className="form-group">
                      <label>Date</label>
                      <DatePicker
                        selected={date}
                        onChange={d => setDate(d)}
                        dateFormat="MMMM d, yyyy"
                      minDate={bookingStartDate || new Date()}
                      maxDate={bookingEndDate || null}
                      className="form-control"
                      filterDate={d => {
                        if (bookingStartDate && d < bookingStartDate) return false;
                        if (bookingEndDate && d > bookingEndDate) return false;
                        const dateStr = toCST(d).toISOString().split('T')[0];
                        // Block if a private event covers the whole day
                        const privateEventAllDay = privateEvents.find(ev => {
                          const evStart = new Date(ev.start_time);
                          const evEnd = new Date(ev.end_time);
                          return ev.private &&
                            evStart.toISOString().split('T')[0] === dateStr &&
                            evEnd.toISOString().split('T')[0] === dateStr &&
                            (evStart.getHours() === 0 && evEnd.getHours() === 23);
                        });
                        if (privateEventAllDay) return false;
                        const isClosed = exceptionalClosures.some(
                          ec => ec.date && ec.date.slice(0, 10) === dateStr
                        );
                        return !isClosed && getAvailableTimes(d).length > 0;
                      }}
                      />
                    </div>
                  <div className="form-group">
                      <label>Time</label>
                      <select
                        value={time}
                        onChange={e => setTime(e.target.value)}
                      className="form-control"
                      disabled={getAvailableTimes(date).length === 0}
                      >
                      {getAvailableTimes(date).length === 0 ? (
                        <option value="">No available times</option>
                      ) : (
                        getAvailableTimes(date).map(t => (
                          <option key={t} value={t}>
                            {createDateFromTimeString(t).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              timeZone: 'America/Chicago'
                            })}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Event Type</label>
                    <select
                      value={eventType}
                      onChange={e => setEventType(e.target.value)}
                      className="form-control"
                    >
                      <option value="">Select an event type...</option>
                      {eventTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  <button
                    onClick={handleReserveNow}
                    className="reserve-button"
                  >
                    Reserve Now
                  </button>
                  {reserveStatus && (
                    <div className={`reserve-status ${reserveStatus.includes('confirmed') ? 'success' : 'error'}`}>
                      {reserveStatus}
                    </div>
                  )}
                  </div>

                {showNonMemberModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div className="non-member-modal">
                      <h3>Enter Non-Member Details</h3>
                      <div className="form-group">
                        <label>First Name</label>
                        <input
                          type="text"
                          placeholder="First name"
                          value={nonMemberFields.firstName}
                          onChange={e => setNonMemberFields(f => ({ ...f, firstName: e.target.value }))}
                          className="form-control"
                        />
                      </div>
                      <div className="form-group">
                        <label>Last Name</label>
                        <input
                          type="text"
                          placeholder="Last name"
                          value={nonMemberFields.lastName}
                          onChange={e => setNonMemberFields(f => ({ ...f, lastName: e.target.value }))}
                          className="form-control"
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          placeholder="Email"
                          value={nonMemberFields.email}
                          onChange={e => setNonMemberFields(f => ({ ...f, email: e.target.value }))}
                          className="form-control"
                        />
                      </div>
                      <div className="modal-actions">
                  <button
                    onClick={async () => {
                            if (!nonMemberFields.firstName || !nonMemberFields.lastName || !nonMemberFields.email) {
                              setReserveStatus('Please enter first name, last name, and email for non-members.');
                              return;
                            }
                            try {
                              await createReservation({
                                name: `${nonMemberFields.firstName} ${nonMemberFields.lastName}`.trim(),
                          phone,
                                email: nonMemberFields.email,
                          party_size: partySize,
                          notes: '',
                                start_time: getStartTime(),
                                end_time: getEndTime(),
                                source: 'public_widget',
                                event_type: eventType
                              });
                              setNonMemberFields({ firstName: '', lastName: '', email: '' });
                              setShowNonMemberModal(false);
                      setReloadKey(k => k + 1);
                      setPhone('');
                      setFirstName('');
                      setLastName('');
                      setPartySize(1);
                      setTime('18:00');
                              setReserveStatus('Reservation confirmed!');
                            } catch (err) {
                              console.log('Reservation failed (non-member):', err);
                            }
                          }}
                          className="primary"
                        >
                          Confirm Reservation
                        </button>
                        <button
                          onClick={() => setShowNonMemberModal(false)}
                          className="secondary"
                        >
                          Cancel
                  </button>
                </div>
                    </div>
                  </div>
                )}

                {showConfirmationModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div className="non-member-modal">
                      <h3>Confirm Reservation</h3>
                      <div className="form-group">
                        <p><strong>Name:</strong> {pendingReservation?.name}</p>
                        <p><strong>Phone:</strong> {pendingReservation?.phone}</p>
                        <p><strong>Email:</strong> {pendingReservation?.email}</p>
                        <p><strong>Party Size:</strong> {pendingReservation?.party_size}</p>
                        <p><strong>Date:</strong> {new Date(pendingReservation?.start_time).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> {new Date(pendingReservation?.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                        <p><strong>Event Type:</strong> {eventTypes.find(t => t.value === pendingReservation?.event_type)?.label || 'None'}</p>
                      </div>
                      <div className="modal-actions">
                        <button
                          onClick={confirmReservation}
                          className="primary"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowConfirmationModal(false)}
                          className="secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {section === 'users' && (
            <>
              <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
                <h2>All Users</h2>
                <table className="user-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>First Name</th>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>Last Name</th>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>Email</th>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>Phone</th>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>Role</th>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      editUserId === user.id ? (
                        <tr key={user.id}>
                          <td><input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} /></td>
                          <td><input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} /></td>
                          <td><input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></td>
                          <td><input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></td>
                          <td>
                            <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                              <option value="admin">admin</option>
                              <option value="member">member</option>
                              <option value="view">view</option>
                            </select>
                          </td>
                          <td>
                            <button onClick={() => handleSaveUser(user.id)} style={{ marginRight: "0.5rem" }}>Save</button>
                            <button onClick={handleCancelEdit} style={{ marginRight: "0.5rem" }}>Cancel</button>
                            <button
                              style={{ color: '#fff', background: '#e74c3c', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                              onClick={async () => {
                                if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
                                try {
                                  const res = await fetch('/api/deleteAuthUser', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      supabase_user_id: user.id,
                                      member_id: null,
                                      requester_token: session.access_token
                                    })
                                  });
                                  const data = await res.json();
                                  if (res.ok && data.success) {
                                    setUsers(users.filter(u => u.id !== user.id));
                                    setEditUserId(null);
                                    alert('User deleted.');
                                  } else {
                                    alert('Failed to delete user: ' + (data.error || 'Unknown error'));
                                  }
                                } catch (e) {
                                  alert('Failed to delete user: ' + e.message);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={user.id}>
                          <td>{user.user_metadata?.first_name || ""}</td>
                          <td>{user.user_metadata?.last_name || ""}</td>
                          <td>{user.email}</td>
                          <td>{user.user_metadata?.phone || ""}</td>
                          <td>{user.user_metadata?.role || "view"}</td>
                          <td>
                            <button onClick={() => handleEditUser(user)} style={{ marginRight: "0.5rem" }}>Edit</button>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
                {/* Move Create User button here, below the table */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button 
                    onClick={() => setShowCreateUserModal(true)}
                    style={{ 
                      padding: "0.5rem 1.5rem", 
                      background: "#a59480", 
                      color: "#fff", 
                      border: "none", 
                      borderRadius: "4px", 
                      fontWeight: 600, 
                      cursor: "pointer" 
                    }}
                  >
                    Create User
                  </button>
                </div>
                {createStatus && <div style={{ marginTop: "0.5rem", color: "#353535", fontWeight: 600 }}>{createStatus}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}

export default App;