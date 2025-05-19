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
  const [section, setSection] = useState('members');
  // Create User form state
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createStatus, setCreateStatus] = useState('');

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

  // Handler for Create User form
  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateStatus('');
    try {
      const response = await fetch('/api/createUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: createEmail, name: createName }),
      });
      const data = await response.json();
      if (data.success) {
        setCreateStatus('User created! Check their email for a magic link.');
        setCreateEmail('');
        setCreateName('');
      } else {
        setCreateStatus(data.error || 'Failed to create user.');
      }
    } catch (err) {
      setCreateStatus('Error: ' + err.message);
    }
  }

  if (!session) {
    return (
      <div className="auth-container">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]} // No social sign-in
          theme="dark"
          magicLink={true}
          view="magic_link"
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
      <>
        <div className="sidebar-nav">
          <button className={section === 'members' ? 'nav-active' : ''} onClick={() => setSection('members')}>
            Members
          </button>
          <button className={section === 'admin' ? 'nav-active' : ''} onClick={() => setSection('admin')}>
            Admin
          </button>
          <button className={section === 'lookup' ? 'nav-active' : ''} onClick={() => setSection('lookup')}>
            Lookup
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>
            Log Out
          </button>
        </div>
        <div className="app-container">
          {section === 'members' && (
            <>
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
            </>
          )}
          {section === 'admin' && (
            <>
              <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
                <h2>Create New User</h2>
                <form onSubmit={handleCreateUser} style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                  <input
                    type="email"
                    placeholder="User email"
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    required
                    style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "4px", border: "1px solid #ccc", width: "250px" }}
                  />
                  <input
                    type="text"
                    placeholder="Name (optional)"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "4px", border: "1px solid #ccc", width: "200px" }}
                  />
                  <button type="submit" style={{ padding: "0.5rem 1.5rem", background: "#a59480", color: "#fff", border: "none", borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}>
                    Create User
                  </button>
                </form>
                {createStatus && <div style={{ marginTop: "0.5rem", color: "#353535", fontWeight: 600 }}>{createStatus}</div>}
              </div>
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
            </>
          )}
          {section === 'lookup' && (
            <div style={{ padding: "2rem" }}>
              <h2>Lookup (coming soon)</h2>
              <div>Search for members here.</div>
            </div>
          )}
        </div>
      </>
    );
  }
}

export default App;
