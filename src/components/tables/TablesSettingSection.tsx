import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import TablesList from './TablesList';
import TableEditModal from './TableEditModal';
import styles from '../../styles/Settings.module.css';
import { supabase } from '@/lib/supabase';

interface TableData {
  id: string;
  table_number: number;
  seats: number;
  status: string;
  location_id: string;
  location_slug?: string | null;
}

interface TableFormData {
  table_number: number;
  seats: number;
  status: 'active' | 'inactive';
}

interface TablesSettingSectionProps {
  locationSlug: string;
  locationName: string;
}

// Normalize a raw table row (as returned by POST/PUT) into the shape the list
// expects. The mutation responses return the DB row without the joined
// location slug, so we fill it in from the current location context.
function normalizeTableRow(row: any, locationSlug: string): TableData {
  return {
    id: row.id,
    table_number: Number(row.table_number) || 0,
    seats: Number(row.seats) || 0,
    status: row.status || 'active',
    location_id: row.location_id,
    location_slug: locationSlug,
  };
}

export default function TablesSettingSection({
  locationSlug,
  locationName,
}: TablesSettingSectionProps) {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Ref to store timeout ID for cleanup
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to store abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup timeout and abort controller on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchTables = useCallback(async () => {
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/tables?location=${locationSlug}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch tables');
      }

      setTables(result.data || []);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Error fetching tables:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tables');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [locationSlug]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleAddTable = () => {
    setError(null);
    setSuccess(null);
    setEditingTable(null);
    setModalOpen(true);
  };

  const handleEditTable = (table: TableData) => {
    setError(null);
    setSuccess(null);
    setEditingTable(table);
    setModalOpen(true);
  };

  const handleSaveTable = async (formData: TableFormData) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const isUpdate = !!editingTable;
      const tableNumber = String(formData.table_number).padStart(2, '0');

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      if (isUpdate) {
        // Update existing table
        const response = await fetch(`/api/tables/${editingTable.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update table');
        }

        // Update local state from the returned row (no full refetch needed)
        const updatedRow = normalizeTableRow(result.data, locationSlug);
        setTables((prev) => prev.map((t) => (t.id === editingTable.id ? updatedRow : t)));
        setSuccess(`Table ${tableNumber} updated successfully`);
      } else {
        // Create new table
        const response = await fetch('/api/tables', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...formData,
            location_slug: locationSlug,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create table');
        }

        // Append the newly created row to local state (no full refetch needed)
        const createdRow = normalizeTableRow(result.data, locationSlug);
        setTables((prev) => [...prev, createdRow]);
        setSuccess(`Table ${tableNumber} created successfully`);
      }

      setModalOpen(false);
      setEditingTable(null);

      // Auto-clear success message after 3 seconds
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving table:', err);
      setError(err instanceof Error ? err.message : 'Failed to save table');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTable = async (id: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const tableToDelete = tables.find((t) => t.id === id);
      const tableNumber = tableToDelete ? String(tableToDelete.table_number).padStart(2, '0') : '';

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/tables/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete table');
      }

      // Remove the deleted row from local state (no full refetch needed)
      setTables((prev) => prev.filter((t) => t.id !== id));
      setSuccess(`Table ${tableNumber} deleted successfully`);

      setModalOpen(false);
      setEditingTable(null);

      // Auto-clear success message after 3 seconds
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting table:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete table');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      {/* Header with Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 className={styles.cardTitle} style={{ margin: 0 }}>Tables Management</h2>
          <p className={styles.cardDescription}>
            Manage table inventory for {locationName}
          </p>
        </div>
        <button
          className={`${styles.saveButton}`}
          onClick={handleAddTable}
          style={{ background: '#A59480', borderColor: '#A59480' }}
        >
          <Plus size={16} style={{ marginRight: '0.5rem' }} />
          Add Table
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div className={`${styles.message} ${styles.success}`} style={{ marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={`${styles.message} ${styles.error}`} style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p className={styles.inputHint}>Loading tables...</p>
        </div>
      ) : (
        <TablesList
          tables={tables}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onEdit={handleEditTable}
        />
      )}

      {/* Edit/Add Modal */}
      <TableEditModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTable(null);
        }}
        onSave={handleSaveTable}
        onDelete={handleDeleteTable}
        editTable={editingTable}
        saving={saving}
        locationName={locationName}
        error={error}
      />
    </div>
  );
}
