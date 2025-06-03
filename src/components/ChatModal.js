import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

export default function ChatModal({ open, onClose, member, account, phoneNumberId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!open || !member) return;
    setLoading(true);
    supabase
      .from('messages')
      .select('*')
      .eq('member_id', member.member_id)
      .order('timestamp', { ascending: true })
      .then(({ data, error }) => {
        setLoading(false);
        if (!error) setMessages(data || []);
      });
  }, [open, member]);

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleSend = async () => {
    if (!input.trim() || !member || !account) return;
    setSending(true);
    const res = await fetch('/api/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: member.member_id,
        account_id: account.account_id,
        message: input,
        to: member.phone,
        phone_number_id: phoneNumberId
      })
    });
    setSending(false);
    if (res.ok) {
      setInput('');
      // Refresh messages
      supabase
        .from('messages')
        .select('*')
        .eq('member_id', member.member_id)
        .order('timestamp', { ascending: true })
        .then(({ data }) => setMessages(data || []));
    } else {
      alert('Failed to send message');
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      background: 'rgba(44,41,38,0.98)',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      width: 340,
      maxHeight: 480,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#222',
    }}>
      <div style={{
        background: '#a59480',
        color: '#fff',
        padding: '1rem',
        fontWeight: 600,
        fontSize: '1.1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>Chat with {member.first_name} {member.last_name}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>&times;</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8f7f4', padding: '1rem' }}>
        {loading ? (
          <div>Loading...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No messages yet.</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} style={{
              display: 'flex',
              flexDirection: msg.direction === 'out' ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              marginBottom: 12
            }}>
              <div style={{
                background: msg.direction === 'out' ? '#a59480' : '#e5e1d8',
                color: msg.direction === 'out' ? '#fff' : '#222',
                borderRadius: 12,
                padding: '0.7rem 1rem',
                maxWidth: 220,
                fontSize: '1rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                marginLeft: msg.direction === 'out' ? 0 : 8,
                marginRight: msg.direction === 'out' ? 8 : 0,
              }}>
                {msg.message}
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 4, textAlign: msg.direction === 'out' ? 'right' : 'left' }}>
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid #e5e1d8', background: '#fff', padding: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Type a message..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem', background: 'transparent', padding: '0.5rem' }}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{ background: '#a59480', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', marginLeft: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          Send
        </button>
      </div>
    </div>
  );
} 