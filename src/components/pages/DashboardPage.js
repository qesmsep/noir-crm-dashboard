import React from 'react';
import TotalMembersCard from '../dashboard/TotalMembersCard';
import MonthlyRevenueCard from '../dashboard/MonthlyRevenueCard';
import UpcomingPaymentsCard from '../dashboard/UpcomingPaymentsCard';
import TotalBalanceCard from '../dashboard/TotalBalanceCard';

const DashboardPage = ({ members, projectedMonthlyDues, upcomingRenewals, memberLedger }) => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Noir CRM Dashboard</h1>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <TotalMembersCard members={members} />
        <MonthlyRevenueCard projectedMonthlyDues={projectedMonthlyDues} />
        <UpcomingPaymentsCard upcomingRenewals={upcomingRenewals} />
        <TotalBalanceCard members={members} memberLedger={memberLedger} />
      </div>
    </div>
  );
};

export default DashboardPage; 