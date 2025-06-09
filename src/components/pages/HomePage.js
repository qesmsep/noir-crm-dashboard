import React, { useState } from 'react';

const HomePage = ({ setSection }) => {
  const [showReservationModal, setShowReservationModal] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: 'inherit' }}>
      {/* Top Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2.5rem', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '0.05em', color: '#222' }}>Noir</div>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '1.1rem' }}>
          <button onClick={() => setSection('home')} style={{ background: 'none', border: 'none', color: '#2c5282', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>Home</button>
          <button onClick={() => setSection('members')} style={{ background: 'none', border: 'none', color: '#2c5282', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>Members</button>
          <button onClick={() => setSection('admin')} style={{ background: 'none', border: 'none', color: '#2c5282', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>Admin</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '4rem 1rem 2rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, color: '#222', marginBottom: '1.2rem', letterSpacing: '-0.03em' }}>
          Elevated Spirits. Unforgettable Space.
        </h1>
        <p style={{ fontSize: '1.3rem', color: '#444', maxWidth: 600, margin: '0 auto 2.5rem auto' }}>
          Tucked in downtown Kansas City, Noir is a cocktail lounge designed for those who appreciate the art of ambiance. Sip, indulge, and escape the ordinary.
        </p>
        <button
          style={{ padding: '1rem 2.5rem', fontSize: '1.2rem', background: '#2c5282', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(44,82,130,0.08)' }}
          onClick={() => setShowReservationModal(true)}
        >
          Reserve a Table
        </button>
      </section>

      {/* Reservation Modal Placeholder */}
      {showReservationModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '12px', minWidth: 320, maxWidth: '90vw', boxShadow: '0 2px 24px rgba(0,0,0,0.13)' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#222' }}>Reserve a Table</h2>
            {/* TODO: Integrate reservation form/modal here */}
            <div style={{ color: '#888', marginBottom: '2rem' }}>
              Reservation form coming soon.
            </div>
            <button style={{ padding: '0.7rem 1.5rem', background: '#2c5282', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowReservationModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage; 