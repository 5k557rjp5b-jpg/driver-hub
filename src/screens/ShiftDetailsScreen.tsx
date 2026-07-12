import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useBreaks } from '../hooks/useBreaks';
import { useEarningsAdjustments } from '../hooks/useEarningsAdjustments';
import { usePayConfiguration } from '../hooks/usePayConfiguration';
import { useShiftDetails } from '../hooks/useShiftHistory';
import type { HistoryStackParamList } from '../types';
import { calculatePay, formatCurrency } from '../utils/earnings';
import { formatDate, formatHours, formatTime, getShiftDurationHours } from '../utils/hours';

type Props = NativeStackScreenProps<HistoryStackParamList, 'ShiftDetails'>;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function ShiftDetailsScreen({ route }: Props) {
  const { user } = useAuth();
  const { shiftId } = route.params;
  const { shift, loading, error } = useShiftDetails(user?.id, shiftId);
  const { fetchConfigurationById } = usePayConfiguration(user?.id);
  const { breaks, loading: breaksLoading } = useBreaks(shiftId);
  const { adjustments, loading: adjustmentsLoading } = useEarningsAdjustments(shiftId);
  const [payConfig, setPayConfig] = useState<Awaited<
    ReturnType<typeof fetchConfigurationById>
  >['configuration']>(null);

  useEffect(() => {
    if (!shift?.pay_configuration_id) {
      return;
    }

    fetchConfigurationById(shift.pay_configuration_id).then((result) => {
      setPayConfig(result.configuration);
    });
  }, [shift?.pay_configuration_id, fetchConfigurationById]);

  if (loading || breaksLoading || adjustmentsLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1D4ED8" size="large" />
      </View>
    );
  }

  if (error || !shift) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredContent}>
          <Text style={styles.errorText}>{error ?? 'Shift not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hours = getShiftDurationHours(shift);
  const breakdown =
    shift.end_time && payConfig
      ? calculatePay(shift, payConfig, breaks, adjustments)
      : null;
  const finalEarnings =
    shift.final_earnings_pence ?? breakdown?.finalEarningsPence ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.badge}>Driver Hub</Text>
          <Text style={styles.title}>Shift Details</Text>
        </View>

        <View style={styles.card}>
          <DetailRow label="Date" value={formatDate(shift.start_time)} />
          <DetailRow label="Start Time" value={formatTime(shift.start_time)} />
          <DetailRow
            label="Finish Time"
            value={shift.end_time ? formatTime(shift.end_time) : 'In progress'}
          />
          <DetailRow label="Total Hours" value={formatHours(hours)} />
          <DetailRow label="Status" value={shift.status.replace('_', ' ')} />
          <DetailRow label="Final Pay" value={formatCurrency(finalEarnings)} />
        </View>

        {breakdown ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pay Breakdown</Text>
            <DetailRow label="Base Pay" value={formatCurrency(breakdown.basePayPence)} />
            <DetailRow label="Bonuses" value={formatCurrency(breakdown.bonusesPence)} />
            <DetailRow label="Deductions" value={formatCurrency(breakdown.deductionsPence)} />
            {breakdown.needsReview ? (
              <Text style={styles.reviewNote}>
                Deductions exceeded earnings. This shift is flagged for review.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Breaks</Text>
          {breaks.length === 0 ? (
            <Text style={styles.emptyText}>No breaks recorded.</Text>
          ) : (
            breaks.map((item) => (
              <Text key={item.id} style={styles.listRow}>
                {formatTime(item.start_time)}
                {' - '}
                {item.end_time ? formatTime(item.end_time) : 'In progress'}
                {' · '}
                {item.is_paid ? 'Paid' : 'Unpaid'}
              </Text>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Adjustments</Text>
          {adjustments.length === 0 ? (
            <Text style={styles.emptyText}>No adjustments recorded.</Text>
          ) : (
            adjustments.map((item) => (
              <Text key={item.id} style={styles.listRow}>
                {item.type === 'bonus' ? '+' : '-'}
                {formatCurrency(item.amount_pence)} {item.label}
              </Text>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.notesLabel}>Shift Notes</Text>
          <Text style={styles.notesValue}>
            {shift.notes.trim() ? shift.notes : 'No notes added for this shift.'}
          </Text>
          <Text style={styles.notesHint}>Note editing will be available in a future update.</Text>
        </View>
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
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 20,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flex: 1,
    justifyContent: 'center',
  },
  centeredContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  detailRow: {
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 14,
  },
  detailValue: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    marginBottom: 20,
  },
  listRow: {
    color: '#334155',
    fontSize: 14,
    marginBottom: 8,
  },
  notesHint: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 12,
  },
  notesLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesValue: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  reviewNote: {
    color: '#B45309',
    fontSize: 14,
    marginTop: 12,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '700',
  },
});
