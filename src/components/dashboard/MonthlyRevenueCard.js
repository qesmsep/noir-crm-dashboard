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

  // Calculate revenue by type
  const renewalRevenue = (memberLedger || [])
    .filter(tx => tx.type === 'payment' && isThisMonth(tx.date))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const purchasesRevenue = (memberLedger || [])
    .filter(tx => tx.type === 'purchase' && isThisMonth(tx.date))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const totalRevenue = renewalRevenue + purchasesRevenue;

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
        {now.toLocaleString('default', { month: 'long' })} Revenue
      </h3>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
        ${totalRevenue.toFixed(2)}
      </div>
      <div style={{ marginTop: '1rem', color: '#444', fontSize: '1.1rem' }}>
        <div>Membership Renewal Revenue: <b>${renewalRevenue.toFixed(2)}</b></div>
        <div>Purchases Revenue: <b>${purchasesRevenue.toFixed(2)}</b></div>
      </div>
    </div>
  );
};

export default MonthlyRevenueCard; 