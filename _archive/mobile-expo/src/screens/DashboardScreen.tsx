import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { mobileDashboardApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { formatCurrency } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  textColor?: string;
}

function StatCard({ label, value, icon, color, textColor = '#fff' }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textColor === '#fff' ? 'rgba(255,255,255,0.75)' : '#6B7280' }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, tenant } = useAuthStore();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile-dashboard'],
    queryFn: () => mobileDashboardApi.getStats(),
    refetchInterval: 60000,
  });

  const stats = data?.data?.data?.stats;
  const recentBookings = data?.data?.data?.recentBookings || [];
  const lowStock = data?.data?.data?.lowStockAlerts || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#309485" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning, {user?.firstName} 👋</Text>
          <Text style={styles.resortName}>{tenant?.name}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#309485" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      ) : (
        <>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard label="Occupancy" value={`${stats?.occupancyRate || 0}%`} icon="📊" color="#309485" />
            <StatCard label="Available Rooms" value={stats?.availableRooms || 0} icon="🛏️" color="#2563EB" />
            <StatCard label="Today Check-ins" value={stats?.todayCheckIns || 0} icon="✅" color="#059669" />
            <StatCard label="Today Check-outs" value={stats?.todayCheckOuts || 0} icon="🚪" color="#D97706" />
            <StatCard label="Monthly Revenue" value={formatCurrency(stats?.monthlyRevenue || 0)} icon="💰" color="#7C3AED" />
            <StatCard label="Open Tickets" value={stats?.openTickets || 0} icon="🎫" color="#DC2626" />
          </View>

          {/* Revenue Growth */}
          {stats?.revenueGrowth !== undefined && (
            <View style={[styles.growthBanner, { backgroundColor: stats.revenueGrowth >= 0 ? '#D1FAE5' : '#FEE2E2' }]}>
              <Text style={[styles.growthText, { color: stats.revenueGrowth >= 0 ? '#065F46' : '#991B1B' }]}>
                {stats.revenueGrowth >= 0 ? '↑' : '↓'} Revenue {Math.abs(stats.revenueGrowth)}% vs last month
              </Text>
            </View>
          )}

          {/* Recent Bookings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            {recentBookings.length === 0 ? (
              <Text style={styles.emptyText}>No recent bookings</Text>
            ) : (
              recentBookings.slice(0, 5).map((booking: Record<string, unknown>) => (
                <View key={booking.id as string} style={styles.bookingCard}>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.guestName}>
                      {(booking.guest as { firstName: string })?.firstName} {(booking.guest as { lastName: string })?.lastName}
                    </Text>
                    <Text style={styles.roomName}>{(booking.room as { name: string })?.name}</Text>
                  </View>
                  <View style={[styles.statusBadge, getStatusStyle(booking.status as string)]}>
                    <Text style={styles.statusText}>{String(booking.status).replace(/_/g, ' ')}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Low Stock Alerts */}
          {lowStock.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚠️ Low Stock Alerts</Text>
              {lowStock.map((item: Record<string, unknown>) => (
                <View key={item.id as string} style={styles.alertCard}>
                  <Text style={styles.alertName}>{item.name as string}</Text>
                  <Text style={styles.alertStock}>{String(item.currentStock)} {item.unit as string} remaining</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function getStatusStyle(status: string) {
  const map: Record<string, object> = {
    CONFIRMED: { backgroundColor: '#DBEAFE' },
    CHECKED_IN: { backgroundColor: '#D1FAE5' },
    CHECKED_OUT: { backgroundColor: '#F3F4F6' },
    PENDING: { backgroundColor: '#FEF3C7' },
    CANCELLED: { backgroundColor: '#FEE2E2' },
  };
  return map[status] || { backgroundColor: '#F3F4F6' };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#111827' },
  resortName: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F2F1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#065F46' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: '#6B7280' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '47%', borderRadius: 16, padding: 16 },
  statIcon: { fontSize: 22, marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  growthBanner: { borderRadius: 12, padding: 12, marginBottom: 24, alignItems: 'center' },
  growthText: { fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
  bookingCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  bookingInfo: { flex: 1 },
  guestName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  roomName: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  alertCard: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  alertName: { fontSize: 14, fontWeight: '600', color: '#92400E' },
  alertStock: { fontSize: 12, color: '#B45309', marginTop: 2 },
});
