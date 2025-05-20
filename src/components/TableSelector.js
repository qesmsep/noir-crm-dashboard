

import React, { useEffect, useState } from 'react';

export default function TableSelector({ start_time, end_time, onSelect }) {
  const [free, setFree] = useState([]);

  useEffect(() => {
    async function fetchFree() {
      const res = await fetch(`/api/availability?start_time=${start_time}&end_time=${end_time}&party_size=0`);
      const json = await res.json();
      setFree(json.free || []);
    }
    fetchFree();
  }, [start_time, end_time]);

  return (
    <select onChange={e => onSelect(e.target.value)}>
      <option value="">Select table</option>
      {free.map(t => (
        <option key={t.id} value={t.id}>
          Table {t.number} (seats {t.capacity})
        </option>
      ))}
    </select>
  );
}