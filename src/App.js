import { createClient } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';

const supabaseUrl = 'https://hkgomdqmzideiwudkbrz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZ29tZHFtemlkZWl3dWRrYnJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1OTk5ODMsImV4cCI6MjA2MzE3NTk4M30.WP-CFyMpfaDlVk-ZcSja_CFVNDz9u6IAIyICrhnLP8k';
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    async function fetchAll() {
      // 1) Fetch members from Supabase
      const { data: membersData, error: memErr } = await supabase
        .from('members')
        .select('*')
        .order('join_date', { ascending: false });

      if (memErr) {
        console.error('Error fetching members:', memErr);
        return;
      }

      // 2) For each member, fetch Stripe subscription info
      const membersWithStripe = await Promise.all(
        membersData.map(async m => {
          let stripeStatus = 'none';
          let nextRenewal = '—';

          if (m.stripe_customer_id) {
            const res = await fetch(`/api/getStripeData?customerId=${m.stripe_customer_id}`);
            const json = await res.json();
            stripeStatus = json.subscription?.status || 'none';
            nextRenewal = json.subscription?.current_period_end
              ? new Date(json.subscription.current_period_end * 1000).toLocaleDateString()
              : '—';
          }

          return { ...m, stripeStatus, nextRenewal };
        })
      );

      setMembers(membersWithStripe);
    }

    fetchAll();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Noir CRM – Members</h1>
      <ul>
        {members.map(m => (
          <li key={m.id} style={{ marginBottom: '1rem' }}>
            <strong>{m.first_name} {m.last_name}</strong> — {m.email}
            <br/>
            Status: {m.stripeStatus}
            <br/>
            Next Renewal: {m.nextRenewal}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
