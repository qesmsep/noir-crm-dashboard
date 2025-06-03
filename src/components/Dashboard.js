import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

function Dashboard() {
  const [metrics, setMetrics] = useState({
    totalMembers: 0,
    upcomingRenewals: [],
    monthlyRevenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        // Get total members count
        const { count: totalMembers } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true });

        // Get members with upcoming renewals (next 7 days)
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const { data: upcomingRenewals } = await supabase
          .from('members')
          .select('*')
          .gte('renewal_date', today.toISOString().split('T')[0])
          .lte('renewal_date', nextWeek.toISOString().split('T')[0])
          .order('renewal_date', { ascending: true });

        // Get monthly revenue
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const { data: monthlyTransactions } = await supabase
          .from('ledger')
          .select('amount')
          .gte('date', firstDayOfMonth.toISOString().split('T')[0])
          .eq('type', 'payment');

        const monthlyRevenue = monthlyTransactions?.reduce((sum, tx) => sum + tx.amount, 0) || 0;

        setMetrics({
          totalMembers,
          upcomingRenewals: upcomingRenewals || [],
          monthlyRevenue
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading dashboard metrics...
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', color: '#333' }}>Dashboard</h1>
      
      {/* Metrics Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Total Members Card */}
        <div style={{
          background: '#fff',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#666' }}>Total Members</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
            {metrics.totalMembers}
          </p>
        </div>

        {/* Monthly Revenue Card */}
        <div style={{
          background: '#fff',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#666' }}>Monthly Revenue</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
            ${metrics.monthlyRevenue.toFixed(2)}
          </p>
        </div>

        {/* Upcoming Renewals Card */}
        <div style={{
          background: '#fff',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#666' }}>Upcoming Renewals</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
            {metrics.upcomingRenewals.length}
          </p>
        </div>
      </div>

      {/* Upcoming Renewals Table */}
      <div style={{
        background: '#fff',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 1rem 0', color: '#333' }}>Members Due for Renewal</h2>
        {metrics.upcomingRenewals.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid #eee' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid #eee' }}>Membership</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid #eee' }}>Renewal Date</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid #eee' }}>Contact</th>
              </tr>
            </thead>
            <tbody>
              {metrics.upcomingRenewals.map(member => (
                <tr key={member.member_id}>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                    {member.first_name} {member.last_name}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                    {member.membership}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                    {new Date(member.renewal_date).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                    {member.email || member.phone}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#666' }}>No members due for renewal in the next 7 days.</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard; 