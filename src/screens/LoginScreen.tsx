import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import type { AuthStackParamList } from '../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await signIn(email.trim(), password);
    if (result.error) {
      setError(result.error);
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage your shifts.</Text>
        </View>

        {!isSupabaseConfigured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Supabase not configured</Text>
            <Text style={styles.noticeText}>
              Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file.
            </Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Input
            autoComplete="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="driver@example.com"
            value={email}
          />
          <Input
            autoComplete="password"
            label="Password"
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            value={password}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button loading={loading} onPress={handleLogin} title="Sign In" />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Need an account?</Text>
          <Button
            onPress={() => navigation.navigate('SignUp')}
            title="Create Account"
            variant="secondary"
          />
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
    gap: 12,
    marginTop: 24,
  },
  footerText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  header: {
    marginBottom: 32,
  },
  notice: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginBottom: 20,
    padding: 16,
  },
  noticeText: {
    color: '#92400E',
    fontSize: 14,
    lineHeight: 20,
  },
  noticeTitle: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    color: '#0F172A',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
});
