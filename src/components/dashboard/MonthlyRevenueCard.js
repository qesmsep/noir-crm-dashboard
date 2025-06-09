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

export const MonthlyMembershipRevenueCard = ({ memberLedger, projectedMonthlyDues, upcomingRenewals }) => {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const nextMonth = (thisMonth + 1) % 12;
  const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

  const isThisMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  };
  const isNextMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getMonth() === nextMonth && d.getFullYear() === nextMonthYear;
  };

  // 1. Collected: payments with 'membership' in note for this month
  const membershipPayments = (memberLedger || [])
    .filter(tx => tx.type === 'payment' && isThisMonth(tx.date) && tx.note && /membership/i.test(tx.note))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  // 2. To be received: projectedMonthlyDues - collected
  const toBeReceived = Math.max(0, (projectedMonthlyDues || 0) - membershipPayments);

  // 3. Next month forecast: sum of monthly_dues for upcomingRenewals in next month
  const nextMonthForecast = (upcomingRenewals || [])
    .filter(m => m.nextRenewal && isNextMonth(m.nextRenewal))
    .reduce((sum, m) => sum + (m.monthly_dues || 0), 0);

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
      <div style={{ fontSize: '1.1rem', color: '#444', marginBottom: '0.5rem' }}>
        <span title="Forecasted membership dues for next month based on upcoming renewals.">
          Next Month Forecast: <b>${nextMonthForecast.toFixed(2)}</b>
        </span>
      </div>
    </div>
  );
};

export default MonthlyRevenueCard; 