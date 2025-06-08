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
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function App() {
  // All useState hooks at the top
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const [users, setUsers] = useState([]);
  const [editUserId, setEditUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "view"
  });
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
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberLedger, setMemberLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ type: 'payment', amount: '', note: '' });
  const [transactionStatus, setTransactionStatus] = useState('');
  const isMobile = useIsMobile();
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
  const [upcomingRenewals, setUpcomingRenewals] = useState([]);
  const [projectedMonthlyDues, setProjectedMonthlyDues] = useState(0);
  const [showCreditCardHoldModal, setShowCreditCardHoldModal] = useState(false);
  const [pendingReservationId, setPendingReservationId] = useState(null);

  // Define eventTypes at the top
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

  // Define fetchLedger at the top
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

  // Define handleAddTransaction at the top
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

  // All useEffect hooks at the top
  useEffect(() => {
    if (!members.length) return;

    // Map membership text to monthly amount
    const membershipAmounts = {
      'Host': 1,
      'Noir Host': 1,
      'Noir Solo': 100,
      'Solo': 100,
      'Noir Duo': 125,
      'Duo': 125,
      'Premier': 250,
      'Reserve': 1000
    };

    // Helper to extract tier from membership string
    function getTier(membership) {
      if (!membership) return null;
      if (/host/i.test(membership)) return 'Host';
      if (/solo/i.test(membership)) return 'Noir Solo';
      if (/duo/i.test(membership)) return 'Noir Duo';
      if (/premier/i.test(membership)) return 'Premier';
      if (/reserve/i.test(membership)) return 'Reserve';
      return null;
    }

    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    const getNextRenewal = (joinDate) => {
      if (!joinDate) return null;
      const jd = new Date(joinDate);
      let year = today.getFullYear();
      let month = today.getMonth();
      const day = jd.getDate();
      let candidate = new Date(year, month, day);
      if (candidate < today) {
        if (month === 11) { year += 1; month = 0; }
        else { month += 1; }
        candidate = new Date(year, month, day);
      }
      return candidate;
    };

    const projected = members
      .filter(m => {
        const nextRenewal = getNextRenewal(m.join_date);
        return (
          nextRenewal &&
          nextRenewal.getMonth() === thisMonth &&
          nextRenewal.getFullYear() === thisYear
        );
      })
      .reduce((sum, m) => {
        const tier = getTier(m.membership);
        const amt = membershipAmounts[tier] || 0;
        return sum + amt;
      }, 0);

    setProjectedMonthlyDues(projected);
  }, [members]);

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

        // Calculate upcoming renewals
        const today = new Date();

        const getNextRenewal = (joinDate) => {
          if (!joinDate) return null;
          const jd = new Date(joinDate);
          let year = today.getFullYear();
          let month = today.getMonth();
          const day = jd.getDate();
          let candidate = new Date(year, month, day);
          if (candidate < today) {
            if (month === 11) { year += 1; month = 0; }
            else { month += 1; }
            candidate = new Date(year, month, day);
          }
          return candidate;
        };

        const upcoming = (data || [])
          .map(m => ({
            ...m,
            nextRenewal: getNextRenewal(m.join_date)
          }))
          .filter(m => m.nextRenewal) // Filter out any null nextRenewal dates
          .sort((a, b) => a.nextRenewal - b.nextRenewal); // Sort by nextRenewal date

        setUpcomingRenewals(upcoming);
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
          view="sign_in"
        />
      </div>
    );
  }

  if (session) {
    const isAdmin = session.user?.user_metadata?.role === "admin";
    // Helper for uploading a photo to Supabase Storage and returning the public URL
    // Delete member handler
    // Now expects the full member object, not just the ID
    async function handleDeleteMember(member) {
      if (!window.confirm('Are you sure you want to delete this member? This cannot be undone.')) return;
      try {
        const res = await fetch('/api/deleteAuthUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: member.member_id,
            supabase_user_id: member.supabase_user_id,
            requester_token: session.access_token
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setMembers(members.filter(m => m.member_id !== member.member_id));
          setSelectedMember(null);
          setEditingMemberId(null);
          alert('Member deleted.');
        } else {
          alert('Failed to delete member: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Failed to delete member: ' + e.message);
      }
    }
    async function handlePhotoUpload(file, isCounterpart = false) {
      if (!file) return null;
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${fileName}`;
      let { error } = await supabase.storage.from('member-photos').upload(filePath, file);
      if (error) {
        alert('Failed to upload photo: ' + error.message);
        return null;
      }
      const { data } = supabase.storage.from('member-photos').getPublicUrl(filePath);
      const url = data?.publicUrl || null;
      // After getting the publicUrl, update the members table and local state
      if (url && editingMemberId) {
        if (isCounterpart) {
          // Update photo2
          await supabase.from('members').update({ photo2: url }).eq('member_id', editingMemberId);
          setEditMemberForm(form => ({ ...form, photo2: url }));
          setMembers(ms => ms.map(m => m.member_id === editingMemberId ? { ...m, photo2: url } : m));
          setSelectedMember(sel => sel && sel.member_id === editingMemberId ? { ...sel, photo2: url } : sel);
        } else {
          // Update photo
          await supabase.from('members').update({ photo: url }).eq('member_id', editingMemberId);
          setEditMemberForm(form => ({ ...form, photo: url }));
          setMembers(ms => ms.map(m => m.member_id === editingMemberId ? { ...m, photo: url } : m));
          setSelectedMember(sel => sel && sel.member_id === editingMemberId ? { ...sel, photo: url } : sel);
        }
      }
      return url;
    }

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

    if (!members.length) {
      return <div>Loading members...</div>;
    }

    // Reservation save handler for modal
    async function handleSaveReservation(formData) {
      await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setShowReservationModal(false);
      setSlotInfo(null);
      setReloadKey(k => k + 1);
    }

    // Handler for selecting slot in calendar for table assignment
    const onSelectSlotForTableAssignment = slot => {
      setSlotInfo(slot);
      setShowReservationModal(true);
    };

    // Group members by account_id
    const membersByAccount = members.reduce((acc, member) => {
      if (!acc[member.account_id]) acc[member.account_id] = [];
      acc[member.account_id].push(member);
      return acc;
    }, {});

    // Add missing functions
    const formatDateLong = (dateString) => {
      if (!dateString) return null;
      // Parse as local date if in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' });
      }
      const date = new Date(dateString);
      if (isNaN(date)) return null;
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' });
    };

    const handleChargeBalance = async () => {
      setCharging(true);
      setChargeStatus(null);
      try {
        const res = await fetch('/api/chargeBalance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: selectedMember.member_id, account_id: selectedMember.account_id }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setChargeStatus('Charged successfully');
          handleAddTransaction(selectedMember.member_id, selectedMember.account_id);
        } else {
          setChargeStatus(`Error: ${data.error || 'Charge failed'}`);
        }
      } catch (e) {
        setChargeStatus(`Error: ${e.message}`);
      }
      setCharging(false);
    };

    const handleEditTransaction = (tx) => {
      setEditingTransaction(tx.id);
      setEditTransactionForm({
        note: tx.note || '',
        amount: Math.abs(tx.amount).toString(),
        type: tx.type || '',
        date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : ''
      });
    };

    const handleUpdateTransaction = async (txId) => {
      try {
        const res = await fetch('/api/ledger', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: txId,
            ...editTransactionForm,
            date: editTransactionForm.date ? editTransactionForm.date : undefined,
            amount: editTransactionForm.type === 'purchase' ? 
              -Math.abs(Number(editTransactionForm.amount)) : 
              Math.abs(Number(editTransactionForm.amount))
          })
        });
        if (res.ok) {
          setEditingTransaction(null);
          // Refresh ledger
          if (selectedMember?.member_id) {
            fetchLedger(selectedMember.account_id);
          }
        } else {
          alert('Failed to update transaction');
        }
      } catch (err) {
        alert('Error updating transaction: ' + err.message);
      }
    };

    // Add this function near other transaction handlers
    async function handleDeleteTransaction(txId) {
      if (!window.confirm('Are you sure you want to delete this transaction?')) return;
      try {
        const res = await fetch(`/api/ledger?id=${txId}`, { method: 'DELETE' });
        if (res.ok) {
          setEditingTransaction(null);
          // Refresh ledger
          if (selectedMember?.account_id) {
            fetchLedger(selectedMember.account_id);
          }
        } else {
          alert('Failed to delete transaction');
        }
      } catch (err) {
        alert('Error deleting transaction: ' + err.message);
      }
    }

    async function handleReserveNow() {
      setReserveStatus('');
      try {
        // Check if phone number corresponds to a member
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('*')
          .eq('phone', phone)
          .single();

        if (memberError && memberError.code !== 'PGRST116') {
          throw memberError;
        }

        if (memberData) {
          // Member found - proceed with normal reservation
          setPendingReservation({
            member_id: memberData.member_id,
            account_id: memberData.account_id,
            party_size: partySize,
            date: date.toISOString(),
            time: time,
            event_type: eventType
          });
          setShowReservationModal(true);
        } else {
          // Non-member - show non-member modal
          setShowNonMemberModal(true);
        }
      } catch (error) {
        setReserveStatus('Error: ' + error.message);
      }
    }

    // Add this function to handle non-member reservation submission
    async function handleNonMemberReservation() {
      try {
        // Create reservation for non-member
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: nonMemberFields.firstName,
            last_name: nonMemberFields.lastName,
            email: nonMemberFields.email,
            phone: phone,
            party_size: partySize,
            date: date.toISOString(),
            time: time,
            event_type: eventType
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create reservation');
        }

        // Show credit card hold modal
        setPendingReservationId(data.reservation_id);
        setShowNonMemberModal(false);
        setShowCreditCardHoldModal(true);
      } catch (error) {
        setReserveStatus('Error: ' + error.message);
      }
    }

    return (
      <Elements stripe={stripePromise}>
        <div className="app">
          {section === 'dashboard' && <DashboardPage />}
          {section === 'members' && <MembersPage />}
          {section === 'admin' && <AdminPage />}
          {section === 'calendar' && <CalendarPage />}

          {showNonMemberModal && (
            <div className="modal">
              <div className="modal-content">
                <h2>Non-Member Reservation</h2>
                <p>Please provide your information to complete the reservation.</p>
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={nonMemberFields.firstName}
                    onChange={(e) => setNonMemberFields(prev => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={nonMemberFields.lastName}
                    onChange={(e) => setNonMemberFields(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={nonMemberFields.email}
                    onChange={(e) => setNonMemberFields(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="button-group">
                  <button onClick={() => setShowNonMemberModal(false)}>Cancel</button>
                  <button onClick={handleNonMemberReservation}>Continue to Payment</button>
                </div>
              </div>
            </div>
          )}

          {showCreditCardHoldModal && (
            <CreditCardHoldModal
              reservationId={pendingReservationId}
              partySize={partySize}
              onSuccess={() => {
                setShowCreditCardHoldModal(false);
                setPendingReservationId(null);
                setReserveStatus('Reservation confirmed! A $25 per guest hold has been placed on your card.');
                setReloadKey(k => k + 1);
              }}
              onCancel={() => {
                setShowCreditCardHoldModal(false);
                setPendingReservationId(null);
                setReserveStatus('Reservation cancelled.');
              }}
            />
          )}
        </div>
      </Elements>
    );
  }
}

export default App;