import React from 'react';
import CalendarAvailabilityControl from '../CalendarAvailabilityControl';

const AdminPage = ({
  users,
  setUsers,
  editUserId,
  setEditUserId,
  editForm,
  setEditForm,
  handleEditUser,
  handleCancelEdit,
  handleSaveUser,
  showCreateUserModal,
  setShowCreateUserModal,
  createUserForm,
  setCreateUserForm,
  handleCreateUser,
  createStatus,
  session
}) => {
  return (
    <>
      <div className="admin-panel" style={{ marginBottom: "2rem", border: "1px solid #ececec", padding: "1.5rem", borderRadius: "8px", background: "#faf9f7" }}>
        <h2>Calendar Availability Control</h2>
        <CalendarAvailabilityControl />
      </div>
      {createStatus && <div style={{ marginTop: "0.5rem", color: "#353535", fontWeight: 600 }}>{createStatus}</div>}
      {/* Create User Modal */}
      {showCreateUserModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            width: '90%',
            maxWidth: '500px',
          }}>
            <h3 style={{ marginBottom: '1.5rem', color: '#333' }}>Create New User</h3>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>First Name</label>
                  <input
                    type="text"
                    value={createUserForm.first_name}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Last Name</label>
                  <input
                    type="text"
                    value={createUserForm.last_name}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, last_name: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Email</label>
                  <input
                    type="email"
                    value={createUserForm.email}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Phone</label>
                  <input
                    type="tel"
                    value={createUserForm.phone}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, phone: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Role</label>
                  <select
                    value={createUserForm.role}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, role: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="view">View</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#e5e1d8',
                    color: '#555',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#a59480',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
                    <button onClick={handleCancelEdit} style={{ marginRight: "0.5rem" }}>Cancel</button>
                    <button
                      style={{ color: '#fff', background: '#e74c3c', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                      onClick={async () => {
                        if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
                        try {
                          const res = await fetch('/api/deleteAuthUser', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              supabase_user_id: user.id,
                              member_id: null,
                              requester_token: session.access_token
                            })
                          });
                          const data = await res.json();
                          if (res.ok && data.success) {
                            setUsers(users.filter(u => u.id !== user.id));
                            setEditUserId(null);
                            alert('User deleted.');
                          } else {
                            alert('Failed to delete user: ' + (data.error || 'Unknown error'));
                          }
                        } catch (e) {
                          alert('Failed to delete user: ' + e.message);
                        }
                      }}
                    >
                      Delete
                    </button>
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
        {/* Move Create User button here, below the table */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            onClick={() => setShowCreateUserModal(true)}
            style={{
              padding: "0.5rem 1.5rem",
              background: "#a59480",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Create User
          </button>
        </div>
        {createStatus && <div style={{ marginTop: "0.5rem", color: "#353535", fontWeight: 600 }}>{createStatus}</div>}
      </div>
    </>
  );
};

export default AdminPage; 