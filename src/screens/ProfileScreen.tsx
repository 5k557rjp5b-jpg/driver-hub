import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { useWageSettings } from '../hooks/useWageSettings';

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { settings, loading, saving, error, saveSettings } = useWageSettings(user?.id);

  const [hourlyRate, setHourlyRate] = useState('');
  const [overtimeRate, setOvertimeRate] = useState('');
  const [overtimeThreshold, setOvertimeThreshold] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setHourlyRate(String(settings.hourly_rate));
      setOvertimeRate(String(settings.overtime_rate));
      setOvertimeThreshold(String(settings.overtime_threshold_hours));
      setInitialized(true);
    }
  }, [settings, initialized]);

  const handleSave = async () => {
    const hourly = parseFloat(hourlyRate);
    const overtime = parseFloat(overtimeRate);
    const threshold = parseFloat(overtimeThreshold);

    if (Number.isNaN(hourly) || hourly < 0) {
      setFormError('Enter a valid standard hourly rate.');
      return;
    }

    if (Number.isNaN(overtime) || overtime < 0) {
      setFormError('Enter a valid overtime hourly rate.');
      return;
    }

    if (Number.isNaN(threshold) || threshold <= 0) {
      setFormError('Overtime threshold must be greater than 0 hours.');
      return;
    }

    setFormError(null);
    setSuccess(null);

    const result = await saveSettings({
      hourly_rate: hourly,
      overtime_rate: overtime,
      overtime_threshold_hours: threshold,
      currency: 'GBP',
    });

    if (result.error) {
      setFormError(result.error);
    } else {
      setSuccess('Wage settings saved.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
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
          <Text style={styles.badge}>Driver Hub</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wage Settings</Text>
          <Text style={styles.cardHint}>
            Configure your rates to calculate estimated earnings across the app.
          </Text>

          <View style={styles.form}>
            <Input
              keyboardType="decimal-pad"
              label="Standard Hourly Rate (£)"
              onChangeText={setHourlyRate}
              placeholder="12.00"
              value={hourlyRate}
            />
            <Input
              keyboardType="decimal-pad"
              label="Overtime Hourly Rate (£)"
              onChangeText={setOvertimeRate}
              placeholder="18.00"
              value={overtimeRate}
            />
            <Input
              keyboardType="decimal-pad"
              label="Overtime Begins After (hours)"
              onChangeText={setOvertimeThreshold}
              placeholder="8"
              value={overtimeThreshold}
            />
            <View style={styles.currencyRow}>
              <Text style={styles.currencyLabel}>Currency</Text>
              <Text style={styles.currencyValue}>£ GBP</Text>
            </View>

            {formError || error ? (
              <Text style={styles.error}>{formError ?? error}</Text>
            ) : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <Button loading={saving} onPress={handleSave} title="Save Settings" />
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
  success: {
    color: '#15803D',
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '700',
  },
});
