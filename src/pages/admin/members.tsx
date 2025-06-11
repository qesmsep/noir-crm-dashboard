import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { supabase } from '@/lib/supabase';
import styles from '@/styles/Members.module.css';

interface Member {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  membership_status: 'active' | 'inactive' | 'pending';
  created_at: string;
  last_login: string;
}

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof Member>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchMembers();
  }, [sortField, sortDirection]);

  async function fetchMembers() {
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (statusFilter !== 'all') {
        query = query.eq('membership_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (field: keyof Member) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredMembers = members.filter((member) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      member.email.toLowerCase().includes(searchLower) ||
      member.full_name.toLowerCase().includes(searchLower) ||
      member.phone.includes(searchQuery)
    );
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.loading}>Loading members...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
        <h1>Members</h1>
        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.statusFilter}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('full_name')}>
                Name
                {sortField === 'full_name' && (
                  <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('email')}>
                Email
                {sortField === 'email' && (
                  <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('phone')}>
                Phone
                {sortField === 'phone' && (
                  <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('membership_status')}>
                Status
                {sortField === 'membership_status' && (
                  <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('created_at')}>
                Joined
                {sortField === 'created_at' && (
                  <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('last_login')}>
                Last Login
                {sortField === 'last_login' && (
                  <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => (
              <tr key={member.id}>
                <td>{member.full_name}</td>
                <td>{member.email}</td>
                <td>{member.phone}</td>
                <td>
                  <span
                    className={`${styles.status} ${
                      styles[member.membership_status]
                    }`}
                  >
                    {member.membership_status}
                  </span>
                </td>
                <td>{new Date(member.created_at).toLocaleDateString()}</td>
                <td>
                  {member.last_login
                    ? new Date(member.last_login).toLocaleDateString()
                    : 'Never'}
                </td>
                <td>
                  <button
                    className={styles.actionButton}
                    onClick={() => {
                      // TODO: Implement view member details
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
} 