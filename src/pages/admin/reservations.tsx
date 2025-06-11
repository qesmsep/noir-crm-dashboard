import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { supabase } from '@/lib/supabase';
import styles from '@/styles/Reservations.module.css';

interface Reservation {
  id: string;
  member_id: string;
  member_name: string;
  date: string;
  time_slot: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  guests: number;
  special_requests: string;
  created_at: string;
}

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchReservations();
  }, [dateFilter, statusFilter]);

  async function fetchReservations() {
    try {
      let query = supabase
        .from('reservations')
        .select(`
          *,
          profiles:member_id (
            full_name
          )
        `)
        .order('date', { ascending: true });

      if (dateFilter) {
        query = query.eq('date', dateFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedReservations = data?.map((reservation) => ({
        ...reservation,
        member_name: reservation.profiles.full_name,
      })) || [];

      setReservations(formattedReservations);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setReservations((prev) =>
        prev.map((res) =>
          res.id === id ? { ...res, status: newStatus as Reservation['status'] } : res
        )
      );
    } catch (error) {
      console.error('Error updating reservation status:', error);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.loading}>Loading reservations...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
        <h1>Reservations</h1>
        <div className={styles.controls}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewButton} ${view === 'list' ? styles.active : ''}`}
              onClick={() => setView('list')}
            >
              List
            </button>
            <button
              className={`${styles.viewButton} ${view === 'calendar' ? styles.active : ''}`}
              onClick={() => setView('calendar')}
            >
              Calendar
            </button>
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={styles.dateFilter}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.statusFilter}
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {view === 'list' ? (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Date</th>
                <th>Time</th>
                <th>Guests</th>
                <th>Status</th>
                <th>Special Requests</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{reservation.member_name}</td>
                  <td>{new Date(reservation.date).toLocaleDateString()}</td>
                  <td>{reservation.time_slot}</td>
                  <td>{reservation.guests}</td>
                  <td>
                    <span
                      className={`${styles.status} ${
                        styles[reservation.status]
                      }`}
                    >
                      {reservation.status}
                    </span>
                  </td>
                  <td>{reservation.special_requests || '-'}</td>
                  <td>
                    <select
                      value={reservation.status}
                      onChange={(e) =>
                        handleStatusChange(reservation.id, e.target.value)
                      }
                      className={styles.statusSelect}
                    >
                      <option value="confirmed">Confirm</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Cancel</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.calendarContainer}>
          {/* TODO: Implement calendar view */}
          <p>Calendar view coming soon...</p>
        </div>
      )}
    </AdminLayout>
  );
} 