import React, { useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import MemberDetail from '../../MemberDetail';
import MemberLedger from './MemberLedger';
import SendMessageModal from '../messages/SendMessageModal';
import MessageHistory from '../messages/MessageHistory';

// You may want to further break this down into smaller components later
const MembersPage = ({
  members,
  lookupQuery,
  setLookupQuery,
  selectedMember,
  setSelectedMember,
  fetchLedger,
  memberLedger,
  membersByAccount,
  formatDateLong,
  formatPhone,
  formatDOB,
  stripePromise,
  handleEditMember,
  session,
  newTransaction,
  setNewTransaction,
  handleAddTransaction,
  transactionStatus,
  editingTransaction,
  setEditingTransaction,
  editTransactionForm,
  setEditTransactionForm,
  handleEditTransaction,
  handleUpdateTransaction,
  handleDeleteTransaction,
  setSelectedTransactionMemberId,
  selectedTransactionMemberId,
  ledgerLoading
}) => {
  const [showSendModal, setShowSendModal] = useState(false);
  const [modalMember, setModalMember] = useState(null);
  const [messageHistoryKey, setMessageHistoryKey] = useState(0);
  const isAdmin = session?.user?.user_metadata?.role === 'admin';

  return (
    <div style={{ padding: '2rem' }}>
      {/* Member Lookup UI at the top of Members section */}
      <div style={{ marginBottom: '2rem' }}>
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
              <li
                key={member.member_id}
                className="member-item"
                style={{ position: "relative", cursor: "pointer", width: "100%" }}
                onClick={() => {
                  setSelectedMember(member);
                  fetchLedger(member.account_id);
                }}
                tabIndex={0}
                role="button"
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedMember(member);
                    fetchLedger(member.account_id);
                  }
                }}
              >
                {member.photo && (
                  <img
                    src={member.photo}
                    alt={`${member.first_name} ${member.last_name}`}
                    className="member-photo"
                  />
                )}
                <div className="member-info">
                  <strong>
                    {member.first_name} {member.last_name}
                  </strong>
                  <div>Member since: {formatDateLong(member.join_date)}</div>
                  <div>Phone: {formatPhone(member.phone)}</div>
                  <div>Email: {member.email}</div>
                  <div>Date of Birth: {formatDOB(member.dob)}</div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
      {/* End Member Lookup UI */}
      {/* Existing member list, filtered if no lookup query */}
      {!selectedMember ? (
        <>
          <h1 className="app-title">Noir CRM – Members</h1>
          {Object.entries(membersByAccount).map(([accountId, accountMembers]) => (
            <div key={accountId} className="account-group" style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem'
            }}>
              {accountMembers.map((member, idx) => (
                <div key={member.member_id} style={{
                  padding: '0.5rem 0',
                  background: 'none',
                  boxShadow: 'none',
                  borderRadius: 0,
                  marginBottom: 0
                }}>
                  <li
                    className="member-item"
                    style={{ position: "relative", cursor: "pointer", listStyle: 'none', margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}
                    onClick={() => {
                      setSelectedMember(member);
                      fetchLedger(member.account_id);
                    }}
                  >
                    {member.photo && (
                      <img
                        src={member.photo}
                        alt={`${member.first_name} ${member.last_name}`}
                        className="member-photo"
                        style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, marginRight: 20, background: '#f6f5f2' }}
                      />
                    )}
                    <div className="member-info" style={{ flex: 1 }}>
                      <strong>
                        {member.first_name} {member.last_name}
                      </strong>
                      <div>Member since: {formatDateLong(member.join_date)}</div>
                      <div>Phone: {formatPhone(member.phone)}</div>
                      <div>Email: {member.email}</div>
                      <div>Date of Birth: {formatDOB(member.dob)}</div>
                    </div>
                  </li>
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        // Member Detail View (not modal, full width minus sidebar)
        <div className="member-detail-view"
          style={{
            margin: "0 auto",
            background: "#faf9f7",
            borderRadius: "12px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
            boxSizing: "border-box",
            overflowX: "hidden",
            padding: '2rem 1.5rem',
            position: 'relative'
          }}
        >
          {/* Add spacing above top bar */}
          <div style={{ height: '1.5rem' }} />
          <div style={{ position: 'absolute', right: 0, bottom: 0, color: '#b3b1a7', fontSize: '0.75rem', fontStyle: 'italic', userSelect: 'all', margin: '0.5rem 1.5rem', opacity: 0.6 }}>
            Account ID: {selectedMember.account_id}
          </div>
          <Elements stripe={stripePromise}>
            {/* First row: member columns */}
            <div style={{ display: 'flex', gap: 0, marginBottom: '2rem' }}>
              {members.filter(m => m.account_id === selectedMember.account_id).map((member, idx, arr) => (
                <div key={member.member_id} style={{ flex: 1, borderRight: idx < arr.length - 1 ? '1px solid #d1cfc7' : 'none', padding: '0 1.5rem' }}>
                  <Elements stripe={stripePromise}>
                    <MemberDetail
                      member={member}
                      session={session}
                      onEditMember={handleEditMember}
                    />
                  </Elements>
                  {/* Admin-only Send Message button for each member */}
                  {/* Removed the Send Message button from underneath each member */}

                  {/* SendMessageModal for this member */}
                  {isAdmin && showSendModal && modalMember?.member_id === member.member_id && (
                    <SendMessageModal
                      open={showSendModal}
                      onClose={() => { setShowSendModal(false); setModalMember(null); }}
                      members={members.filter(m => m.account_id === member.account_id)}
                      adminEmail={session?.user?.email}
                      onSent={() => setMessageHistoryKey(k => k + 1)}
                    />
                  )}
                </div>
              ))}
            </div>
            {/* Admin-only Send Message button */}
            {console.log('isAdmin:', isAdmin, 'session:', session)}
            {isAdmin && (
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  onClick={() => setShowSendModal(true)}
                  style={{ padding: '0.6rem 1.5rem', background: '#4a90e2', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600 }}
                >
                  Send Message
                </button>
                <SendMessageModal
                  open={showSendModal}
                  onClose={() => setShowSendModal(false)}
                  members={members.filter(m => m.account_id === selectedMember.account_id)}
                  adminEmail={session?.user?.email}
                  onSent={() => setMessageHistoryKey(k => k + 1)}
                />
              </div>
            )}
            {/* Ledger Section */}
            <MemberLedger
              members={members}
              memberLedger={memberLedger}
              selectedMember={selectedMember}
              newTransaction={newTransaction}
              setNewTransaction={setNewTransaction}
              handleAddTransaction={handleAddTransaction}
              transactionStatus={transactionStatus}
              editingTransaction={editingTransaction}
              setEditingTransaction={setEditingTransaction}
              editTransactionForm={editTransactionForm}
              setEditTransactionForm={setEditTransactionForm}
              handleEditTransaction={handleEditTransaction}
              handleUpdateTransaction={handleUpdateTransaction}
              handleDeleteTransaction={handleDeleteTransaction}
              fetchLedger={fetchLedger}
              setSelectedTransactionMemberId={setSelectedTransactionMemberId}
              selectedTransactionMemberId={selectedTransactionMemberId}
              ledgerLoading={ledgerLoading}
              session={session}
            />
            {/* Message History */}
            <MessageHistory memberId={selectedMember.member_id} key={messageHistoryKey} />
          </Elements>
        </div>
      )}
    </div>
  );
};

export default MembersPage; 