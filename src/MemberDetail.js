import './App.css';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);


const MemberDetail = ({
  member,
  ledger,
  ledgerLoading,
  onBack,
  onAddTransaction,
  newTransaction,
  setNewTransaction,
  transactionStatus,
  session,
  setMemberLedger,
  fetchLedger,
  selectedMember,
}) => {
  // All hooks must be at the top, before any return
  const [linkingStripe, setLinkingStripe] = useState(false);
  const [linkResult, setLinkResult] = useState(null);
  const [stripeData, setStripeData] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState(null);
  // Removed Stripe hooks for saving payment method
  const [charging, setCharging] = useState(false);
  const [chargeStatus, setChargeStatus] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editTransactionForm, setEditTransactionForm] = useState({
    note: '',
    amount: '',
    type: '',
    date: ''
  });

  // Member attributes and notes (API-driven)
  const [attributes, setAttributes] = useState([]);
  const [notes, setNotes] = useState('');
  const [notesLog, setNotesLog] = useState([]);
  // State for adding attributes
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  // Load attributes from API
  const fetchAttributes = async () => {
    const res = await fetch(`/api/member_attributes?member_id=${member.member_id}`);
    const { data } = await res.json();
    setAttributes(data || []);
  };
  // Load notes history
  const fetchNotesLog = async () => {
    const res = await fetch(`/api/member_notes?member_id=${member.member_id}`);
    const { data } = await res.json();
    setNotesLog(data || []);
  };
  useEffect(() => {
    if (member?.member_id) {
      fetchAttributes();
      fetchNotesLog();
    }
  }, [member?.member_id]);

  const handleSaveAttributes = async () => {
    for (const attr of attributes) {
      await fetch('/api/member_attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.member_id, key: attr.key, value: attr.value }),
      });
    }
    alert('Attributes saved');
    fetchAttributes();
  };

  const handleAddNote = async () => {
    if (!notes.trim()) return;
    await fetch('/api/member_notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: member.member_id, note: notes }),
    });
    setNotes(''); // clear input
    fetchNotesLog();
  };

  // Add single attribute
  const handleAddAttribute = async () => {
    if (!newAttrKey || !newAttrValue) return;
    await fetch('/api/member_attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: member.member_id, key: newAttrKey, value: newAttrValue }),
    });
    setNewAttrKey('');
    setNewAttrValue('');
    fetchAttributes();
  };
  // Edit or delete attribute via prompt
  const handleEditAttribute = async (attr) => {
    const input = prompt(
      `Attribute "${attr.key}": enter new value or type "delete" to remove`,
      attr.value
    );
    if (input == null) return;
    if (input.toLowerCase() === 'delete') {
      return handleDeleteAttribute(attr);
    }
    await fetch('/api/member_attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: member.member_id, key: attr.key, value: input }),
    });
    fetchAttributes();
  };

  // Delete existing attribute
  const handleDeleteAttribute = async (attr) => {
    if (!window.confirm(`Delete attribute "${attr.key}"?`)) return;
    await supabase
      .from('member_attributes')
      .delete()
      .eq('member_id', attr.member_id);
    fetchAttributes();
  };
  // Edit existing note
  const handleEditNote = async (noteObj) => {
    const updated = prompt('Edit note', noteObj.note);
    if (updated != null) {
      await fetch('/api/member_notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.member_id, note: updated, id: noteObj.id }),
      });
      fetchNotesLog();
    }
  };

  // Link member to Stripe
  const handleLinkStripe = async () => {
    setLinkingStripe(true);
    setLinkResult(null);
    try {
      const response = await fetch('/api/linkStripeCustomer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: member.member_id,
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setLinkResult({ status: 'success', stripeId: result.stripe_customer.id });
      } else {
        setLinkResult({ status: 'error', error: result.error });
      }
    } catch (err) {
      setLinkResult({ status: 'error', error: err.message });
    }
    setLinkingStripe(false);
  };

  useEffect(() => {
    if (member?.stripe_customer_id) {
      setStripeLoading(true);
      fetch('/api/getStripeCustomer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripe_customer_id: member.stripe_customer_id }),
      })
        .then((res) => res.json())
        .then((data) => {
          setStripeData(data);
          setStripeLoading(false);
        })
        .catch(() => {
          setStripeError('Error fetching Stripe info');
          setStripeLoading(false);
        });
    }
  }, [member?.stripe_customer_id]);

  if (!member) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTransaction({ ...newTransaction, [name]: value });
  };

  const formatDateLong = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date)) return null;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' });
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const trimmed = phone.replace(/\s+/g, '');
    let digits = trimmed.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
    }
    return phone.trim();
  };

  const handleDeleteMember = async (member_id, supabase_user_id) => {
    try {
      // Get session for access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated.');
        return;
      }
      const res = await fetch('/api/deleteAuthUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id,
          supabase_user_id,
          requester_token: session.access_token
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Member deleted.');
        if (typeof onBack === 'function') onBack();
      } else {
        alert('Failed to delete member: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Failed to delete member: ' + e.message);
    }
  };

  // Calculate next renewal based on join_date
  const nextRenewal = (() => {
    if (!member.join_date) return 'N/A';
    const jd = new Date(member.join_date);
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    const day = jd.getDate();
    let candidate = new Date(year, month, day);
    if (candidate < today) {
      if (month === 11) { year += 1; month = 0; }
      else { month += 1; }
      candidate = new Date(year, month, day);
    }
    return candidate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' });
  })();

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
          amount: editTransactionForm.type === 'purchase' ? 
            -Math.abs(Number(editTransactionForm.amount)) : 
            Math.abs(Number(editTransactionForm.amount))
        })
      });
      if (res.ok) {
        setEditingTransaction(null);
        // Refresh ledger
        if (member?.member_id) {
          const res = await fetch(`/api/ledger?member_id=${encodeURIComponent(member.member_id)}`);
          const result = await res.json();
          if (res.ok && result.data) {
            setMemberLedger(result.data || []);
          }
        }
      } else {
        alert('Failed to update transaction');
      }
    } catch (err) {
      alert('Error updating transaction: ' + err.message);
    }
  };

  return (
    <div className="member-detail-container">
      <div className="member-detail-card" style={{ position: 'relative' }}>
        <h2>Members</h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16, gap: '2rem' }}>
          {/* Primary Member */}
          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            {member.photo && (
              <img
                src={member.photo}
                alt="Primary Member"
                style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, marginRight: 20 }}
              />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: '0.25rem' }}>
                {member.first_name} {member.last_name}
              </div>
              {member.membership && (
                <div style={{ fontWeight: 400, fontSize: 16, color: '#7c6b58', marginBottom: '0.5rem' }}>
                  {member.membership}
                </div>
              )}
              {member.email && (
                <div>
                  Email: <a href={`mailto:${member.email}`}>{member.email}</a>
                </div>
              )}
              {member.phone && (
                <div>
                  Phone: <a href={`tel:${member.phone}`}>{formatPhoneNumber(member.phone)}</a>
                </div>
              )}
              {member.dob && <div style={{ whiteSpace: 'nowrap' }}>Birthday: {formatDateLong(member.dob)}</div>}
              {member.company && <div>Company: {member.company}</div>}
            </div>
          </div>
        </div>
        {/* Discreetly show member UUID at bottom right */}
        <div style={{ position: 'absolute', right: 16, bottom: 12, fontSize: '0.85rem', color: '#888', opacity: 0.6, userSelect: 'all' }}>
          Member UUID: {member.member_id}
        </div>
        {/* Referral and Renewal Block */}
        <div>
          <strong>Referred By:</strong> {member.referral || 'N/A'}
        </div>
        <div>
          <strong>Member Since:</strong> {member.join_date ? formatDateLong(member.join_date) : 'N/A'}
        </div>
        <div>
          <strong>Next Renewal:</strong> {nextRenewal}
        </div>

        {/* Attributes & Notes section (API-driven) */}
        <div className="add-transaction-panel">
          {/* Attributes */}
          <h3>Attributes</h3>
          {attributes.map((attr, i) => (
            <div key={i} className="attribute-item">
              <div className="attribute-info">
                <strong>{attr.key}:</strong> {attr.value}
              </div>
              <div className="attribute-actions">
                <button className="edit-attribute-btn" onClick={() => handleEditAttribute(attr)}>Edit</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              value={newAttrKey}
              onChange={e => setNewAttrKey(e.target.value)}
              className="add-transaction-input"
              placeholder="Attribute Type"
            />
            <input
              value={newAttrValue}
              onChange={e => setNewAttrValue(e.target.value)}
              className="add-transaction-input"
              placeholder="Attribute Detail"
            />
            <button onClick={handleAddAttribute} className="add-transaction-btn">Add</button>
          </div>

          {/* Notes */}
          <h3>Notes History</h3>
          <ul>
            {notesLog.map(n => (
              <li key={n.id} className="note-item">
                {formatDateLong(n.created_at)}: {n.note}
                <button className="edit-note-btn" onClick={() => handleEditNote(n)}>Edit</button>
              </li>
            ))}
          </ul>
          <div className="add-transaction-panel">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="add-transaction-input"
              placeholder="New note..."
              rows={2}
              style={{ minHeight: '60px', width: '100%' }}
            />
            <button onClick={handleAddNote} className="add-transaction-btn">Add Note</button>
          </div>
        </div>

        <button
          className="delete-member-btn"
          onClick={() => {
            if (window.confirm('Are you sure you want to delete this member? This cannot be undone.')) {
              handleDeleteMember(member.member_id, member.supabase_user_id);
            }
          }}
        >
          Delete Member
        </button>
      </div>
    </div>
  );
};

export default MemberDetail;