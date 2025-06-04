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

const SendMessageModal = ({ open, onClose, members = [], adminEmail, onSent }) => {
  const [template, setTemplate] = useState(TEMPLATES[0].value);
  const [message, setMessage] = useState(TEMPLATES[0].text.replace('{{first_name}}', members[0]?.first_name || ''));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState(members.map(m => m.member_id));

  const handleTemplateChange = (e) => {
    const selected = TEMPLATES.find(t => t.value === e.target.value);
    setTemplate(selected.value);
    setMessage(selected.text.replace('{{first_name}}', members[0]?.first_name || ''));
  };

  const handleCheckboxChange = (memberId) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSend = async () => {
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/sendText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_ids: selectedMemberIds,
          content: message,
          sent_by: adminEmail
        })
      });
      let result;
      try {
        result = await res.json();
      } catch (jsonErr) {
        const text = await res.text();
        setError('Unexpected response from server: ' + text.slice(0, 200));
        setSending(false);
        return;
      }
      if (res.ok && result.results && result.results.every(r => r.status === 'sent')) {
        setSuccess('Message sent!');
        if (onSent) onSent();
        setTimeout(() => { setSuccess(''); onClose(); }, 1200);
      } else {
        setError(result.results && result.results[0].error ? result.results[0].error : 'Failed to send message');
      }
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: 10, minWidth: 340, maxWidth: 420, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.13)' }}>
        <h2 style={{ marginTop: 0 }}>Send Message</h2>
        <div style={{ marginBottom: '1rem', fontWeight: 500 }}>
          To:
          <div style={{ marginTop: 6 }}>
            {members.map(m => (
              <label key={m.member_id} style={{ display: 'block', marginBottom: 2, fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={selectedMemberIds.includes(m.member_id)}
                  onChange={() => handleCheckboxChange(m.member_id)}
                  style={{ marginRight: 6 }}
                />
                {m.first_name} {m.last_name} {m.phone && <span style={{ color: '#888' }}>({m.phone})</span>}
              </label>
            ))}
          </div>
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
          <button onClick={onClose} style={{ padding: '0.5rem 1.2rem', background: '#eee', border: 'none', borderRadius: 6 }}>Cancel</button>
          <button onClick={handleSend} disabled={sending || !message.trim() || selectedMemberIds.length === 0} style={{ padding: '0.5rem 1.2rem', background: '#4a90e2', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 }}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendMessageModal; 