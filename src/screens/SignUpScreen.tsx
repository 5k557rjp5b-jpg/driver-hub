import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import type { AuthStackParamList } from '../types';
import { isValidEmail } from '../utils/email';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await signUp(email.trim(), password);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Account created. You can sign in now.');
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.badge}>Driver Hub</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Set up your driver profile to track shifts.</Text>
        </View>

        <View style={styles.form}>
          <Input
            autoComplete="email"
            blurOnSubmit={false}
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="driver@example.com"
            returnKeyType="next"
            value={email}
          />
          <Input
            ref={passwordRef}
            autoComplete="password-new"
            blurOnSubmit={false}
            label="Password"
            onChangeText={setPassword}
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            placeholder="At least 6 characters"
            returnKeyType="next"
            secureTextEntry
            value={password}
          />
          <Input
            ref={confirmPasswordRef}
            autoComplete="password-new"
            label="Confirm Password"
            onChangeText={setConfirmPassword}
            onSubmitEditing={() => {
              void handleSignUp();
            }}
            placeholder="Repeat your password"
            returnKeyType="go"
            secureTextEntry
            value={confirmPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}
          <Button loading={loading} onPress={handleSignUp} title="Create Account" />
        </View>

        <View style={styles.footer}>
          <Button onPress={() => navigation.navigate('Login')} title="Back to Sign In" variant="secondary" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 16,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  container: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    marginTop: 24,
  },
  form: {
    gap: 16,
  },
  header: {
    marginBottom: 32,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24,
  },
  success: {
    color: '#15803D',
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    color: '#0F172A',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
});
