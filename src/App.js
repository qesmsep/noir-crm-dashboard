import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
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

      setMembers(membersData);
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
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
