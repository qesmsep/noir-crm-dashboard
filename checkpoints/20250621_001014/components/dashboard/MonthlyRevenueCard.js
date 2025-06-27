import React, { useState } from 'react';

const MonthlyRevenueCard = ({ memberLedger }) => {
  // Filter for this month
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const isThisMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  };

  // Sum all purchases and payments for the month
  const purchases = (memberLedger || [])
    .filter(tx => tx.type === 'purchase' && isThisMonth(tx.date))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const payments = (memberLedger || [])
    .filter(tx => tx.type === 'payment' && isThisMonth(tx.date))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const totalRevenue = purchases + payments;

  const ar = Math.abs(purchases) - payments;

  // Calculate outstanding balances by account
  const accountsWithAR = {};
  (memberLedger || []).forEach(tx => {
    if (!accountsWithAR[tx.account_id]) accountsWithAR[tx.account_id] = { account_id: tx.account_id, member_id: tx.member_id, balance: 0 };
    accountsWithAR[tx.account_id].balance += Number(tx.amount);
  });
  const arAccounts = Object.values(accountsWithAR).filter(acc => acc.balance < 0);

  const [showARModal, setShowARModal] = useState(false);

  // Debug logs
  console.log('memberLedger:', memberLedger);
  console.log('Filtered purchases:', (memberLedger || []).filter(tx => tx.type === 'purchase' && isThisMonth(tx.date)));
  console.log('Filtered payments:', (memberLedger || []).filter(tx => tx.type === 'payment' && isThisMonth(tx.date)));
  console.log('Summed purchases:', purchases);
  console.log('Summed payments:', payments);

  return (
    <div style={{
      background: '#fff',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      minWidth: '250px',
      marginTop: '2rem'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#666' }}>
        {now.toLocaleString('default', { month: 'long' })} Revenue & Receivables
      </h3>
      <div style={{ fontSize: '1.1rem', color: '#444', marginBottom: '0.5rem' }}>
        <span title="Payments: Money received from clients (e.g., dues, Stripe, manual payments)">
          Payments Received: <b>${payments.toFixed(2)}</b>
        </span>
      </div>
      <div style={{ fontSize: '1.1rem', color: '#444', marginBottom: '0.5rem' }}>
        <span title="Purchases: Money clients have spent (e.g., events, bar, services)">
          Purchases (Client Spend): <b>${Math.abs(purchases).toFixed(2)}</b>
        </span>
      </div>
      <div style={{ fontSize: '1.1rem', color: '#444', marginBottom: '0.5rem' }}>
        <span title="A/R: Purchases minus Payments. Click to view details." style={{ cursor: 'pointer', color: '#2c5282', textDecoration: 'underline' }} onClick={() => setShowARModal(true)}>
          A/R (Owed to Us): <b>${ar.toFixed(2)}</b>
        </span>
        {ar < 0 && <span style={{ color: 'green', marginLeft: 8 }}>(Credit)</span>}
      </div>
      {showARModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '10px', minWidth: 400, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginBottom: '1rem' }}>Accounts with Outstanding Balance</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '0.5rem' }}>Account ID</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '0.5rem' }}>Member ID</th>
                  <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', padding: '0.5rem' }}>Outstanding Balance</th>
                </tr>
              </thead>
              <tbody>
                {arAccounts.map(acc => (
                  <tr key={acc.account_id}>
                    <td style={{ padding: '0.5rem' }}>{acc.account_id}</td>
                    <td style={{ padding: '0.5rem' }}>{acc.member_id}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: '#c53030' }}>${Math.abs(acc.balance).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button style={{ marginTop: '1.5rem', padding: '0.6rem 1.4rem', background: '#2c5282', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowARModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const MonthlyMembershipRevenueCard = ({ memberLedger, projectedMonthlyDues, upcomingRenewals }) => {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const isThisMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  };

  // 1. Collected: payments with 'membership' in note for this month
  const membershipPayments = (memberLedger || [])
    .filter(tx => tx.type === 'payment' && isThisMonth(tx.date) && tx.note && /membership/i.test(tx.note))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  // 2. To be received: projectedMonthlyDues - collected
  const toBeReceived = Math.max(0, (projectedMonthlyDues || 0) - membershipPayments);

  return (
    <div style={{
      background: '#fff',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      minWidth: '250px',
      marginTop: '2rem'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#666' }}>
        {now.toLocaleString('default', { month: 'long' })} Membership Revenue
      </h3>
      <div style={{ fontSize: '1.1rem', color: '#444', marginBottom: '0.5rem' }}>
        <span title="Sum of all payments with 'membership' in the note for this month.">
          Collected: <b>${membershipPayments.toFixed(2)}</b>
        </span>
      </div>
      <div style={{ fontSize: '1.1rem', color: '#444', marginBottom: '0.5rem' }}>
        <span title="Projected membership dues for this month minus collected.">
          To Be Received: <b>${toBeReceived.toFixed(2)}</b>
        </span>
      </div>
    </div>
  );
};

export default MonthlyRevenueCard; 