
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
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

  if (!members.length) {
    return <div>Loading members...</div>;
  }

  return (
    <div className="app-container">
      <h1 className="app-title">Noir CRM – Members</h1>
      <ul className="member-list">
        {members.map(member => (
          <li key={member.id} className="member-item">
            {member.photo && (
              <img
                src={member.photo}
                alt={`${member.first_name} ${member.last_name}`}
                className="member-photo"
              />
            )}
            <div className="member-info">
              <strong>
                {member.first_name} {member.last_name} — {member.membership}
              </strong>
              <div>Balance: ${member.balance}</div>
              <div>Phone: {member.phone}</div>
              <div>Email: {member.email}</div>
              <div>Date of Birth: {member.dob}</div>
            </div>
            {member.first_name2 && (
              <div className="member-counterpart">
                {member.photo2 && (
                  <img
                    src={member.photo2}
                    alt={`${member.first_name2} ${member.last_name2}`}
                    className="member-photo"
                  />
                )}
                <strong>
                  {member.first_name2} {member.last_name2}
                </strong>
                <div>Email: {member.email2}</div>
                <div>Phone: {member.phone2}</div>
                <div>Company: {member.company2}</div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
