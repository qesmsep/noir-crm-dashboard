import React, { useState } from 'react';

const TEMPLATES = [
  {
    label: 'Payment Reminder',
    value: 'payment_reminder',
    text: 'Hi {{first_name}}, this is a reminder that your membership payment is due. Please let us know if you have any questions.'
  },
  {
    label: 'Welcome',
    value: 'welcome',
    text: "Welcome to Noir! We're excited to have you as a member. Let us know if you need anything."
  },
  {
    label: 'Custom',
    value: 'custom',
    text: ''
  }
];

export default function SendMessageForm({ members = [], accountId, onSent }) {
  const [template, setTemplate] = useState(TEMPLATES[0].value);
  const [message, setMessage] = useState(TEMPLATES[0].text.replace('{{first_name}}', members[0]?.first_name || ''));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recipient, setRecipient] = useState('all');

  const handleTemplateChange = (e) => {
    const selected = TEMPLATES.find(t => t.value === e.target.value);
    setTemplate(selected.value);
    setMessage(selected.text.replace('{{first_name}}', members[0]?.first_name || ''));
  };

  const handleSend = async () => {
    setSending(true);
    setError('');
    setSuccess('');
    let member_ids = [];
    if (recipient === 'all') {
      member_ids = members.map(m => String(m.member_id));
    } else {
      member_ids = [String(recipient)];
    }
    if (!member_ids.length || !message.trim()) {
      setError('Recipient(s) and message content are required.');
      setSending(false);
      return;
    }
    try {
      const res = await fetch('/api/sendText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_ids,
          content: message,
          account_id: accountId
        })
      });
      let result;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          result = await res.json();
        } catch (jsonErr) {
          const text = await res.text();
          setError('Invalid JSON response: ' + text.slice(0, 200));
          setSending(false);
          return;
        }
      } else {
        const text = await res.text();
        setError('Unexpected non-JSON response: ' + text.slice(0, 200));
        setSending(false);
        return;
      }
      if (res.ok && result.results && result.results.every(r => r.status === 'sent')) {
        setSuccess('Message sent!');
        if (onSent) onSent();
        setTimeout(() => { setSuccess(''); }, 1200);
        setMessage(TEMPLATES[0].text.replace('{{first_name}}', members[0]?.first_name || ''));
        setTemplate(TEMPLATES[0].value);
        setRecipient('all');
      } else {
        setError(result.results && result.results[0].error ? result.results[0].error : 'Failed to send message');
      }
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  return (
    <div style={{ marginBottom: '2rem', background: '#f9f9f9', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.3rem' }}>Send Message</h2>
      <div style={{ marginBottom: '1rem', fontWeight: 500 }}>
        <label>To:</label>
        <select
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
        >
          <option value="all">All Members</option>
          {members.map(m => (
            <option key={m.member_id} value={m.member_id}>
              {m.first_name} {m.last_name} {m.phone ? `(${m.phone})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label>Template:</label>
        <select value={template} onChange={handleTemplateChange} style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}>
          {TEMPLATES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label>Message:</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', marginTop: 4 }}
        />
      </div>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: 'green', marginBottom: 8 }}>{success}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={() => {
          setMessage(TEMPLATES[0].text.replace('{{first_name}}', members[0]?.first_name || ''));
          setTemplate(TEMPLATES[0].value);
          setRecipient('all');
        }} style={{ padding: '0.5rem 1.2rem', background: '#eee', border: 'none', borderRadius: 6 }}>Cancel</button>
        <button onClick={handleSend} disabled={sending || !message.trim() || (recipient !== 'all' && !recipient)} style={{ padding: '0.5rem 1.2rem', background: '#4a90e2', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 }}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
} 