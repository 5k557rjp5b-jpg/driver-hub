import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useShiftHistory } from '../hooks/useShiftHistory';
import type { HistoryStackParamList } from '../types';
import { formatCurrency, getShiftEarningsPence } from '../utils/earnings';
import { formatDate, formatHours, formatShiftStatus, formatTime, getShiftDurationHours } from '../utils/hours';

type Props = NativeStackScreenProps<HistoryStackParamList, 'ShiftHistory'>;

export function ShiftHistoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { shifts, loading, error, refresh } = useShiftHistory(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  // Re-fetch whenever History gains focus (tab switch or back from details).
  // refresh is stable for a given userId, so this does not loop.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1D4ED8" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />}
      >
        <View style={styles.header}>
          <Text style={styles.badge}>Driver Hub</Text>
          <Text style={styles.title}>Shift History</Text>
          <Text style={styles.subtitle}>Completed shifts, newest first.</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {shifts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No completed shifts yet</Text>
            <Text style={styles.emptyText}>
              Start and end a shift from the Dashboard to see it here.
            </Text>
          </View>
        ) : (
          shifts.map((shift) => {
            const hours = getShiftDurationHours(shift);
            const earnings = getShiftEarningsPence(shift);

            return (
              <Pressable
                key={shift.id}
                onPress={() => navigation.navigate('ShiftDetails', { shiftId: shift.id })}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowDate}>{formatDate(shift.start_time)}</Text>
                  <Text style={styles.rowTime}>
                    {formatTime(shift.start_time)} – {formatTime(shift.end_time!)}
                  </Text>
                  {shift.status === 'needs_review' ? (
                    <Text style={styles.reviewBadge}>{formatShiftStatus(shift.status)}</Text>
                  ) : null}
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowHours}>{formatHours(hours)}</Text>
                  <Text style={styles.rowEarnings}>{formatCurrency(earnings)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    marginBottom: 20,
  },
  reviewBadge: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 16,
  },
  rowDate: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  rowEarnings: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  rowHours: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  rowMain: {
    flex: 1,
    paddingRight: 12,
  },
  rowMeta: {
    alignItems: 'flex-end',
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowTime: {
    color: '#64748B',
    fontSize: 14,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  title: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '700',
  },
});
