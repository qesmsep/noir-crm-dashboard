import React from 'react';

const UpcomingPaymentsCard = ({ upcomingRenewals }) => {
  const membershipAmounts = {
    'Host': 1,
    'Noir Host': 1,
    'Noir Solo': 100,
    'Solo': 100,
    'Noir Duo': 125,
    'Duo': 125,
    'Premier': 250,
    'Reserve': 1000
  };

  // Group by account_id
  const accounts = {};
  for (const m of upcomingRenewals) {
    if (!accounts[m.account_id]) {
      accounts[m.account_id] = m;
    }
  }
  const accountList = Object.values(accounts);

  return (
    <div style={{
      background: '#fff',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      minWidth: '250px',
      marginTop: '2rem'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#666' }}>Next 5 Payments Due</h3>
      {accountList.length === 0 ? (
        <div>No upcoming payments.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {accountList.slice(0, 5).map(m => {
            const amount = m.monthly_dues || 0;
            return (
              <li key={m.account_id} style={{ 
                padding: '0.75rem 0', 
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{m.first_name} {m.last_name}</div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {m.nextRenewal ? m.nextRenewal.toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: '#333' }}>
                  ${amount.toFixed(2)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default UpcomingPaymentsCard; 