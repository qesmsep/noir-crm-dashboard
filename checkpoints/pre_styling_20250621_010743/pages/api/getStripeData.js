import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    async function fetchAll() {
      // 1) Fetch members
      const { data: membersData, error: memErr } = await supabase
        .from('members')
        .select('*')
        .order('join_date', { ascending: false });
      if (memErr) {
        console.error('Error fetching members:', memErr);
        return;
      }

      // 2) Enrich with Stripe data?
      const enriched = membersData.map(m => ({
        ...m,
        stripeStatus: m.statusStripe || 'none',
        nextRenewal: m.nextRenewalDate || '—'
      }));

      setMembers(enriched);
    }
    fetchAll();
  }, []);

  return (
    <div className="app-container">
      <h1 className="app-title">Noir CRM – Members</h1>
      <ul className="member-list">
        {members.map(m => (
          <li key={m.id} className="member-item">
            <strong>{m.first_name} {m.last_name}</strong> — {m.email}
            <br/>
            Member Status: {m.status}
            <br/>
            Stripe Status: {m.stripeStatus}
            <br/>
            Next Renewal: {m.nextRenewal}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;