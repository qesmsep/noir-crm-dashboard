import React, { useEffect, useState } from 'react';
import { Select } from '@chakra-ui/react';

interface Table {
  id: string;
  number: string;
  capacity: number;
}

interface TableSelectorProps {
  start_time: string;
  end_time: string;
  onSelect: (tableId: string) => void;
}

const TableSelector: React.FC<TableSelectorProps> = ({ start_time, end_time, onSelect }) => {
  const [free, setFree] = useState<Table[]>([]);

  useEffect(() => {
    async function fetchFree() {
      const res = await fetch(`/api/availability?start_time=${start_time}&end_time=${end_time}&party_size=0`);
      const json = await res.json();
      setFree((json.free || []).map((t: any) => ({
        id: t.table_id || t.id,
        number: t.table_number || t.number,
        capacity: parseInt(t.capacity, 10)
      })));
    }
    fetchFree();
  }, [start_time, end_time]);

  return (
    <Select
      onChange={e => onSelect(e.target.value)}
      placeholder="Select table"
    >
      {free.map(t => (
        <option key={t.id} value={t.id}>
          Table {t.number} (seats {t.capacity})
        </option>
      ))}
    </Select>
  );
};

export default TableSelector; 