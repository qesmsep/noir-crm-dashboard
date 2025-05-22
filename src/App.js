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
  async function fetchLedger(memberId) {
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/ledger?member_id=${encodeURIComponent(memberId)}`);
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
  async function handleAddTransaction(memberId) {
    setTransactionStatus('');
    if (!newTransaction.amount || isNaN(Number(newTransaction.amount))) {
      setTransactionStatus('Enter a valid amount.');
      return;
    }
    setLedgerLoading(true);
    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          type: newTransaction.type,
          amount: Number(newTransaction.amount),
          note: newTransaction.note,
          date: newTransaction.date || undefined
        })
      });
      const result = await res.json();
      if (res.ok && result.data) {
        setTransactionStatus('Transaction added!');
        // Optimistically add the new transaction to the ledger
        setMemberLedger(prev => [...prev, result.data]);
        setNewTransaction({ type: 'payment', amount: '', note: '' });
        // Recompute balance from the optimistically updated ledger
        const balance = [...memberLedger, result.data].reduce(
          (acc, t) => acc + Number(t.amount),
          0
        );
        setMembers(ms => ms.map(m => m.id === memberId ? { ...m, balance } : m));
        // Re-fetch the ledger in the background to ensure consistency
        fetchLedger(memberId);
      } else {
        setTransactionStatus('Failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      setTransactionStatus('Failed: ' + err.message);
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
    setEditingMemberId(member.id);
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
    const { id, ...fields } = editMemberForm;
    const { error } = await supabase.from('members').update(fields).eq('id', editingMemberId);
    if (!error) {
      setMembers(members.map(m => m.id === editingMemberId ? { ...m, ...fields } : m));
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
            member_id: member.id,
            supabase_user_id: member.supabase_user_id,
            requester_token: session.access_token
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setMembers(members.filter(m => m.id !== member.id));
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
          await supabase.from('members').update({ photo2: url }).eq('id', editingMemberId);
          setEditMemberForm(form => ({ ...form, photo2: url }));
          setMembers(ms => ms.map(m => m.id === editingMemberId ? { ...m, photo2: url } : m));
          setSelectedMember(sel => sel && sel.id === editingMemberId ? { ...sel, photo2: url } : sel);
        } else {
          // Update photo
          await supabase.from('members').update({ photo: url }).eq('id', editingMemberId);
          setEditMemberForm(form => ({ ...form, photo: url }));
          setMembers(ms => ms.map(m => m.id === editingMemberId ? { ...m, photo: url } : m));
          setSelectedMember(sel => sel && sel.id === editingMemberId ? { ...sel, photo: url } : sel);
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

    return (
      <>
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
            maxWidth: "100vw",
            width: "90%",
            overflowX: "hidden"
          }}
        >
          {section === 'members' && (
            <>
              {!selectedMember ? (
                <>
                  <h1 className="app-title">Noir CRM – Members</h1>
                  <ul className="member-list">
                    {members.map(member => (
                      <li
                        key={member.id}
                        className="member-item"
                        style={{ position: "relative", cursor: "pointer" }}
                        onClick={() => {
                          setSelectedMember(member);
                          fetchLedger(member.id);
                        }}
                      >
                        {editingMemberId === member.id ? (
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
                                Balance:
                                <input value={editMemberForm.balance || ""} onChange={e => setEditMemberForm({ ...editMemberForm, balance: e.target.value })} />
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
                                        // Update in Supabase
                                        await supabase.from('members').update({ photo: url }).eq('id', editingMemberId);
                                        // Update local form state
                                        setEditMemberForm(form => ({ ...form, photo: url }));
                                        // Update members array
                                        setMembers(ms => ms.map(m => m.id === editingMemberId ? { ...m, photo: url } : m));
                                        // Update selectedMember if needed
                                        setSelectedMember(sel => sel && sel.id === editingMemberId ? { ...sel, photo: url } : sel);
                                      }
                                    }
                                  }}
                                />
                                {editMemberForm.photo && (
                                  <img src={editMemberForm.photo} alt="Photo" className="member-photo" style={{ marginTop: "0.5rem", width: "120px" }} />
                                )}
                              </label>
                              <label>
                                Counterpart First Name:
                                <input value={editMemberForm.first_name2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, first_name2: e.target.value })} />
                              </label>
                              <label>
                                Counterpart Last Name:
                                <input value={editMemberForm.last_name2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, last_name2: e.target.value })} />
                              </label>
                              <label>
                                Counterpart Email:
                                <input value={editMemberForm.email2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, email2: e.target.value })} />
                              </label>
                              <label>
                                Counterpart Phone:
                                <input value={editMemberForm.phone2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, phone2: e.target.value })} />
                              </label>
                              <label>
                                Counterpart Company:
                                <input value={editMemberForm.company2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, company2: e.target.value })} />
                              </label>
                              <label>
                                Counterpart Photo:
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async e => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      const url = await handlePhotoUpload(file, true);
                                      if (url && editingMemberId) {
                                        // Update in Supabase
                                        await supabase.from('members').update({ photo2: url }).eq('id', editingMemberId);
                                        // Update local form state
                                        setEditMemberForm(form => ({ ...form, photo2: url }));
                                        // Update members array
                                        setMembers(ms => ms.map(m => m.id === editingMemberId ? { ...m, photo2: url } : m));
                                        // Update selectedMember if needed
                                        setSelectedMember(sel => sel && sel.id === editingMemberId ? { ...sel, photo2: url } : sel);
                                      }
                                    }
                                  }}
                                />
                                {editMemberForm.photo2 && (
                                  <img src={editMemberForm.photo2} alt="Counterpart Photo" className="member-photo" style={{ marginTop: "0.5rem", width: "120px" }} />
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
                                {member.first_name} {member.last_name} — {member.membership}
                              </strong>
                              
                              <div>Phone: {formatPhone(member.phone)}</div>
                              <div>Email: {member.email}</div>
                              <div>Date of Birth: {formatDOB(member.dob)}</div>
                            </div>
                            {member.first_name2 && (
                              <div className="member-counterpart">
                                {member.photo2 && (
                                  <img
                                    src={member.photo2}
                                    alt={`${member.first_name2} ${member.last_name2}`}
                                    className="member-photo"
                                  />
                                )}
                                <strong>
                                  {member.first_name2} {member.last_name2}
                                </strong>
                                <div>Email: {member.email2}</div>
                                <div>Phone: {formatPhone(member.phone2)}</div>
                                <div>Company: {member.company2}</div>
                              </div>
                            )}
                            {/* Edit button removed from member card */}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
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
                    overflowX: "hidden"
                  }}
                >
                  {/* Use MemberDetail component if available */}
                  <Elements stripe={stripePromise}>
                    <MemberDetail
                      member={selectedMember}
                      ledger={memberLedger}
                      ledgerLoading={ledgerLoading}
                      onBack={() => setSelectedMember(null)}
                      onAddTransaction={() => handleAddTransaction(selectedMember.id)}
                      newTransaction={newTransaction}
                      setNewTransaction={setNewTransaction}
                      transactionStatus={transactionStatus}
                      session={session}
                      setMemberLedger={setMemberLedger}
                      fetchLedger={fetchLedger}
                      selectedMember={selectedMember}
                    />
                  </Elements>
                </div>
              )}
            </>
          )}
          {section === 'admin' && (
            <>
              <h2>Reservations & Events Calendar</h2>
              <CalendarView
                onSelectSlot={(slot) => setSlotInfo(slot)}
                onSelectEvent={(event) => setEventInfo(event)}
              />
              {slotInfo && (
                <div>
                  <p>Selected slot: {slotInfo.start.toString()} - {slotInfo.end.toString()}</p>
                  {/* You can replace this with a ReservationForm modal */}
                </div>
              )}
              {eventInfo && (
                <div>
                  <p>Selected event/reservation ID: {eventInfo.id}</p>
                </div>
              )}
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
          {/* Reminder Settings Panel */}
          <div className="admin-panel">
            <h2>Reminder Settings</h2>
            <label>
              Send reminder at hour (0-23):
              <input
                type="number"
                value={reminderHour}
                onChange={e => setReminderHour(e.target.value)}
                style={{ width: '4rem', marginLeft: '0.5rem' }}
              />
            </label>
            <button onClick={async () => {
              await fetch('/api/reminderSettings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hour: reminderHour })
              });
              alert('Updated');
            }}>
              Save
            </button>
          </div>
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--color-daybreak)', paddingTop: '1.5rem' }}>
            <h2>Send Custom Email</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '600px' }}>
              <input
                type="text"
                placeholder="Recipient (comma-separated)"
                value={customEmailTo}
                onChange={e => setCustomEmailTo(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-greige)' }}
              />
              <input
                type="text"
                placeholder="Subject"
                value={customEmailSubject}
                onChange={e => setCustomEmailSubject(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-greige)' }}
              />
              <textarea
                rows={4}
                placeholder="Message body"
                value={customEmailBody}
                onChange={e => setCustomEmailBody(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-greige)', resize: 'vertical' }}
              />
              <button
                onClick={async () => {
                  const res = await fetch('/api/sendCustomEmail', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: customEmailTo, subject: customEmailSubject, text: customEmailBody })
                  });
                  const json = await res.json();
                  alert(json.error ? 'Error: ' + json.error : 'Email sent successfully');
                }}
                style={{ padding: '0.6rem 1.2rem', background: 'var(--color-cork)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '0.5rem' }}
              >
                Send Email
              </button>
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
                      key={member.id}
                      className="member-item"
                      style={{ position: "relative", cursor: "pointer", width: "100%" }}
                      onClick={() => {
                        setSelectedMember(member);
                        fetchLedger(member.id);
                        setSection('members');
                      }}
                      tabIndex={0}
                      role="button"
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedMember(member);
                          fetchLedger(member.id);
                          setSection('members');
                        }
                      }}
                    >
                      {editingMemberId === member.id ? (
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
                              Balance:
                              <input value={editMemberForm.balance || ""} onChange={e => setEditMemberForm({ ...editMemberForm, balance: e.target.value })} />
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
                                      await supabase.from('members').update({ photo: url }).eq('id', editingMemberId);
                                      setEditMemberForm(form => ({ ...form, photo: url }));
                                      setMembers(ms => ms.map(m => m.id === editingMemberId ? { ...m, photo: url } : m));
                                      setSelectedMember(sel => sel && sel.id === editingMemberId ? { ...sel, photo: url } : sel);
                                    }
                                  }
                                }}
                              />
                              {editMemberForm.photo && (
                                <img src={editMemberForm.photo} alt="Photo" className="member-photo" style={{ marginTop: "0.5rem", width: "120px" }} />
                              )}
                            </label>
                            <label>
                              Counterpart First Name:
                              <input value={editMemberForm.first_name2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, first_name2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Last Name:
                              <input value={editMemberForm.last_name2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, last_name2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Email:
                              <input value={editMemberForm.email2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, email2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Phone:
                              <input value={editMemberForm.phone2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, phone2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Company:
                              <input value={editMemberForm.company2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, company2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Photo:
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async e => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const url = await handlePhotoUpload(file, true);
                                    if (url && editingMemberId) {
                                      await supabase.from('members').update({ photo2: url }).eq('id', editingMemberId);
                                      setEditMemberForm(form => ({ ...form, photo2: url }));
                                      setMembers(ms => ms.map(m => m.id === editingMemberId ? { ...m, photo2: url } : m));
                                      setSelectedMember(sel => sel && sel.id === editingMemberId ? { ...sel, photo2: url } : sel);
                                    }
                                  }
                                }}
                              />
                              {editMemberForm.photo2 && (
                                <img src={editMemberForm.photo2} alt="Counterpart Photo" className="member-photo" style={{ marginTop: "0.5rem", width: "120px" }} />
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
                              {member.first_name} {member.last_name} — {member.membership}
                            </strong>
                            
                            <div>Phone: {formatPhone(member.phone)}</div>
                            <div>Email: {member.email}</div>
                            <div>Date of Birth: {formatDOB(member.dob)}</div>
                          </div>
                          {member.first_name2 && (
                            <div className="member-counterpart">
                              {member.photo2 && (
                                <img
                                  src={member.photo2}
                                  alt={`${member.first_name2} ${member.last_name2}`}
                                  className="member-photo"
                                />
                              )}
                              <strong>
                                {member.first_name2} {member.last_name2}
                              </strong>
                              <div>Email: {member.email2}</div>
                              <div>Phone: {formatPhone(member.phone2)}</div>
                              <div>Company: {member.company2}</div>
                            </div>
                          )}
                          {/* Edit button removed from member card */}
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
              // Check for member by phone
              const res = await fetch(`/api/checkMemberByPhone?phone=${encodeURIComponent(phone)}`);
              const data = await res.json();
              if (data.member) {
                // Member found, use their info
                await createReservation({
                  name: `${data.member.first_name} ${data.member.last_name}`,
                  phone: data.member.phone,
                  email: data.member.email,
                  party_size: partySize,
                  notes: '',
                  start_time: getStartTime(),
                  end_time: getEndTime(),
                  source: 'member'
                });
                setMemberLookup(data.member);
                setNonMemberFields({ firstName: '', lastName: '', email: '' });
              } else {
                // No member found, prompt for info if not already entered
                setMemberLookup(null);
                if (!nonMemberFields.firstName || !nonMemberFields.lastName || !nonMemberFields.email) {
                  setReserveStatus('Please enter first name, last name, and email for non-members.');
                  return;
                }
                await createReservation({
                  name: `${nonMemberFields.firstName} ${nonMemberFields.lastName}`.trim(),
                  phone,
                  email: nonMemberFields.email,
                  party_size: partySize,
                  notes: '',
                  start_time: getStartTime(),
                  end_time: getEndTime(),
                  source: 'public_widget'
                });
                setNonMemberFields({ firstName: '', lastName: '', email: '' });
              }
              setReloadKey(k => k + 1);
              setPhone('');
              setFirstName('');
              setLastName('');
              setPartySize(1);
              setTime('18:00');
              setReserveStatus('Reservation confirmed!');
            }

            function getStartTime() {
              const [hh, mm] = time.split(':');
              const start = new Date(date);
              start.setHours(Number(hh), Number(mm), 0, 0);
              return start.toISOString();
            }
            function getEndTime() {
              const [hh, mm] = time.split(':');
              const start = new Date(date);
              start.setHours(Number(hh), Number(mm), 0, 0);
              const duration = partySize <= 2 ? 90 : 120;
              const end = new Date(start.getTime() + duration * 60000);
              return end.toISOString();
            }

            async function createReservation(payload) {
              const res = await fetch('/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const result = await res.json();
              if (!res.ok) {
                alert(result.error || 'Reservation failed');
                throw new Error(result.error || 'Reservation failed');
              }
            }

            return (
              <div style={{ padding: '2rem', maxWidth: 650, margin: '0 auto' }}>
                <div style={{ flex: 1, background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  <h2 style={{ marginBottom: '1rem' }}>Reserve On The Spot</h2>
                  <div style={{ marginBottom: '1rem' }}>
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
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
                    />
                  </div>
                  {/* Show non-member fields if no member found and phone is entered */}
                  {memberLookup === null && phone && (
                    <>
                      <div style={{ marginBottom: '1rem' }}>
                        <label>First Name</label>
                        <input
                          type="text"
                          placeholder="First name"
                          value={nonMemberFields.firstName}
                          onChange={e => setNonMemberFields(f => ({ ...f, firstName: e.target.value }))}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
                        />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label>Last Name</label>
                        <input
                          type="text"
                          placeholder="Last name"
                          value={nonMemberFields.lastName}
                          onChange={e => setNonMemberFields(f => ({ ...f, lastName: e.target.value }))}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
                        />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label>Email</label>
                        <input
                          type="email"
                          placeholder="Email"
                          value={nonMemberFields.email}
                          onChange={e => setNonMemberFields(f => ({ ...f, email: e.target.value }))}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
                        />
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <label>Party size</label>
                    <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))}>−</button>
                    <span>{partySize}</span>
                    <button type="button" onClick={() => setPartySize(partySize + 1)}>+</button>
                  </div>
                  <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label>Date</label>
                      <DatePicker
                        selected={date}
                        onChange={d => setDate(d)}
                        dateFormat="MMMM d, yyyy"
                        minDate={new Date()}
                        filterDate={d => [4,5,6].includes(d.getDay())}
                        className="datepicker-input"
                      />
                    </div>
                    <div>
                      <label>Time</label>
                      <select
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
                      >
                        {times.map(t => (
                          <option key={t} value={t}>
                            {new Date(`1970-01-01T${t}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleReserveNow}
                    style={{ width: '100%', padding: '0.75rem', background: '#4a90e2', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem' }}
                  >
                    Reserve Now
                  </button>
                  {reserveStatus && <div style={{ marginTop: '1rem', color: reserveStatus.includes('confirmed') ? 'green' : 'red' }}>{reserveStatus}</div>}
                </div>
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
      </>
    );
  }
}

export default App;