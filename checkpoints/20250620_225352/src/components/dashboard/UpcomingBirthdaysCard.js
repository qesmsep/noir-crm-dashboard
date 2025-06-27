import React from 'react';

function getNextBirthday(dob) {
  if (!dob) return null;
  const today = new Date();
  const [year, month, day] = dob.split('-').map(Number);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return next;
}

const UpcomingBirthdaysCard = ({ members }) => {
  const membersWithBirthday = (members || [])
    .filter(m => m.dob)
    .map(m => ({
      ...m,
      nextBirthday: getNextBirthday(m.dob)
    }))
    .filter(m => m.nextBirthday)
    .sort((a, b) => a.nextBirthday - b.nextBirthday)
    .slice(0, 5);

  return (
    <div style={{
      background: '#fff',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      minWidth: '250px',
      marginTop: '2rem'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#666' }}>Next 5 Birthdays</h3>
      {membersWithBirthday.length === 0 ? (
        <div>No upcoming birthdays.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {membersWithBirthday.map(m => (
            <li key={m.member_id} style={{
              padding: '0.75rem 0',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{m.first_name} {m.last_name}</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  {m.nextBirthday.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UpcomingBirthdaysCard; 