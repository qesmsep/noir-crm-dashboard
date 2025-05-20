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
}) => {
  // All hooks must be at the top, before any return
  const [linkingStripe, setLinkingStripe] = useState(false);
  const [linkResult, setLinkResult] = useState(null);
  const [stripeData, setStripeData] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState(null);
  const [charging, setCharging] = useState(false);
  const [chargeStatus, setChargeStatus] = useState(null);

  // Link member to Stripe
  const handleLinkStripe = async () => {
    setLinkingStripe(true);
    setLinkResult(null);
    try {
      const response = await fetch('/api/linkStripeCustomer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: member.id,
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
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
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

  // Compute current balance from ledger
  const balance = (ledger || []).reduce(
    (acc, t) => (t.type === 'payment' ? acc + Number(t.amount) : acc - Number(t.amount)),
    0
  );

  // Handler to charge outstanding balance via API
  const handleChargeBalance = async () => {
    setCharging(true);
    setChargeStatus(null);
    try {
      const res = await fetch('/api/chargeBalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChargeStatus('Charged successfully');
        onAddTransaction();
      } else {
        setChargeStatus(`Error: ${data.error || 'Charge failed'}`);
      }
    } catch (e) {
      setChargeStatus(`Error: ${e.message}`);
    }
    setCharging(false);
  };

  return (
    <div className="member-detail-container">
      <div className="member-detail-card">
        <button onClick={onBack}>Back to List</button>
        <h2>Primary Member</h2>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          {member.photo && (
            <img
              src={member.photo}
              alt="Member"
              style={{
                width: 120,
                height: 120,
                objectFit: 'cover',
                borderRadius: 8,
                marginRight: 20,
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 10 }}>STATUS</div>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 10 }}>
              <span
                className={`status-badge status-${(member.status || 'na').toLowerCase()}`}
                style={{
                  fontWeight: 400,
                  fontSize: 14,
                  padding: '2px 10px',
                  borderRadius: 8,
                  background:
                    member.status && member.status.toLowerCase() === 'active'
                      ? '#c2eacb'
                      : member.status && member.status.toLowerCase() === 'pending'
                      ? '#fff3cd'
                      : member.status && member.status.toLowerCase() === 'inactive'
                      ? '#f8d7da'
                      : '#ececec',
                  color:
                    member.status && member.status.toLowerCase() === 'active'
                      ? '#217a40'
                      : member.status && member.status.toLowerCase() === 'pending'
                      ? '#ad8608'
                      : member.status && member.status.toLowerCase() === 'inactive'
                      ? '#842029'
                      : '#353535',
                }}
              >
                {member.status || 'N/A'}
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>
                {member.first_name} {member.last_name}
                {member.membership && (
                  <span style={{ fontWeight: 400, fontSize: 16, marginLeft: 8, color: '#7c6b58' }}>
                    — {member.membership}
                  </span>
                )}
              </span>
            </div>
            <div style={{ fontSize: 15, color: '#353535' }}>
              {member.email && <div>Email: {member.email}</div>}
              {member.phone && (
                <div>
                  Phone:&nbsp;
                  <a
                    href={`tel:${member.phone}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {formatPhoneNumber(member.phone)}
                  </a>
                </div>
              )}
              {member.dob && <div>Date of Birth: {formatDateLong(member.dob)}</div>}
            </div>
          </div>
        </div>
        <div>
          <strong>Joined:</strong> {member.join_date ? formatDateLong(member.join_date) : 'N/A'}
        </div>
        <div>
          <strong>Stripe Customer ID:</strong>{' '}
          {member.stripe_customer_id ? (
            <span style={{ color: 'green' }}>{member.stripe_customer_id}</span>
          ) : (
            <>
              <span style={{ color: 'red' }}>Not linked</span>
              <button
                onClick={handleLinkStripe}
                disabled={linkingStripe}
                style={{ marginLeft: 8 }}
              >
                {linkingStripe ? 'Linking...' : 'Link to Stripe'}
              </button>
              {linkResult && linkResult.status === 'success' && (
                <span style={{ color: 'green', marginLeft: 8 }}>
                  Linked! Stripe ID: {linkResult.stripeId}
                </span>
              )}
              {linkResult && linkResult.status === 'error' && (
                <span style={{ color: 'red', marginLeft: 8 }}>
                  Error: {linkResult.error}
                </span>
              )}
            </>
          )}
        </div>
        <div>
          <h3>Stripe Subscription</h3>
          {stripeLoading ? (
            <div>Loading Stripe data...</div>
          ) : stripeError ? (
            <div style={{ color: 'red' }}>{stripeError}</div>
          ) : stripeData ? (
            <div>
              <div><strong>Status:</strong> {stripeData.status || 'N/A'}</div>
              <div><strong>Next Renewal:</strong> {stripeData.next_renewal || 'N/A'}</div>
              <div><strong>Last Payment:</strong> {stripeData.last_payment || 'N/A'}</div>
              <div><strong>Plan:</strong> {stripeData.plan || 'N/A'}</div>
            </div>
          ) : (
            <div>No Stripe data found.</div>
          )}
        </div>

        <h3>Ledger</h3>
        <div style={{ marginBottom: '1rem' }}>
          <strong>
            {balance < 0 ? 'Balance Due:' : 'Current Credit:'}
          </strong>{' '}
          ${Math.abs(balance).toFixed(2)}
          {session.user?.user_metadata?.role === 'admin' && member.stripe_customer_id && (
            <>
              <button
                onClick={handleChargeBalance}
                disabled={charging || balance >= 0}
                style={{ marginLeft: '1rem', padding: '0.5rem 1rem', cursor: balance < 0 ? 'pointer' : 'not-allowed' }}
              >
                {charging ? 'Charging...' : 'Charge Balance'}
              </button>
              {balance >= 0 && (
                <span style={{ marginLeft: '1rem', color: '#888' }}>
                  No outstanding balance to charge.
                </span>
              )}
            </>
          )}
          {chargeStatus && <span style={{ marginLeft: '1rem' }}>{chargeStatus}</span>}
        </div>
        {ledgerLoading ? (
          <div>Loading ledger...</div>
        ) : (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {ledger && ledger.length > 0 ? (
                ledger.map((tx, idx) => (
                  <tr key={tx.id || idx}>
                    <td>{formatDateLong(tx.date)}</td>
                    <td>{tx.note}</td>
                    <td>{tx.amount}</td>
                    <td>{tx.type === 'payment' ? 'Payment' : tx.type === 'purchase' ? 'Purchase' : tx.type}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <h3>Add Transaction</h3>
        <div className="add-transaction-panel">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (member && member.id) {
                onAddTransaction(member.id);
              } else {
                onAddTransaction();
              }
            }}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
          >
            <input
              type="text"
              name="note"
              placeholder="Note"
              value={newTransaction.note || ''}
              onChange={handleInputChange}
              className="add-transaction-input"
            />
            <input
              type="number"
              name="amount"
              placeholder="Amount"
              value={newTransaction.amount || ''}
              onChange={handleInputChange}
              className="add-transaction-input"
            />
            <select
              name="type"
              value={newTransaction.type || ''}
              onChange={handleInputChange}
              className="add-transaction-input"
            >
              <option value="">Type</option>
              <option value="payment">Payment</option>
              <option value="purchase">Purchase</option>
            </select>
            <button
              type="submit"
              className="add-transaction-btn"
              disabled={transactionStatus === 'loading'}
            >
              {transactionStatus === 'loading' ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>

        <button
          className="delete-member-btn"
        onClick={() => {
          if (window.confirm('Are you sure you want to delete this member? This cannot be undone.')) {
            handleDeleteMember(member.id, member.supabase_user_id);
          }
        }}
        >
          Delete Member
        </button>

        {/* Counterpart photo size adjustment (if applicable) */}
        {member.photo2 && (
          <img
            src={member.photo2}
            alt="Counterpart"
            style={{
              width: 200,
              height: 200,
              objectFit: 'cover',
              borderRadius: 8,
              marginTop: 20,
              marginBottom: 10,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default MemberDetail;