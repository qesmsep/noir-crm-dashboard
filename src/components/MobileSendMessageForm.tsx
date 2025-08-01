import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

interface MobileSendMessageFormProps {
  members: any[];
  accountId: string;
  onSent?: () => void;
}

const MobileSendMessageForm: React.FC<MobileSendMessageFormProps> = ({ 
  members = [], 
  accountId, 
  onSent 
}) => {
  const [template, setTemplate] = useState(TEMPLATES[0].value);
  const [message, setMessage] = useState(TEMPLATES[0].text.replace('{{first_name}}', members[0]?.first_name || ''));
  const [sending, setSending] = useState(false);
  const [recipient, setRecipient] = useState('all');
  const [isFormVisible, setIsFormVisible] = useState(false);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = TEMPLATES.find(t => t.value === e.target.value);
    setTemplate(selected!.value);
    setMessage(selected!.text.replace('{{first_name}}', members[0]?.first_name || ''));
  };

  const handleSend = async () => {
    setSending(true);
    let member_ids: string[] = [];
    if (recipient === 'all') {
      member_ids = members.map(m => String(m.member_id));
    } else {
      member_ids = [String(recipient)];
    }

    if (!member_ids.length || !message.trim()) {
      alert('Recipient(s) and message content are required.');
      setSending(false);
      return;
    }

    try {
      // Get the current user's session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Failed to get user session');
      }

      const userEmail = session?.user?.email;
      if (!userEmail) {
        throw new Error('User email not found in session');
      }

      const res = await fetch('/api/sendText', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify({
          member_ids,
          content: message,
          account_id: accountId
        })
      });

      const result = await res.json();

      if (res.ok && result.results && result.results.every((r: any) => r.status === 'sent')) {
        alert('Message sent successfully!');
        if (onSent) onSent();
        setMessage(TEMPLATES[0].text.replace('{{first_name}}', members[0]?.first_name || ''));
        setTemplate(TEMPLATES[0].value);
        setRecipient('all');
        setIsFormVisible(false);
      } else {
        alert(result.results?.[0]?.error || 'Failed to send message');
      }
    } catch (err: any) {
      alert(err.message);
    }
    setSending(false);
  };

  return (
    <div className="mobileSendMessageForm">
      {!isFormVisible ? (
        <button
          onClick={() => setIsFormVisible(true)}
          className="mobileSendMessageButton"
          style={{
            backgroundColor: '#A59480',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '16px'
          }}
        >
          📱 Send Message
        </button>
      ) : (
        <div
          style={{
            backgroundColor: '#f7fafc',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            border: '1px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#353535' }}>
              Send Message
            </h3>
            <button
              onClick={() => setIsFormVisible(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '600', color: '#353535' }}>
                To:
              </label>
              <select
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="all">All Members</option>
                {members.map(m => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.first_name} {m.last_name} {m.phone ? `(${m.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '600', color: '#353535' }}>
                Template:
              </label>
              <select 
                value={template} 
                onChange={handleTemplateChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                {TEMPLATES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '600', color: '#353535' }}>
                Message:
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                placeholder="Enter your message..."
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!message.trim() || (recipient !== 'all' && !recipient) || sending}
              style={{
                backgroundColor: sending ? '#cbd5e0' : '#353535',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: sending ? 'not-allowed' : 'pointer',
                width: '100%'
              }}
            >
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileSendMessageForm; 