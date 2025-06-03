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

const SendMessageModal = ({ open, onClose, member, adminEmail, onSent }) => {
  const [template, setTemplate] = useState(TEMPLATES[0].value);
  const [message, setMessage] = useState(TEMPLATES[0].text.replace('{{first_name}}', member?.first_name || ''));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleTemplateChange = (e) => {
    const selected = TEMPLATES.find(t => t.value === e.target.value);
    setTemplate(selected.value);
    setMessage(selected.text.replace('{{first_name}}', member?.first_name || ''));
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
          member_ids: [member.member_id],
          content: message,
          sent_by: adminEmail
        })
      });
      const result = await res.json();
      if (res.ok && result.results && result.results[0].status === 'sent') {
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
          <button onClick={handleSend} disabled={sending || !message.trim()} style={{ padding: '0.5rem 1.2rem', background: '#4a90e2', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 }}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendMessageModal; 