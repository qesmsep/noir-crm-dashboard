import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteStatus, setPromoteStatus] = useState('');
  const [section, setSection] = useState('members');
  const [lookupQuery, setLookupQuery] = useState('');
  // Create User form state
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createStatus, setCreateStatus] = useState('');
  // User management state for Admin tab
  const [users, setUsers] = useState([]);
  const [editUserId, setEditUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "view"
  });
  // Member editing state
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dob: "",
    membership: "",
    balance: "",
    photo: "",
    first_name2: "",
    last_name2: "",
    email2: "",
    phone2: "",
    company2: "",
    photo2: ""
  });
  useEffect(() => {
    async function fetchUsers() {
      if (section === "admin") {
        const res = await fetch('/api/listUsers');
        const data = await res.json();
        setUsers(data.users || []);
      }
    }
    fetchUsers();
  }, [section]);

  function handleEditUser(user) {
    setEditUserId(user.id);
    setEditForm({
      first_name: user.user_metadata?.first_name || "",
      last_name: user.user_metadata?.last_name || "",
      email: user.email,
      phone: user.user_metadata?.phone || "",
      role: user.user_metadata?.role || "view"
    });
  }

  function handleCancelEdit() {
    setEditUserId(null);
    setEditForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      role: "view"
    });
  }

  async function handleSaveUser(userId) {
    // Call your API to update user
    const res = await fetch('/api/updateUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, ...editForm })
    });
    const result = await res.json();
    if (result.success) {
      // Refresh user list
      const newUsers = users.map(u =>
        u.id === userId
          ? { ...u, email: editForm.email, user_metadata: { ...u.user_metadata, ...editForm, role: editForm.role } }
          : u
      );
      setUsers(newUsers);
      setEditUserId(null);
    } else {
      alert(result.error || "Failed to update user");
    }
  }

  // Member edit handlers
  function handleEditMember(member) {
    setEditingMemberId(member.id);
    setEditMemberForm({ ...member });
  }
  function handleCancelEditMember() {
    setEditingMemberId(null);
    setEditMemberForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      dob: "",
      membership: "",
      balance: "",
      photo: "",
      first_name2: "",
      last_name2: "",
      email2: "",
      phone2: "",
      company2: "",
      photo2: ""
    });
  }
  async function handleSaveEditMember() {
    const { id, ...fields } = editMemberForm;
    const { error } = await supabase.from('members').update(fields).eq('id', editingMemberId);
    if (!error) {
      setMembers(members.map(m => m.id === editingMemberId ? { ...m, ...fields } : m));
      setEditingMemberId(null);
    } else {
      alert('Failed to update member: ' + error.message);
    }
  }

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
    // Helper for uploading a photo to Supabase Storage and returning the public URL
    async function handlePhotoUpload(file, isCounterpart = false) {
      if (!file) return null;
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${fileName}`;
      let { error } = await supabase.storage.from('member-photos').upload(filePath, file);
      if (error) {
        alert('Failed to upload photo: ' + error.message);
        return null;
      }
      const { data } = supabase.storage.from('member-photos').getPublicUrl(filePath);
      return data?.publicUrl || null;
    }

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
                    {editingMemberId === member.id ? (
                      <form
                        onSubmit={e => {
                          e.preventDefault();
                          handleSaveEditMember();
                        }}
                        style={{ width: "100%" }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <label>
                            First Name:
                            <input value={editMemberForm.first_name || ""} onChange={e => setEditMemberForm({ ...editMemberForm, first_name: e.target.value })} />
                          </label>
                          <label>
                            Last Name:
                            <input value={editMemberForm.last_name || ""} onChange={e => setEditMemberForm({ ...editMemberForm, last_name: e.target.value })} />
                          </label>
                          <label>
                            Email:
                            <input value={editMemberForm.email || ""} onChange={e => setEditMemberForm({ ...editMemberForm, email: e.target.value })} />
                          </label>
                          <label>
                            Phone:
                            <input value={editMemberForm.phone || ""} onChange={e => setEditMemberForm({ ...editMemberForm, phone: e.target.value })} />
                          </label>
                          <label>
                            Date of Birth:
                            <input value={editMemberForm.dob || ""} onChange={e => setEditMemberForm({ ...editMemberForm, dob: e.target.value })} />
                          </label>
                          <label>
                            Membership:
                            <input value={editMemberForm.membership || ""} onChange={e => setEditMemberForm({ ...editMemberForm, membership: e.target.value })} />
                          </label>
                          <label>
                            Balance:
                            <input value={editMemberForm.balance || ""} onChange={e => setEditMemberForm({ ...editMemberForm, balance: e.target.value })} />
                          </label>
                          <label>
                            Photo:
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async e => {
                                const file = e.target.files[0];
                                if (file) {
                                  const url = await handlePhotoUpload(file, false);
                                  if (url) setEditMemberForm(form => ({ ...form, photo: url }));
                                }
                              }}
                            />
                            {editMemberForm.photo && (
                              <img src={editMemberForm.photo} alt="Photo" className="member-photo" style={{ marginTop: "0.5rem", width: "120px" }} />
                            )}
                          </label>
                          <label>
                            Counterpart First Name:
                            <input value={editMemberForm.first_name2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, first_name2: e.target.value })} />
                          </label>
                          <label>
                            Counterpart Last Name:
                            <input value={editMemberForm.last_name2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, last_name2: e.target.value })} />
                          </label>
                          <label>
                            Counterpart Email:
                            <input value={editMemberForm.email2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, email2: e.target.value })} />
                          </label>
                          <label>
                            Counterpart Phone:
                            <input value={editMemberForm.phone2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, phone2: e.target.value })} />
                          </label>
                          <label>
                            Counterpart Company:
                            <input value={editMemberForm.company2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, company2: e.target.value })} />
                          </label>
                          <label>
                            Counterpart Photo:
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async e => {
                                const file = e.target.files[0];
                                if (file) {
                                  const url = await handlePhotoUpload(file, true);
                                  if (url) setEditMemberForm(form => ({ ...form, photo2: url }));
                                }
                              }}
                            />
                            {editMemberForm.photo2 && (
                              <img src={editMemberForm.photo2} alt="Counterpart Photo" className="member-photo" style={{ marginTop: "0.5rem", width: "120px" }} />
                            )}
                          </label>
                        </div>
                        <div style={{ marginTop: "0.5rem" }}>
                          <button type="submit" style={{ marginRight: "0.5rem" }}>Save</button>
                          <button type="button" onClick={handleCancelEditMember}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
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
                        <button style={{ marginTop: "0.5rem" }} onClick={() => handleEditMember(member)}>Edit</button>
                      </>
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
          {/* User Management Panel */}
          <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
            <h2>All Users</h2>
            <table className="user-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>First Name</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Last Name</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Phone</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Role</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  editUserId === user.id ? (
                    <tr key={user.id}>
                      <td><input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} /></td>
                      <td><input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} /></td>
                      <td><input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></td>
                      <td><input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></td>
                      <td>
                        <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                          <option value="admin">admin</option>
                          <option value="member">member</option>
                          <option value="view">view</option>
                        </select>
                      </td>
                      <td>
                        <button onClick={() => handleSaveUser(user.id)} style={{ marginRight: "0.5rem" }}>Save</button>
                        <button onClick={handleCancelEdit}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={user.id}>
                      <td>{user.user_metadata?.first_name || ""}</td>
                      <td>{user.user_metadata?.last_name || ""}</td>
                      <td>{user.email}</td>
                      <td>{user.user_metadata?.phone || ""}</td>
                      <td>{user.user_metadata?.role || "view"}</td>
                      <td>
                        <button onClick={() => handleEditUser(user)} style={{ marginRight: "0.5rem" }}>Edit</button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
            </>
          )}
          {section === 'lookup' && (
            <div style={{ padding: '2rem' }}>
              <h2>Member Lookup</h2>
              <input
                type="text"
                placeholder="Search by name, email, or phone"
                value={lookupQuery}
                onChange={e => setLookupQuery(e.target.value)}
                style={{ fontSize: '1.2rem', padding: '0.5rem', margin: '1rem 0', borderRadius: '6px', border: '1px solid #ccc', width: '100%', maxWidth: '400px' }}
              />
              <ul className="member-list">
                {members.filter(m => {
                  const q = lookupQuery.trim().toLowerCase();
                  if (!q) return false;
                  return (
                    (m.first_name && m.first_name.toLowerCase().includes(q)) ||
                    (m.last_name && m.last_name.toLowerCase().includes(q)) ||
                    (m.email && m.email.toLowerCase().includes(q)) ||
                    (m.phone && m.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
                  );
                }).length === 0 && lookupQuery ? (
                  <div style={{ margin: '2rem', color: '#999' }}>No results found.</div>
                ) : (
                  members.filter(m => {
                    const q = lookupQuery.trim().toLowerCase();
                    if (!q) return false;
                    return (
                      (m.first_name && m.first_name.toLowerCase().includes(q)) ||
                      (m.last_name && m.last_name.toLowerCase().includes(q)) ||
                      (m.email && m.email.toLowerCase().includes(q)) ||
                      (m.phone && m.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
                    );
                  }).map(member => (
                    <li key={member.id} className="member-item">
                      {editingMemberId === member.id ? (
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            handleSaveEditMember();
                          }}
                          style={{ width: "100%" }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <label>
                              First Name:
                              <input value={editMemberForm.first_name || ""} onChange={e => setEditMemberForm({ ...editMemberForm, first_name: e.target.value })} />
                            </label>
                            <label>
                              Last Name:
                              <input value={editMemberForm.last_name || ""} onChange={e => setEditMemberForm({ ...editMemberForm, last_name: e.target.value })} />
                            </label>
                            <label>
                              Email:
                              <input value={editMemberForm.email || ""} onChange={e => setEditMemberForm({ ...editMemberForm, email: e.target.value })} />
                            </label>
                            <label>
                              Phone:
                              <input value={editMemberForm.phone || ""} onChange={e => setEditMemberForm({ ...editMemberForm, phone: e.target.value })} />
                            </label>
                            <label>
                              Date of Birth:
                              <input value={editMemberForm.dob || ""} onChange={e => setEditMemberForm({ ...editMemberForm, dob: e.target.value })} />
                            </label>
                            <label>
                              Membership:
                              <input value={editMemberForm.membership || ""} onChange={e => setEditMemberForm({ ...editMemberForm, membership: e.target.value })} />
                            </label>
                            <label>
                              Balance:
                              <input value={editMemberForm.balance || ""} onChange={e => setEditMemberForm({ ...editMemberForm, balance: e.target.value })} />
                            </label>
                            <label>
                              Photo:
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async e => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const url = await handlePhotoUpload(file, false);
                                    if (url) setEditMemberForm(form => ({ ...form, photo: url }));
                                  }
                                }}
                              />
                              {editMemberForm.photo && (
                                <img src={editMemberForm.photo} alt="Photo" className="member-photo" style={{ marginTop: "0.5rem", width: "120px" }} />
                              )}
                            </label>
                            <label>
                              Counterpart First Name:
                              <input value={editMemberForm.first_name2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, first_name2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Last Name:
                              <input value={editMemberForm.last_name2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, last_name2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Email:
                              <input value={editMemberForm.email2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, email2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Phone:
                              <input value={editMemberForm.phone2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, phone2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Company:
                              <input value={editMemberForm.company2 || ""} onChange={e => setEditMemberForm({ ...editMemberForm, company2: e.target.value })} />
                            </label>
                            <label>
                              Counterpart Photo:
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async e => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const url = await handlePhotoUpload(file, true);
                                    if (url) setEditMemberForm(form => ({ ...form, photo2: url }));
                                  }
                                }}
                              />
                              {editMemberForm.photo2 && (
                                <img src={editMemberForm.photo2} alt="Counterpart Photo" className="member-photo" style={{ marginTop: "0.5rem", width: "120px" }} />
                              )}
                            </label>
                          </div>
                          <div style={{ marginTop: "0.5rem" }}>
                            <button type="submit" style={{ marginRight: "0.5rem" }}>Save</button>
                            <button type="button" onClick={handleCancelEditMember}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
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
                          <button style={{ marginTop: "0.5rem" }} onClick={() => handleEditMember(member)}>Edit</button>
                        </>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      </>
    );
  }
}

export default App;
