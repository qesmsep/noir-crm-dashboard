import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { supabase } from '@/lib/supabase';
import styles from '@/styles/Dashboard.module.css';

interface DashboardStats {
  totalMembers: number;
  activeReservations: number;
  totalRevenue: number;
  newMembersThisMonth: number;
}

interface RecentActivity {
  id: string;
  type: 'reservation' | 'member' | 'payment';
  description: string;
  timestamp: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeReservations: 0,
    totalRevenue: 0,
    newMembersThisMonth: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch total members
        const { count: totalMembers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // Fetch active reservations
        const { count: activeReservations } = await supabase
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        // Fetch total revenue (assuming you have a payments table)
        const { data: revenueData } = await supabase
          .from('payments')
          .select('amount')
          .eq('status', 'completed');

        const totalRevenue = revenueData?.reduce((sum, payment) => sum + payment.amount, 0) || 0;

        // Fetch new members this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: newMembersThisMonth } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth.toISOString());

        setStats({
          totalMembers: totalMembers || 0,
          activeReservations: activeReservations || 0,
          totalRevenue,
          newMembersThisMonth: newMembersThisMonth || 0,
        });

        // Fetch recent activity
        const { data: activity } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentActivity(
          activity?.map((log) => ({
            id: log.id,
            type: log.type,
            description: log.description,
            timestamp: log.created_at,
          })) || []
        );
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.loading}>Loading dashboard data...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h3>Total Members</h3>
          <p className={styles.statValue}>{stats.totalMembers}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Active Reservations</h3>
          <p className={styles.statValue}>{stats.activeReservations}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Total Revenue</h3>
          <p className={styles.statValue}>${stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className={styles.statCard}>
          <h3>New Members This Month</h3>
          <p className={styles.statValue}>{stats.newMembersThisMonth}</p>
        </div>
      </div>

      <div className={styles.recentActivity}>
        <h2>Recent Activity</h2>
        <div className={styles.activityList}>
          {recentActivity.map((activity) => (
            <div key={activity.id} className={styles.activityItem}>
              <span className={styles.activityType}>{activity.type}</span>
              <p className={styles.activityDescription}>{activity.description}</p>
              <span className={styles.activityTime}>
                {new Date(activity.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
} 