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
  const [section, setSection] = useState('members');
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
        body: JSON.stringify({ email: createEmail, name: createName }),
      });
      const data = await response.json();
      if (data.success) {
        setCreateStatus('User created! Check their email for a magic link.');
        setCreateEmail('');
        setCreateName('');
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

  // Modify the times array generation to respect base hours
  const getAvailableTimes = (selectedDate) => {
    // Check if date is in the past using CST
    const now = toCST(new Date());
    const selectedDateCST = toCST(selectedDate);
    if (selectedDateCST < now) {
      return []; // No times available for past dates
    }

    const dayOfWeek = selectedDateCST.getDay();
    console.log('Selected date:', selectedDateCST);
    console.log('Day of week:', dayOfWeek);
    console.log('Base hours:', baseHours);
    
    const dayHours = baseHours.find(h => Number(h.day_of_week) === dayOfWeek);
    console.log('Found day hours:', dayHours);
    
    if (!dayHours || !dayHours.time_ranges || dayHours.time_ranges.length === 0) {
      return []; // No hours available for this day
    }

    const times = [];
    dayHours.time_ranges.forEach(range => {
      let [startHour, startMinute] = range.start.split(':').map(Number);
      let [endHour, endMinute] = range.end.split(':').map(Number);

      // Treat 00:00 as 24:00 for end of day
      if (endHour === 0 && endMinute === 0) {
        endHour = 24;
      }

      let current = new Date(2000, 0, 1, startHour, startMinute, 0, 0);
      const end = new Date(2000, 0, 1, endHour, endMinute, 0, 0);

      while (current < end) {
        const hh = String(current.getHours()).padStart(2, '0');
        const mm = String(current.getMinutes()).padStart(2, '0');
        times.push(`${hh}:${mm}`);
        current.setMinutes(current.getMinutes() + 15);
      }
    });
    
    console.log('Generated times:', times);
    return times;
  };

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
          body: JSON.stringify({ member_id: selectedMember.member_id }),
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

        {/* Edit Transaction Modal */}
        {editingTransaction && (
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
              minWidth: '350px',
              maxWidth: '95vw',
              textAlign: 'left',
              position: 'relative',
            }}>
              <button onClick={() => setEditingTransaction(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>&times;</button>
              <h3>Edit Transaction</h3>
              <form onSubmit={async e => { e.preventDefault(); await handleUpdateTransaction(editingTransaction); }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label>Date</label>
                    <input type="date" value={editTransactionForm.date || ''} onChange={e => setEditTransactionForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  </div>
                  <div>
                    <label>Type</label>
                    <select value={editTransactionForm.type || ''} onChange={e => setEditTransactionForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                      <option value="">Type</option>
                      <option value="payment">Payment</option>
                      <option value="purchase">Purchase</option>
                    </select>
                  </div>
                  <div>
                    <label>Amount</label>
                    <input type="number" value={editTransactionForm.amount || ''} onChange={e => setEditTransactionForm(f => ({ ...f, amount: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  </div>
                  <div>
                    <label>Note</label>
                    <input type="text" value={editTransactionForm.note || ''} onChange={e => setEditTransactionForm(f => ({ ...f, note: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <button type="button" onClick={() => handleDeleteTransaction(editingTransaction)} style={{ padding: '0.75rem 1.5rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                  <button type="submit" style={{ padding: '0.75rem 1.5rem', background: '#a59480', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Save Changes</button>
                  <button type="button" onClick={() => setEditingTransaction(null)} style={{ padding: '0.75rem 1.5rem', background: '#e5e1d8', color: '#555', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
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
              width: '90%',
              maxWidth: '500px',
            }}>
              <h3 style={{ marginBottom: '1.5rem', color: '#333' }}>Add New Member</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  // 1. Format phone number as +1XXXXXXXXXX
                  let phone = addMemberForm.phone || '';
                  let digits = phone.replace(/\D/g, '');
                  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
                  if (digits.length === 10) phone = `+1${digits}`;
                  else phone = phone; // fallback to original if not 10 digits

                  // 2. Copy over stripe_customer_id from selectedMember (account_id)
                  const stripe_customer_id = selectedMember.stripe_customer_id || null;

                  // 3. Fill in created_at with current timestamp
                  const created_at = new Date().toISOString();

                  // Create new member with same account_id as selected member
                  const { data, error } = await supabase.from('members').insert({
                    ...addMemberForm,
                    phone,
                    account_id: selectedMember.account_id,
                    member_id: uuidv4(),
                    status: 'active',
                    balance: 0,
                    join_date: new Date().toISOString(),
                    created_at,
                    stripe_customer_id
                  }).select();

                  if (error) throw error;

                  // Update local state
                  setMembers(prev => [...prev, data[0]]);
                  setShowAddMemberModal(false);
                  setAddMemberForm({
                    first_name: '',
                    last_name: '',
                    email: '',
                    phone: '',
                    dob: '',
                    membership: '',
                    photo: ''
                  });
                } catch (err) {
                  alert('Failed to add member: ' + err.message);
                }
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>First Name</label>
                    <input
                      type="text"
                      value={addMemberForm.first_name}
                      onChange={e => setAddMemberForm(prev => ({ ...prev, first_name: e.target.value }))}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Last Name</label>
                    <input
                      type="text"
                      value={addMemberForm.last_name}
                      onChange={e => setAddMemberForm(prev => ({ ...prev, last_name: e.target.value }))}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Email</label>
                    <input
                      type="email"
                      value={addMemberForm.email}
                      onChange={e => setAddMemberForm(prev => ({ ...prev, email: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Phone</label>
                    <input
                      type="tel"
                      value={addMemberForm.phone}
                      onChange={e => setAddMemberForm(prev => ({ ...prev, phone: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Date of Birth</label>
                    <input
                      type="date"
                      value={addMemberForm.dob}
                      onChange={e => setAddMemberForm(prev => ({ ...prev, dob: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Membership Type</label>
                    <input
                      type="text"
                      value={addMemberForm.membership}
                      onChange={e => setAddMemberForm(prev => ({ ...prev, membership: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async e => {
                        const file = e.target.files[0];
                        if (file) {
                          const url = await handlePhotoUpload(file);
                          if (url) {
                            setAddMemberForm(prev => ({ ...prev, photo: url }));
                          }
                        }
                      }}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddMemberModal(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#e5e1d8',
                      color: '#555',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#a59480',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Add Member
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Member Modal */}
        {editingMemberId && (
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
              width: '90%',
              maxWidth: '500px',
            }}>
              <h3 style={{ marginBottom: '1.5rem', color: '#333' }}>Edit Member</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                await handleSaveEditMember();
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>First Name</label>
                    <input
                      type="text"
                      value={editMemberForm.first_name || ''}
                      onChange={e => setEditMemberForm(prev => ({ ...prev, first_name: e.target.value }))}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Last Name</label>
                    <input
                      type="text"
                      value={editMemberForm.last_name || ''}
                      onChange={e => setEditMemberForm(prev => ({ ...prev, last_name: e.target.value }))}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Email</label>
                    <input
                      type="email"
                      value={editMemberForm.email || ''}
                      onChange={e => setEditMemberForm(prev => ({ ...prev, email: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Phone</label>
                    <input
                      type="tel"
                      value={editMemberForm.phone || ''}
                      onChange={e => setEditMemberForm(prev => ({ ...prev, phone: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Date of Birth</label>
                    <input
                      type="date"
                      value={editMemberForm.dob || ''}
                      onChange={e => setEditMemberForm(prev => ({ ...prev, dob: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Membership Type</label>
                    <input
                      type="text"
                      value={editMemberForm.membership || ''}
                      onChange={e => setEditMemberForm(prev => ({ ...prev, membership: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async e => {
                        const file = e.target.files[0];
                        if (file) {
                          const url = await handlePhotoUpload(file, false);
                          if (url && editingMemberId) {
                            await supabase.from('members').update({ photo: url }).eq('member_id', editingMemberId);
                            setEditMemberForm(form => ({ ...form, photo: url }));
                            setMembers(ms => ms.map(m => m.member_id === editingMemberId ? { ...m, photo: url } : m));
                          }
                        }
                      }}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    {editMemberForm.photo && (
                      <img src={editMemberForm.photo} alt="Photo" className="member-photo" style={{ marginTop: '0.5rem', width: '120px' }} />
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleCancelEditMember}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#e5e1d8',
                      color: '#555',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#a59480',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Hamburger button for mobile */}
        {isMobile && (
          <button
            className={sidebarOpen ? "hamburger open" : "hamburger"}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            style={{
              position: "fixed",
              top: "1.5rem",
              right: "10.5rem",
              width: "3rem",
              height: "3rem",
              minWidth: "3rem",
              minHeight: "3rem",
              maxWidth: "3rem",
              maxHeight: "3rem",
              zIndex: 2002,
              background: "#fff",
              border: "1.5px solid #e2dfd8",
              borderRadius: "50%",
              display: "flex",
              alignItems: "right",
              justifyContent: "right",
              fontSize: "1.7rem",
              boxShadow: "0 2px 8px rgba(0,0,0,0.09)",
              cursor: "pointer",
              transition: "background 0.2s"
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "2rem", lineHeight: 1 }}>&#9776;</span>
          </button>
        )}
        {/* Sidebar overlay and sidebar for mobile */}
        {isMobile && sidebarOpen && (
          <>
            {/* Overlay */}
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(44, 41, 38, 0.36)",
                zIndex: 2000,
                transition: "opacity 0.2s",
              }}
              aria-label="Close sidebar"
              tabIndex={0}
              role="button"
            />
            {/* Sidebar */}
            <div
              className="sidebar-nav open"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "80vw",
                maxWidth: 280,
                minWidth: 180,
                height: "100vh",
                background: "#f3f2ef",
                boxShadow: "2px 0 16px rgba(40,40,40,0.13)",
                zIndex: 2001,
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                padding: "1.25rem 1rem 2rem 1rem",
                boxSizing: "border-box",
                transition: "transform 0.22s cubic-bezier(.6,.2,.2,1)",
                transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: "#fff",
                  border: "1.5px solid #e2dfd8",
                  color: "#353535",
                  alignSelf: "flex-end",
                  fontSize: "2rem",
                  marginBottom: "1.5rem",
                  cursor: "pointer",
                  padding: 0,
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                }}
                aria-label="Close navigation"
              >
                &times;
              </button>
              <button
                className={section === 'members' ? 'nav-active' : ''}
                onClick={() => {
                  setSection('members');
                  setSelectedMember(null);
                  setSidebarOpen(false);
                }}
              >
                Members
              </button>
              <button
                className={section === 'admin' ? 'nav-active' : ''}
                onClick={() => {
                  setSection('admin');
                  setSidebarOpen(false);
                }}
              >
                Admin
              </button>
              <button
                className={section === 'lookup' ? 'nav-active' : ''}
                onClick={() => {
                  setSection('lookup');
                  setSidebarOpen(false);
                }}
              >
                Lookup
              </button>
              <button
                className={section === 'makeReservation' ? 'nav-active' : ''}
                onClick={() => {
                  setSection('makeReservation');
                  setSidebarOpen(false);
                }}
              >
                Make Reservation
              </button>
              <button
                className={section === 'calendar' ? 'nav-active' : ''}
                onClick={() => {
                  setSection('calendar');
                  setSidebarOpen(false);
                }}
              >
                Calendar
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.reload();
                  setSidebarOpen(false);
                }}
              >
                Log Out
              </button>
            </div>
          </>
        )}
        {/* Desktop sidebar */}
        {!isMobile && (
          <div className="sidebar-nav" style={{
            minWidth: 210,
            width: 210,
            background: "#f3f2ef",
            borderRight: "1.5px solid #e2dfd8",
            minHeight: "100vh",
            padding: "2rem 1rem 2rem 1.5rem",
            boxSizing: "border-box",
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}>
            <button
              className={section === 'members' ? 'nav-active' : ''}
              onClick={() => {
                setSection('members');
                setSelectedMember(null);
              }}
            >
              Members
            </button>
            <button
              className={section === 'admin' ? 'nav-active' : ''}
              onClick={() => {
                setSection('admin');
              }}
            >
              Admin
            </button>
            <button
              className={section === 'lookup' ? 'nav-active' : ''}
              onClick={() => {
                setSection('lookup');
              }}
            >
              Lookup
            </button>
            <button
              className={section === 'makeReservation' ? 'nav-active' : ''}
              onClick={() => setSection('makeReservation')}
            >
              Make Reservation
            </button>
            <button
              className={section === 'calendar' ? 'nav-active' : ''}
              onClick={() => setSection('calendar')}
            >
              Calendar
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
            >
              Log Out
            </button>
          </div>
        )}
        <div
          className="app-container"
          style={{
            marginLeft: isMobile ? 0 : 220,
            padding: isMobile ? "1rem" : "2.5rem",
            minHeight: "100vh",
            background: "#f8f7f4",
            maxWidth: "90%",
            width: "90%",
            overflowX: "hidden"
          }}
        >
          {section === 'members' && (
            <>
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
          {section === 'admin' && (
            <>
              <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
                <h2>Current Venue Hours</h2>
                <div style={{ marginBottom: "1rem" }}>
                  {baseHours.map(hour => (
                    <div key={hour.day_of_week} style={{ marginBottom: "0.5rem" }}>
                      <strong>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][hour.day_of_week]}:</strong>{' '}
                      {hour.time_ranges.map((range, idx) => (
                        <span key={idx}>
                          {range.start} - {range.end}
                          {idx < hour.time_ranges.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
                <h2>Calendar Availability Control</h2>
                <CalendarAvailabilityControl />
              </div>

              <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
                <h2>Create New User</h2>
                <form onSubmit={handleCreateUser} style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                  <input
                    type="email"
                    placeholder="User email"
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    required
                    style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "4px", border: "1px solid #ccc", width: "250px" }}
                  />
                  <input
                    type="text"
                    placeholder="Name (optional)"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "4px", border: "1px solid #ccc", width: "200px" }}
                  />
                  <button type="submit" style={{ padding: "0.5rem 1.5rem", background: "#a59480", color: "#fff", border: "none", borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}>
                    Create User
                  </button>
                </form>
                {createStatus && <div style={{ marginTop: "0.5rem", color: "#353535", fontWeight: 600 }}>{createStatus}</div>}
              </div>
              <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
                <h2>Promote User to Admin</h2>
                <form onSubmit={handlePromote} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <input
                    type="email"
                    placeholder="User email"
                    value={promoteEmail}
                    onChange={e => setPromoteEmail(e.target.value)}
                    required
                    style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "4px", border: "1px solid #ccc", width: "250px" }}
                  />
                  <button type="submit" style={{ padding: "0.5rem 1.5rem", background: "#a59480", color: "#fff", border: "none", borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}>
                    Promote
                  </button>
                </form>
                {promoteStatus && <div style={{ marginTop: "1rem", color: "#353535", fontWeight: 600 }}>{promoteStatus}</div>}
              </div>
              {/* User Management Panel */}
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
                            <button onClick={handleCancelEdit}>Cancel</button>
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
              </div>
              <div>
                <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
                  <h2>Promote User to Admin</h2>
                  <form onSubmit={handlePromote} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <input
                      type="email"
                      placeholder="User email"
                      value={promoteEmail}
                      onChange={e => setPromoteEmail(e.target.value)}
                      required
                      style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "4px", border: "1px solid #ccc", width: "250px" }}
                    />
                    <button type="submit" style={{ padding: "0.5rem 1.5rem", background: "#a59480", color: "#fff", border: "none", borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}>
                      Promote
                    </button>
                  </form>
                  {promoteStatus && <div style={{ marginTop: "1rem", color: "#353535", fontWeight: 600 }}>{promoteStatus}</div>}
                </div>
              </div>
            </>
          )}
          {section === 'lookup' && (
            <div style={{ padding: '2rem', maxWidth: "100vw", width: "100%" }}>
              <h2>Member Lookup</h2>
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
                        setSection('members');
                      }}
                      tabIndex={0}
                      role="button"
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedMember(member);
                          fetchLedger(member.account_id);
                          setSection('members');
                        }
                      }}
                    >
                      {editingMemberId === member.member_id ? (
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            handleSaveEditMember();
                          }}
                          style={{ width: "100%" }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <label>
                              First Name:
                              <input value={editMemberForm.first_name || ""} onChange={e => setEditMemberForm({ ...editMemberForm, first_name: e.target.value })} />
                            </label>
                            <label>
                              Last Name:
                              <input value={editMemberForm.last_name || ""} onChange={e => setEditMemberForm({ ...editMemberForm, last_name: e.target.value })} />
                            </label>
                            <label>
                              Email:
                              <input value={editMemberForm.email || ""} onChange={e => setEditMemberForm({ ...editMemberForm, email: e.target.value })} />
                            </label>
                            <label>
                              Phone:
                              <input value={editMemberForm.phone || ""} onChange={e => setEditMemberForm({ ...editMemberForm, phone: e.target.value })} />
                            </label>
                            <label>
                              Date of Birth:
                              <input value={editMemberForm.dob || ""} onChange={e => setEditMemberForm({ ...editMemberForm, dob: e.target.value })} />
                            </label>
                            <label>
                              Membership:
                              <input value={editMemberForm.membership || ""} onChange={e => setEditMemberForm({ ...editMemberForm, membership: e.target.value })} />
                            </label>
                            <label>
                              Photo:
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async e => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const url = await handlePhotoUpload(file, false);
                                    if (url && editingMemberId) {
                                      await supabase.from('members').update({ photo: url }).eq('member_id', editingMemberId);
                                      setEditMemberForm(form => ({ ...form, photo: url }));
                                      setMembers(ms => ms.map(m => m.member_id === editingMemberId ? { ...m, photo: url } : m));
                                    }
                                  }
                                }}
                              />
                              {editMemberForm.photo && (
                                <img src={editMemberForm.photo} alt="Photo" className="member-photo" style={{ marginTop: "0.5rem", width: "120px" }} />
                              )}
                            </label>
                          </div>
                          <div style={{ marginTop: "0.5rem" }}>
                            <button type="submit" style={{ marginRight: "0.5rem" }}>Save</button>
                            <button type="button" onClick={handleCancelEditMember}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
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
                        </>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
          {/* SPLIT: Make Reservation and Calendar tabs */}
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
                      minDate={new Date()}
                      className="form-control"
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
          {section === 'calendar' && (
            <div style={{ padding: '2rem', maxWidth: '100vw', width: '90%' }}>
              <h2>Seating Calendar</h2>
              <FullCalendarTimeline reloadKey={reloadKey} />
              {eventInfo && (
                <div style={{ marginTop: '1rem' }}>
                  <p>Event/Reservation ID: {eventInfo.id}</p>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Next Available Time Popup - always visible if set */}
        {nextAvailableTime && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: '2rem', borderRadius: '12px', maxWidth: 400, textAlign: 'center' }}>
              <h3>No table available at your requested time</h3>
              <p>The next available time for your party size is:</p>
              <p style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{new Date(nextAvailableTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</p>
              <button onClick={() => setNextAvailableTime(null)} style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem', background: '#4a90e2', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem' }}>OK</button>
            </div>
          </div>
        )}
      </>
    );
  }
}

export default App;