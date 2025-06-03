import React from 'react';

export default function MassMessagePlaceholder() {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      padding: '2rem',
      margin: '2rem auto',
      maxWidth: 600,
      textAlign: 'center',
      color: '#666',
    }}>
      <h2 style={{ color: '#a59480', marginBottom: 16 }}>Mass Messaging (Coming Soon)</h2>
      <p>
        This feature will allow you to send messages to filtered groups of members (by tag, type, or balance).
        <br />
        Stay tuned!
      </p>
    </div>
  );
} 