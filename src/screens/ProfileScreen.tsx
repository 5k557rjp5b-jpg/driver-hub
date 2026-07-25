import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_PAY_CONFIGURATION,
  usePayConfiguration,
  validatePayConfiguration,
} from '../hooks/usePayConfiguration';
import type { PayModel } from '../types';
import { confirmAction } from '../utils/confirmAction';
import { isRateBasedPayModel } from '../utils/earnings';

const PAY_MODEL_OPTIONS: { value: PayModel; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'fixed_shift', label: 'Fixed Shift' },
  { value: 'per_drop', label: 'Per Drop' },
  { value: 'per_stop', label: 'Per Stop' },
  { value: 'manual', label: 'Manual' },
];

/** Display-only rate field label — Manual has no rate input. */
function rateFieldLabel(payModel: PayModel): string {
  switch (payModel) {
    case 'hourly':
      return 'Hourly rate (£)';
    case 'fixed_shift':
      return 'Fixed shift amount (£)';
    case 'per_drop':
      return 'Rate per drop (£)';
    case 'per_stop':
      return 'Rate per stop (£)';
    case 'manual':
      return 'Rate (£)';
    default: {
      const _exhaustive: never = payModel;
      return _exhaustive;
    }
  }
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { configuration, loading, saving, error, saveConfiguration } =
    usePayConfiguration(user?.id);

  const [payModel, setPayModel] = useState<PayModel>(DEFAULT_PAY_CONFIGURATION.pay_model);
  const [ratePounds, setRatePounds] = useState('');
  const [paidBreaksEnabled, setPaidBreaksEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (configuration && !initialized) {
      setPayModel(configuration.pay_model);
      setRatePounds(
        configuration.rate_pence != null ? String(configuration.rate_pence / 100) : '',
      );
      setPaidBreaksEnabled(configuration.paid_breaks_enabled);
      setInitialized(true);
    }
  }, [configuration, initialized]);

  const handleSave = async () => {
    const ratePence = ratePounds.trim()
      ? Math.round(parseFloat(ratePounds) * 100)
      : null;

    if (isRateBasedPayModel(payModel) && (ratePence == null || Number.isNaN(ratePence))) {
      setFormError('Enter a valid rate for this pay model.');
      return;
    }

    const values = {
      pay_model: payModel,
      rate_pence: ratePence,
      paid_breaks_enabled: paidBreaksEnabled,
    };

    const validationError = validatePayConfiguration(values);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    setSuccess(null);

    const result = await saveConfiguration(values);
    if (result.error) {
      setFormError(result.error);
    } else {
      setSuccess('Pay setup saved.');
      setInitialized(false);
    }
  };

  const handleSignOut = async () => {
    const confirmed = await confirmAction({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign Out',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    await signOut();
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.badge}>Nearside</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pay Setup</Text>
          <Text style={styles.cardHint}>
            Configure how your shifts are paid. Saving creates a new configuration and
            preserves history for past shifts.
          </Text>

          <View style={styles.form}>
            <Text style={styles.sectionLabel}>Pay Model</Text>
            <View style={styles.modelGrid}>
              {PAY_MODEL_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setPayModel(option.value)}
                  style={[
                    styles.modelPill,
                    payModel === option.value && styles.modelPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modelPillText,
                      payModel === option.value && styles.modelPillTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {isRateBasedPayModel(payModel) ? (
              <Input
                keyboardType="decimal-pad"
                label={rateFieldLabel(payModel)}
                onChangeText={setRatePounds}
                placeholder="16.50"
                value={ratePounds}
              />
            ) : null}

            {payModel === 'hourly' ? (
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchLabel}>Paid Breaks</Text>
                  <Text style={styles.switchHint}>
                    When enabled, break time counts toward hourly pay.
                  </Text>
                </View>
                <Switch onValueChange={setPaidBreaksEnabled} value={paidBreaksEnabled} />
              </View>
            ) : null}

            <View style={styles.currencyRow}>
              <Text style={styles.currencyLabel}>Currency</Text>
              <Text style={styles.currencyValue}>£ GBP</Text>
            </View>

            {formError || error ? (
              <Text style={styles.error}>{formError ?? error}</Text>
            ) : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <Button loading={saving} onPress={handleSave} title="Save Pay Setup" />
          </View>
        </View>

        <Button onPress={handleSignOut} title="Sign Out" variant="secondary" />
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
    marginBottom: 20,
    padding: 20,
  },
  cardHint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
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
  currencyLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  currencyRow: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  currencyValue: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  email: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  error: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  header: {
    marginBottom: 20,
  },
  modelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelPill: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modelPillActive: {
    backgroundColor: '#DBEAFE',
  },
  modelPillText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  modelPillTextActive: {
    color: '#1D4ED8',
  },
  sectionLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  success: {
    color: '#15803D',
    fontSize: 14,
    textAlign: 'center',
  },
  switchCopy: {
    flex: 1,
    paddingRight: 12,
  },
  switchHint: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  switchLabel: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '700',
  },
});
