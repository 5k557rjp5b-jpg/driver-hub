import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, Platform, type TextInputProps, View } from 'react-native';

type InputProps = TextInputProps & {
  label: string;
  error?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, style, keyboardType, ...props },
  ref,
) {
  // react-native-web maps keyboardType="email-address" → type="email", which can
  // surface browser-native format rejection. Prefer inputMode for mobile keyboards
  // while keeping type="text" on web so multi-part TLDs (.co.uk) are not blocked.
  const webEmailOverride =
    Platform.OS === 'web' && keyboardType === 'email-address'
      ? ({ type: 'text', inputMode: 'email' } as const)
      : null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        autoCapitalize="none"
        keyboardType={keyboardType}
        placeholderTextColor="#94A3B8"
        style={[styles.input, error ? styles.inputError : null, style]}
        {...webEmailOverride}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
    width: '100%',
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: '#DC2626',
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
});
