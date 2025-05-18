import { createClient } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';

const supabaseUrl = 'https://hkgomdqmzideiwudkbrz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZ29tZHFtemlkZWl3dWRrYnJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1OTk5ODMsImV4cCI6MjA2MzE3NTk4M30.WP-CFyMpfaDlVk-ZcSja_CFVNDz9u6IAIyICrhnLP8k';
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    async function fetchMembers() {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('join_date', { ascending: false });

      if (error) {
        console.error('Error fetching members:', error);
      } else {
        setMembers(data);
      }
    }

    fetchMembers();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Noir CRM – Members</h1>
      <ul>
        {members.map(member => (
          <li key={member.id}>
            {member.full_name} — {member.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
