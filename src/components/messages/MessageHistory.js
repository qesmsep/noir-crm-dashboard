import React, { useEffect, useState } from 'react';

const MessageHistory = ({ memberId }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!memberId) return;
    setLoading(true);
    setError('');
    fetch(`/api/messages?member_id=${memberId}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages) setMessages(data.messages);
        else setError(data.error || 'Failed to fetch messages');
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [memberId]);

  if (!memberId) return null;

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3>Message History</h3>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>{error}</div>
      ) : messages.length === 0 ? (
        <div>No messages sent to this member yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {messages.map(msg => (
            <li key={msg.id} style={{ borderBottom: '1px solid #eee', padding: '0.75rem 0' }}>
              <div style={{ fontWeight: 500 }}>{msg.content}</div>
              <div style={{ fontSize: '0.95rem', color: '#666' }}>
                Sent: {new Date(msg.timestamp).toLocaleString()} | Status: <span style={{ color: msg.status === 'sent' ? 'green' : 'red' }}>{msg.status}</span>
                {msg.sent_by && <span> | By: {msg.sent_by}</span>}
                {msg.error_message && <span style={{ color: 'red' }}> | Error: {msg.error_message}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MessageHistory; 