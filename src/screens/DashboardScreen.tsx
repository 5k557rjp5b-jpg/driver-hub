import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useShifts } from '../hooks/useShifts';
import {
  calculateTodayHours,
  formatHours,
  formatTime,
  getShiftDurationMs,
} from '../utils/hours';

export function DashboardScreen() {
  const { user, signOut } = useAuth();
  const {
    shifts,
    activeShift,
    loading,
    error,
    actionLoading,
    startShift,
    endShift,
    refresh,
  } = useShifts(user?.id);

  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const todayHours = calculateTodayHours(shifts, now);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleStartShift = async () => {
    await startShift();
  };

  const handleEndShift = async () => {
    await endShift();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1D4ED8" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.badge}>Driver Hub</Text>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <Button
            onPress={signOut}
            style={styles.signOutButton}
            title="Sign Out"
            variant="secondary"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Today&apos;s Hours</Text>
          <Text style={styles.hoursValue}>{formatHours(todayHours)}</Text>
          <Text style={styles.cardHint}>Includes your current shift if one is active.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Shift Status</Text>
          <View style={[styles.statusPill, activeShift ? styles.statusActive : styles.statusIdle]}>
            <Text style={styles.statusText}>{activeShift ? 'On Shift' : 'Off Shift'}</Text>
          </View>

          {activeShift ? (
            <View style={styles.shiftDetails}>
              <Text style={styles.shiftDetailLabel}>Started at</Text>
              <Text style={styles.shiftDetailValue}>{formatTime(activeShift.start_time)}</Text>
            </View>
          ) : (
            <Text style={styles.cardHint}>Tap Start Shift when you begin driving.</Text>
          )}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            disabled={!!activeShift}
            loading={actionLoading && !activeShift}
            onPress={handleStartShift}
            title="Start Shift"
          />
          <Button
            disabled={!activeShift}
            loading={actionLoading && !!activeShift}
            onPress={handleEndShift}
            title="End Shift"
            variant="danger"
          />
        </View>

        {shifts.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Today&apos;s Shifts</Text>
            {shifts.map((shift) => (
              <View key={shift.id} style={styles.shiftRow}>
                <Text style={styles.shiftRowTime}>
                  {formatTime(shift.start_time)}
                  {' - '}
                  {shift.end_time ? formatTime(shift.end_time) : 'In progress'}
                </Text>
                <Text style={styles.shiftRowDuration}>
                  {formatHours(getShiftDurationMs(shift, now) / (1000 * 60 * 60))}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginBottom: 20,
  },
  badge: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 20,
  },
  cardHint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  cardLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
  email: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  hoursValue: {
    color: '#0F172A',
    fontSize: 40,
    fontWeight: '700',
  },
  shiftDetailLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  shiftDetailValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  shiftDetails: {
    marginTop: 12,
  },
  shiftRow: {
    alignItems: 'center',
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  shiftRowDuration: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  shiftRowTime: {
    color: '#334155',
    fontSize: 14,
  },
  signOutButton: {
    minHeight: 40,
    paddingHorizontal: 12,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusIdle: {
    backgroundColor: '#E2E8F0',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '700',
  },
});
