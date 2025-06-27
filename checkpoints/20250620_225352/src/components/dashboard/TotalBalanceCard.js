import React from 'react';

const TotalBalanceCard = ({ members, memberLedger }) => {
  const totalBalance = members.reduce((total, member) => {
    const balance = memberLedger
      .filter(tx => tx.member_id === member.member_id)
      .reduce((acc, tx) => acc + Number(tx.amount), 0);
    return total + (balance < 0 ? Math.abs(balance) : 0);
  }, 0);

  const accountsWithBalance = members.filter(member => {
    const balance = memberLedger
      .filter(tx => tx.member_id === member.member_id)
      .reduce((acc, tx) => acc + Number(tx.amount), 0);
    return balance < 0;
  }).length;

  return (
    <div style={{
      background: '#fff',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      minWidth: '250px',
      marginTop: '2rem'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#666' }}>Total Balance Due</h3>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
        ${totalBalance.toFixed(2)}
      </div>
      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
        {accountsWithBalance} accounts with outstanding balance
      </div>
    </div>
  );
};

export default TotalBalanceCard; 