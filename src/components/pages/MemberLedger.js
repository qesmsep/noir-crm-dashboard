import React from 'react';

const MemberLedger = ({
  members,
  memberLedger,
  selectedMember,
  newTransaction,
  setNewTransaction,
  handleAddTransaction,
  transactionStatus,
  editingTransaction,
  setEditingTransaction,
  editTransactionForm,
  setEditTransactionForm,
  handleEditTransaction,
  handleUpdateTransaction,
  handleDeleteTransaction,
  fetchLedger,
  setSelectedTransactionMemberId,
  selectedTransactionMemberId,
  ledgerLoading,
  session
}) => {
  const formatDateLong = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date)) return null;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' });
  };

  return (
    <div style={{ width: '100%', position: 'relative', marginTop: '2rem' }}>
      <h3>Ledger</h3>
      <div style={{ marginBottom: '1rem' }}>
        <strong>
          {memberLedger && memberLedger.reduce((acc, t) => acc + Number(t.amount), 0) < 0 ? 'Balance Due:' : 'Current Credit:'}
        </strong>{' '}
        ${Math.abs((memberLedger || []).reduce((acc, t) => acc + Number(t.amount), 0)).toFixed(2)}
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
                    // setTransactionStatus('Please select a member.');
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
    </div>
  );
};

export default MemberLedger; 