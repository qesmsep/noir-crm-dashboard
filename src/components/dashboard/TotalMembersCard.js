import React from 'react';

const TotalMembersCard = ({ members }) => {
  const totalDues = (members || []).reduce((sum, m) => sum + (m.monthly_dues || 0), 0);
  return (
    <div style={{
      background: '#fff',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      minWidth: '250px',
      marginTop: '2rem'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#666' }}>Total Members</h3>
      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#333' }}>
        {members.length}
      </div>
      <div style={{ fontSize: '1.1rem', color: '#444', marginTop: '0.5rem' }}>
        Total Membership Dues: <b>${totalDues.toFixed(2)}</b>
      </div>
    </div>
  );
};

export default TotalMembersCard; 