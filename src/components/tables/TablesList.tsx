import React, { useMemo } from 'react';
import { Search, Edit2, Table as TableIcon } from 'lucide-react';
import styles from '../../styles/Settings.module.css';
import StatusBadge from './StatusBadge';

interface TableData {
  id: string;
  table_number: number;
  seats: number;
  status: string;
  location_id: string;
  location_slug?: string | null;
}

interface TablesListProps {
  tables: TableData[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (filter: 'all' | 'active' | 'inactive') => void;
  onEdit: (table: TableData) => void;
}

export default function TablesList({
  tables,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onEdit,
}: TablesListProps) {
  const filtered = useMemo(() => {
    const items = tables.filter((table) => {
      const matchesSearch =
        !searchQuery ||
        table.table_number.toString().includes(searchQuery) ||
        table.seats.toString().includes(searchQuery);

      const matchesStatus =
        statusFilter === 'all' || table.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort by table number ascending
    return items.sort((a, b) => a.table_number - b.table_number);
  }, [tables, searchQuery, statusFilter]);

  if (tables.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#6e6e73' }}>
        <TableIcon size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
        <p>No tables configured yet.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Click "Add Table" to create your first table.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Search and Filter Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6e6e73',
            }}
          />
          <input
            type="text"
            className={styles.input}
            placeholder="Search table number..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}
          />
        </div>
        <select
          className={styles.input}
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(e.target.value as 'all' | 'active' | 'inactive')
          }
          style={{ width: '150px', fontSize: '0.875rem' }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6e6e73' }}>
          <p>No tables match your search.</p>
        </div>
      ) : (
        <>
          {/* Compact Desktop Table */}
          <div className={styles.compactTableWrapper}>
            <table className={styles.compactTable}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Table #</th>
                  <th style={{ width: '100px' }}>Seats</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((table) => (
                  <tr key={table.id}>
                    <td style={{ fontWeight: 500 }}>Table {String(table.table_number).padStart(2, '0')}</td>
                    <td>{table.seats}</td>
                    <td>
                      <StatusBadge status={table.status} />
                    </td>
                    <td>
                      <button
                        onClick={() => onEdit(table)}
                        className={styles.editButton}
                        title="Edit table"
                        aria-label={`Edit table ${String(table.table_number).padStart(2, '0')}`}
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className={styles.mobileCards}>
            {filtered.map((table) => (
              <div key={table.id} className={styles.card} style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Table {String(table.table_number).padStart(2, '0')}</h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6e6e73' }}>
                      {table.seats} seats
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <StatusBadge status={table.status} />
                    <button
                      onClick={() => onEdit(table)}
                      className={styles.editButton}
                      title="Edit table"
                      aria-label={`Edit table ${String(table.table_number).padStart(2, '0')}`}
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}