import React, { useState, useEffect } from 'react';

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
  onDeleteMember,
}) => {
  const [linkingStripe, setLinkingStripe] = useState(false);
  const [linkResult, setLinkResult] = useState(null);
  const [stripeData, setStripeData] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState(null);

  if (!member) return null;
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
        // Optionally reload member info here if needed
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
        .catch((err) => {
          setStripeError('Error fetching Stripe info');
          setStripeLoading(false);
        });
    }
  }, [member?.stripe_customer_id]);

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

  return (
    <div className="member-detail-container">
      <button onClick={onBack}>Back to List</button>
      <h2>Member Details</h2>
      <div>
        <strong>Name:</strong> {member.name}
      </div>
      <div>
        <strong>Email:</strong> {member.email}
      </div>
      <div>
        <strong>Phone:</strong> {formatPhoneNumber(member.phone)}
      </div>
      {member.dob && (
        <div>
          <strong>Birthdate:</strong> {formatDateLong(member.dob)}
        </div>
      )}
      <div>
        <strong>Joined:</strong> {member.joined}
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
      {ledgerLoading ? (
        <div>Loading ledger...</div>
      ) : (
        <table>
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
                  <td>{tx.date}</td>
                  <td>{tx.description}</td>
                  <td>{tx.amount}</td>
                  <td>{tx.type}</td>
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
      <form
        onSubmit={e => {
          e.preventDefault();
          onAddTransaction();
        }}
      >
        <input
          type="text"
          name="description"
          placeholder="Description"
          value={newTransaction.description || ''}
          onChange={handleInputChange}
        />
        <input
          type="number"
          name="amount"
          placeholder="Amount"
          value={newTransaction.amount || ''}
          onChange={handleInputChange}
        />
        <select
          name="type"
          value={newTransaction.type || ''}
          onChange={handleInputChange}
        >
          <option value="">Type</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <button type="submit" disabled={transactionStatus === 'loading'}>
          {transactionStatus === 'loading' ? 'Adding...' : 'Add'}
        </button>
        {transactionStatus === 'error' && (
          <span style={{ color: 'red', marginLeft: 8 }}>Error adding transaction.</span>
        )}
        {transactionStatus === 'success' && (
          <span style={{ color: 'green', marginLeft: 8 }}>Added!</span>
        )}
    </form>
    <button
      style={{
        background: '#e74c3c',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '6px',
        marginTop: '32px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1.1rem'
      }}
      onClick={() => {
        if (window.confirm('Are you sure you want to delete this member? This cannot be undone.')) {
          if (typeof onDeleteMember === 'function') {
            onDeleteMember(member.id);
          }
        }
      }}
    >
      Delete Member
    </button>
  </div>
  );
};

export default MemberDetail;