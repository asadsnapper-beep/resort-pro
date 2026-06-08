import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mobileBookingsApi } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/utils';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#92400E' },
  CONFIRMED: { bg: '#DBEAFE', text: '#1E40AF' },
  CHECKED_IN: { bg: '#D1FAE5', text: '#065F46' },
  CHECKED_OUT: { bg: '#F3F4F6', text: '#374151' },
  CANCELLED: { bg: '#FEE2E2', text: '#991B1B' },
};

export default function BookingsScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile-bookings', filter],
    queryFn: () => mobileBookingsApi.list({ status: filter || undefined, limit: 50 }),
  });

  const checkIn = useMutation({
    mutationFn: (id: string) => mobileBookingsApi.checkIn(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mobile-bookings'] }); Alert.alert('✅ Success', 'Guest checked in!'); },
    onError: () => Alert.alert('Error', 'Check-in failed'),
  });

  const checkOut = useMutation({
    mutationFn: (id: string) => mobileBookingsApi.checkOut(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mobile-bookings'] }); Alert.alert('✅ Success', 'Guest checked out. Housekeeping task created.'); },
    onError: () => Alert.alert('Error', 'Check-out failed'),
  });

  const bookings = data?.data?.data || [];

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filters}>
        {['', 'CONFIRMED', 'CHECKED_IN', 'PENDING', 'CANCELLED'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterBtn, filter === s && styles.filterActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.filterText, filter === s && styles.filterTextActive]}>
              {s.replace(/_/g, ' ') || 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#309485" />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item: Record<string, unknown>) => item.id as string}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#309485" />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No bookings found</Text>}
          renderItem={({ item }: { item: Record<string, unknown> }) => {
            const statusStyle = STATUS_COLORS[item.status as string] || { bg: '#F3F4F6', text: '#374151' };
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.guestInfo}>
                    <Text style={styles.confirmNo}>{item.confirmationNo as string}</Text>
                    <Text style={styles.guestName}>
                      {(item.guest as { firstName: string })?.firstName} {(item.guest as { lastName: string })?.lastName}
                    </Text>
                    <Text style={styles.roomName}>{(item.room as { name: string })?.name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                      {String(item.status).replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardDates}>
                  <Text style={styles.dateText}>📅 {formatDate(item.checkIn as string)} → {formatDate(item.checkOut as string)}</Text>
                  <Text style={styles.amount}>{formatCurrency(item.totalAmount as number)}</Text>
                </View>
                <View style={styles.actions}>
                  {item.status === 'CONFIRMED' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#059669' }]}
                      onPress={() => checkIn.mutate(item.id as string)}
                    >
                      <Text style={styles.actionText}>Check In</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === 'CHECKED_IN' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
                      onPress={() => checkOut.mutate(item.id as string)}
                    >
                      <Text style={styles.actionText}>Check Out</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  filters: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  filterActive: { backgroundColor: '#1a6b5e', borderColor: '#1a6b5e' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  filterTextActive: { color: '#fff' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  guestInfo: { flex: 1 },
  confirmNo: { fontSize: 11, fontFamily: 'monospace', color: '#9CA3AF', marginBottom: 4 },
  guestName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  roomName: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDates: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateText: { fontSize: 13, color: '#6B7280' },
  amount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
