import React from 'react';

const MonthlyRevenueCard = ({ projectedMonthlyDues }) => {
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
        {new Date().toLocaleString('default', { month: 'long' })} Revenue
      </h3>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
        ${projectedMonthlyDues.toFixed(2)}
      </div>
    </div>
  );
};

export default MonthlyRevenueCard; 