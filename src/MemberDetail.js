import React from 'react';

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
      {/* You can add more fields as needed */}

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
    </div>
  );
};

export default MemberDetail;