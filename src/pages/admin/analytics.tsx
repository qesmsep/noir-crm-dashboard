import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { supabase } from '../../lib/supabase';
import styles from '../../styles/Analytics.module.css';

interface AnalyticsData {
  totalMembers: number;
  activeMembers: number;
  totalReservations: number;
  averageGuestsPerReservation: number;
  popularTimeSlots: { time: string; count: number }[];
  monthlyRevenue: { month: string; amount: number }[];
  memberGrowth: { month: string; count: number }[];
}

interface TimeSlotCount {
  time: string;
  count: number;
}

interface MonthlyRevenue {
  month: string;
  amount: number;
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData>({
    totalMembers: 0,
    activeMembers: 0,
    totalReservations: 0,
    averageGuestsPerReservation: 0,
    popularTimeSlots: [],
    monthlyRevenue: [],
    memberGrowth: [],
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  async function fetchAnalyticsData() {
    try {
      // Fetch total and active members
      const { count: totalMembers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: activeMembers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('membership_status', 'active');

      // Fetch reservations data
      const { data: reservations } = await supabase
        .from('reservations')
        .select('*');

      const totalReservations = reservations?.length || 0;
      const averageGuests =
        reservations?.reduce((sum, res) => sum + res.guests, 0) || 0;

      // Calculate popular time slots
      const timeSlotCounts = reservations?.reduce((acc, res) => {
        acc[res.time_slot] = (acc[res.time_slot] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const popularTimeSlots = Object.entries(timeSlotCounts || {})
        .map(([time, count]) => ({ time, count: Number(count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Fetch monthly revenue
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('status', 'completed');

      const monthlyRevenue = payments?.reduce((acc, payment) => {
        const month = new Date(payment.created_at).toLocaleString('default', {
          month: 'short',
        });
        acc[month] = (acc[month] || 0) + payment.amount;
        return acc;
      }, {} as Record<string, number>);

      const revenueData = Object.entries(monthlyRevenue || {})
        .map(([month, amount]) => ({ month, amount: Number(amount) }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      // Calculate member growth
      const { data: members } = await supabase
        .from('profiles')
        .select('created_at');

      const memberGrowth = members?.reduce((acc, member) => {
        const month = new Date(member.created_at).toLocaleString('default', {
          month: 'short',
        });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const growthData = Object.entries(memberGrowth || {}).map(
        ([month, count]) => ({ month, count })
      );

      setData({
        totalMembers: totalMembers || 0,
        activeMembers: activeMembers || 0,
        totalReservations,
        averageGuestsPerReservation:
          totalReservations > 0 ? averageGuests / totalReservations : 0,
        popularTimeSlots,
        monthlyRevenue: revenueData,
        memberGrowth: growthData,
      });
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.loading}>Loading analytics data...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
       
        <div className={styles.timeRange}>
          <button
            className={`${styles.timeButton} ${
              timeRange === 'week' ? styles.active : ''
            }`}
            onClick={() => setTimeRange('week')}
          >
            Week
          </button>
          <button
            className={`${styles.timeButton} ${
              timeRange === 'month' ? styles.active : ''
            }`}
            onClick={() => setTimeRange('month')}
          >
            Month
          </button>
          <button
            className={`${styles.timeButton} ${
              timeRange === 'year' ? styles.active : ''
            }`}
            onClick={() => setTimeRange('year')}
          >
            Year
          </button>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <h3>Total Members</h3>
          <p className={styles.metricValue}>{data.totalMembers}</p>
          <p className={styles.metricSubtext}>
            {data.activeMembers} active members
          </p>
        </div>
        <div className={styles.metricCard}>
          <h3>Total Reservations</h3>
          <p className={styles.metricValue}>{data.totalReservations}</p>
          <p className={styles.metricSubtext}>
            Avg. {data.averageGuestsPerReservation.toFixed(1)} guests per
            reservation
          </p>
        </div>
        <div className={styles.metricCard}>
          <h3>Popular Time Slots</h3>
          <div className={styles.timeSlots}>
            {data.popularTimeSlots.map((slot) => (
              <div key={slot.time} className={styles.timeSlot}>
                <span className={styles.time}>{slot.time}</span>
                <span className={styles.count}>{slot.count} reservations</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.metricCard}>
          <h3>Monthly Revenue</h3>
          <div className={styles.revenueChart}>
            {data.monthlyRevenue.map((item) => (
              <div key={item.month} className={styles.revenueBar}>
                <div
                  className={styles.bar}
                  style={{
                    height: `${(item.amount / Math.max(...data.monthlyRevenue.map(r => r.amount))) * 100}%`,
                  }}
                />
                <span className={styles.month}>{item.month}</span>
                <span className={styles.amount}>
                  ${item.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.metricCard}>
          <h3>Member Growth</h3>
          <div className={styles.growthChart}>
            {data.memberGrowth.map((item) => (
              <div key={item.month} className={styles.growthBar}>
                <div
                  className={styles.bar}
                  style={{
                    height: `${(item.count / Math.max(...data.memberGrowth.map(g => g.count))) * 100}%`,
                  }}
                />
                <span className={styles.month}>{item.month}</span>
                <span className={styles.count}>{item.count} members</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
} 