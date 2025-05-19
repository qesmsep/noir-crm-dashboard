import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteStatus, setPromoteStatus] = useState('');

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

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

  async function handlePromote(e) {
    e.preventDefault();
    setPromoteStatus(''); // Clear previous message
    try {
      const response = await fetch('/api/promoteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: promoteEmail }),
      });
      const data = await response.json();
      if (data.success) {
        setPromoteStatus('User promoted to admin!');
      } else {
        setPromoteStatus(data.error || 'Failed to promote user.');
      }
    } catch (err) {
      setPromoteStatus('Error: ' + err.message);
    }
  }

  if (!session) {
    return (
      <div className="auth-container">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]} // Hide social provider buttons
          theme="dark"
        />
      </div>
    );
  }

  if (session) {
    const isAdmin = session.user?.user_metadata?.role === "admin";
    if (!isAdmin) {
      return (
        <div style={{ padding: "4rem", textAlign: "center" }}>
          <h2>You do not have access to this dashboard.</h2>
          <button
            style={{
              marginTop: "2rem",
              padding: "0.5rem 1.5rem",
              background: "#a59480",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
          >
            Sign Out
          </button>
        </div>
      );
    }

    if (!members.length) {
      return <div>Loading members...</div>;
    }

    return (
      <div className="app-container">
        <button
          style={{
            position: "fixed",
            top: "1rem",
            right: "1rem",
            padding: "0.75rem 1.5rem",
            border: "none",
            borderRadius: "6px",
            background: "#a59480",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 600,
            boxShadow: "0 2px 8px rgba(53,53,53,0.16)",
            cursor: "pointer",
            zIndex: 9999
          }}
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
        >
          Sign Out
        </button>
        <h1 className="app-title">Noir CRM – Members</h1>
        <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
          <h2>Promote User to Admin</h2>
          <form onSubmit={handlePromote} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <input
              type="email"
              placeholder="User email"
              value={promoteEmail}
              onChange={e => setPromoteEmail(e.target.value)}
              required
              style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "4px", border: "1px solid #ccc", width: "250px" }}
            />
            <button type="submit" style={{ padding: "0.5rem 1.5rem", background: "#a59480", color: "#fff", border: "none", borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}>
              Promote
            </button>
          </form>
          {promoteStatus && <div style={{ marginTop: "1rem", color: "#353535", fontWeight: 600 }}>{promoteStatus}</div>}
        </div>
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
}

export default App;
