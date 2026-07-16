import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { getIntegrationEnv } from './env';

export type TestUser = {
  user: User;
  email: string;
  password: string;
  client: SupabaseClient;
};

function adminClient(): SupabaseClient {
  const env = getIntegrationEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function anonClient(): SupabaseClient {
  const env = getIntegrationEnv();
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createAuthenticatedUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `it-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = `TestPass-${Math.random().toString(36).slice(2)}-9aA!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create test user ${label}: ${error?.message ?? 'unknown'}`);
  }

  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.user) {
    throw new Error(`Failed to sign in test user ${label}: ${signIn.error?.message ?? 'unknown'}`);
  }

  return { user: signIn.data.user, email, password, client };
}

export async function deleteUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

export async function seedOwnedGraph(user: TestUser) {
  const profile = await user.client.from('user_profiles').insert({
    id: user.user.id,
    auth_provider: 'email',
    email: user.email,
    employment_type: 'self_employed',
  }).select('*').single();
  if (profile.error) {
    throw new Error(`seed user_profiles failed: ${profile.error.message}`);
  }

  const payConfig = await user.client.from('pay_configurations').insert({
    user_id: user.user.id,
    pay_model: 'hourly',
    rate_pence: 1650,
    paid_breaks_enabled: false,
  }).select('*').single();
  if (payConfig.error) {
    throw new Error(`seed pay_configurations failed: ${payConfig.error.message}`);
  }

  const shift = await user.client.from('shifts').insert({
    user_id: user.user.id,
    pay_configuration_id: payConfig.data.id,
    start_time: new Date().toISOString(),
    status: 'active',
    notes: '',
  }).select('*').single();
  if (shift.error) {
    throw new Error(`seed shifts failed: ${shift.error.message}`);
  }

  const breakRow = await user.client.from('breaks').insert({
    shift_id: shift.data.id,
    start_time: new Date().toISOString(),
    is_paid: false,
  }).select('*').single();
  if (breakRow.error) {
    throw new Error(`seed breaks failed: ${breakRow.error.message}`);
  }

  const adjustment = await user.client.from('earnings_adjustments').insert({
    shift_id: shift.data.id,
    type: 'bonus',
    label: 'Seed bonus',
    amount_pence: 100,
  }).select('*').single();
  if (adjustment.error) {
    throw new Error(`seed earnings_adjustments failed: ${adjustment.error.message}`);
  }

  const summary = await user.client.from('earnings_summaries').insert({
    user_id: user.user.id,
    period_type: 'daily',
    period_start: new Date().toISOString().slice(0, 10),
    total_earnings_pence: 0,
    shift_count: 0,
  }).select('*').single();
  if (summary.error) {
    throw new Error(`seed earnings_summaries failed: ${summary.error.message}`);
  }

  const syncOp = await user.client.from('sync_operations').insert({
    user_id: user.user.id,
    entity_type: 'shift',
    entity_id: shift.data.id,
    operation: 'create',
    payload: { seeded: true },
    status: 'pending',
  }).select('*').single();
  if (syncOp.error) {
    throw new Error(`seed sync_operations failed: ${syncOp.error.message}`);
  }

  return {
    profile: profile.data,
    payConfig: payConfig.data,
    shift: shift.data,
    breakRow: breakRow.data,
    adjustment: adjustment.data,
    summary: summary.data,
    syncOp: syncOp.data,
  };
}
