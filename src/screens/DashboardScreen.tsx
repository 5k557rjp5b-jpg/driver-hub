import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { useBreaks } from '../hooks/useBreaks';
import { useEarningsAdjustments } from '../hooks/useEarningsAdjustments';
import { usePayConfiguration } from '../hooks/usePayConfiguration';
import { useShifts } from '../hooks/useShifts';
import {
  calculateDailyEarningsPence,
  calculateMonthlyEarningsPence,
  calculateWeeklyEarningsPence,
  formatCurrency,
} from '../utils/earnings';
import {
  calculateTodayHours,
  calculateWeekHours,
  formatHours,
  formatTime,
  getShiftDurationHours,
} from '../utils/hours';

export function DashboardScreen() {
  const { user } = useAuth();
  const {
    activeShift,
    todayShifts,
    periodShifts,
    loading,
    error,
    actionLoading,
    startShift,
    endShift,
    refresh,
  } = useShifts(user?.id);
  const { configuration, hasActiveConfiguration, loading: payLoading } =
    usePayConfiguration(user?.id);
  const {
    activeBreak,
    actionLoading: breakActionLoading,
    startBreak,
    endBreak,
    error: breakError,
  } = useBreaks(activeShift?.id, configuration?.paid_breaks_enabled ?? false);
  const {
    adjustments,
    actionLoading: adjustmentActionLoading,
    addAdjustment,
    error: adjustmentError,
  } = useEarningsAdjustments(activeShift?.id);

  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [adjustmentLabel, setAdjustmentLabel] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'bonus' | 'deduction'>('bonus');

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const todayHours = calculateTodayHours(periodShifts, now);
  const weekHours = calculateWeekHours(periodShifts, now);
  const todayEarnings = calculateDailyEarningsPence(periodShifts, now, now);
  const weekEarnings = calculateWeeklyEarningsPence(periodShifts, now);
  const monthEarnings = calculateMonthlyEarningsPence(periodShifts, now);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleAddAdjustment = async () => {
    const pounds = parseFloat(adjustmentAmount);
    if (Number.isNaN(pounds) || pounds <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than £0.00.');
      return;
    }

    const result = await addAdjustment({
      type: adjustmentType,
      label: adjustmentLabel,
      amount_pence: Math.round(pounds * 100),
    });

    if (!result.error) {
      setAdjustmentLabel('');
      setAdjustmentAmount('');
    }
  };

  if (loading || payLoading) {
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
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {!hasActiveConfiguration ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Complete Pay Setup in Profile before starting a shift.
            </Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard label="Today's Hours" value={formatHours(todayHours)} />
          <StatCard label="Today's Earnings" value={formatCurrency(todayEarnings)} />
          <StatCard label="This Week's Hours" value={formatHours(weekHours)} />
          <StatCard label="This Week's Earnings" value={formatCurrency(weekEarnings)} />
          <StatCard
            hint="Completed shifts only"
            label="This Month's Earnings"
            style={styles.fullWidthCard}
            value={formatCurrency(monthEarnings)}
          />
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
            disabled={!!activeShift || !hasActiveConfiguration}
            loading={actionLoading && !activeShift}
            onPress={startShift}
            title="Start Shift"
          />
          <Button
            disabled={!activeShift}
            loading={actionLoading && !!activeShift}
            onPress={endShift}
            title="End Shift"
            variant="danger"
          />
        </View>

        {activeShift ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Breaks</Text>
            <Text style={styles.cardHint}>
              {activeBreak
                ? `On break since ${formatTime(activeBreak.start_time)}`
                : 'No active break.'}
            </Text>
            {breakError ? <Text style={styles.inlineError}>{breakError}</Text> : null}
            <View style={styles.inlineActions}>
              <Button
                disabled={!!activeBreak}
                loading={breakActionLoading && !activeBreak}
                onPress={startBreak}
                style={styles.inlineButton}
                title="Start Break"
                variant="secondary"
              />
              <Button
                disabled={!activeBreak}
                loading={breakActionLoading && !!activeBreak}
                onPress={endBreak}
                style={styles.inlineButton}
                title="End Break"
                variant="secondary"
              />
            </View>
          </View>
        ) : null}

        {activeShift ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Adjustments</Text>
            <Text style={styles.cardHint}>
              Add bonuses or deductions before ending the shift.
            </Text>
            {adjustments.map((item) => (
              <Text key={item.id} style={styles.adjustmentRow}>
                {item.type === 'bonus' ? '+' : '-'}
                {formatCurrency(item.amount_pence)} {item.label}
              </Text>
            ))}
            <View style={styles.typeRow}>
              {(['bonus', 'deduction'] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setAdjustmentType(type)}
                  style={[
                    styles.typePill,
                    adjustmentType === type && styles.typePillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typePillText,
                      adjustmentType === type && styles.typePillTextActive,
                    ]}
                  >
                    {type === 'bonus' ? 'Bonus' : 'Deduction'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.adjustmentForm}>
              <Input
                label="Label"
                onChangeText={setAdjustmentLabel}
                placeholder="Fuel, bonus, etc."
                value={adjustmentLabel}
              />
              <Input
                keyboardType="decimal-pad"
                label="Amount (£)"
                onChangeText={setAdjustmentAmount}
                placeholder="10.00"
                value={adjustmentAmount}
              />
            </View>
            {adjustmentError ? <Text style={styles.inlineError}>{adjustmentError}</Text> : null}
            <Button
              loading={adjustmentActionLoading}
              onPress={handleAddAdjustment}
              title="Add Adjustment"
              variant="secondary"
            />
          </View>
        ) : null}

        {todayShifts.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Today&apos;s Shifts</Text>
            {todayShifts.map((shift) => (
              <View key={shift.id} style={styles.shiftRow}>
                <Text style={styles.shiftRowTime}>
                  {formatTime(shift.start_time)}
                  {' - '}
                  {shift.end_time ? formatTime(shift.end_time) : 'In progress'}
                </Text>
                <Text style={styles.shiftRowDuration}>
                  {formatHours(getShiftDurationHours(shift, now))}
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
  adjustmentForm: {
    gap: 8,
    marginBottom: 12,
  },
  adjustmentRow: {
    color: '#334155',
    fontSize: 14,
    marginBottom: 6,
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
  fullWidthCard: {
    minWidth: '100%',
  },
  header: {
    marginBottom: 20,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  inlineButton: {
    flex: 1,
  },
  inlineError: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 8,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
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
  typePill: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typePillActive: {
    backgroundColor: '#DBEAFE',
  },
  typePillText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: '#1D4ED8',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
  },
  warningText: {
    color: '#92400E',
    fontSize: 14,
    textAlign: 'center',
  },
});
