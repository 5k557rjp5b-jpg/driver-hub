import { StyleSheet, Text, View, type ViewProps } from 'react-native';

type StatCardProps = ViewProps & {
  label: string;
  value: string;
  hint?: string;
};

export function StatCard({ label, value, hint, style, ...props }: StatCardProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: '46%',
    padding: 16,
  },
  hint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  label: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  value: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '700',
  },
});
