import React from 'react';

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
        <span title="A/R: Purchases minus Payments. If positive, clients owe us. If negative, clients are in credit.">
          A/R (Owed to Us): <b style={{color: ar > 0 ? 'red' : 'green'}}>${ar.toFixed(2)}</b>
          {ar > 0 ? ' (Clients owe us)' : ' (Clients in credit)'}
        </span>
      </div>
    </div>
  );
};

export const MonthlyMembershipRevenueCard = ({ memberLedger }) => {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const isThisMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  };

  // Membership revenue: payments with 'membership' in note
  const membershipPayments = (memberLedger || [])
    .filter(tx => tx.type === 'payment' && isThisMonth(tx.date) && tx.note && /membership/i.test(tx.note))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

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
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
        ${membershipPayments.toFixed(2)}
      </div>
      <div style={{ marginTop: '1rem', color: '#444', fontSize: '1.1rem' }}>
        <span title="Sum of all payments with 'membership' in the note for this month.">
          Membership Dues Collected
        </span>
      </div>
    </div>
  );
};

export default MonthlyRevenueCard; 