import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getIntegrationEnv } from '../test/integration/env';
import {
  createAuthenticatedUser,
  deleteUser,
  type TestUser,
} from '../test/integration/users';

/**
 * Stage 3 — replace_pay_configuration RPC via PostgREST.
 *
 * This suite uses authenticated/anon Supabase clients (same path the app uses)
 * rather than direct `pg` sessions. Direct DB from this agent environment is
 * IPv6-only and unreachable; PostgREST still exercises:
 * - EXECUTE privilege (anon permission failure vs RLS empty result)
 * - auth.uid() cross-user guard inside the SECURITY DEFINER function
 * - advisory-lock concurrency (two simultaneous RPCs → one active row)
 */

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

async function replacePayConfiguration(
  client: SupabaseClient,
  userId: string,
  ratePence: number,
) {
  return client.rpc('replace_pay_configuration', {
    p_user_id: userId,
    p_pay_model: 'hourly',
    p_rate_pence: ratePence,
    p_paid_breaks_enabled: false,
  });
}

async function listConfigsForUser(userId: string) {
  const admin = adminClient();
  const { data, error } = await admin
    .from('pay_configurations')
    .select('id, user_id, rate_pence, superseded_at, effective_from')
    .eq('user_id', userId)
    .order('effective_from', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error(`admin list configs failed: ${error.message}`);
  return data ?? [];
}

describe('replace_pay_configuration RPC (integration)', () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createAuthenticatedUser('rpc-a');
    userB = await createAuthenticatedUser('rpc-b');

    const seedA = await userA.client.from('pay_configurations').insert({
      user_id: userA.user.id,
      pay_model: 'hourly',
      rate_pence: 1000,
      paid_breaks_enabled: false,
    });
    if (seedA.error) throw new Error(`seed A failed: ${seedA.error.message}`);

    const seedB = await userB.client.from('pay_configurations').insert({
      user_id: userB.user.id,
      pay_model: 'hourly',
      rate_pence: 2000,
      paid_breaks_enabled: false,
    });
    if (seedB.error) throw new Error(`seed B failed: ${seedB.error.message}`);
  });

  afterAll(async () => {
    if (userA?.user?.id) await deleteUser(userA.user.id);
    if (userB?.user?.id) await deleteUser(userB.user.id);
  });

  it('privilege: anon cannot EXECUTE (permission/auth failure, not empty RLS result)', async () => {
    const { data, error } = await replacePayConfiguration(anonClient(), userA.user.id, 1234);

    // Must fail hard — a revoked EXECUTE surfaces as an error, not success/null rows.
    expect(error).not.toBeNull();
    expect(data).toBeNull();
    // Exact gap we found in production: anon still had EXECUTE until REVOKE.
    expect(error?.code).toBe('42501');
    expect(error?.message.toLowerCase()).toContain('permission denied');
    expect(error?.message.toLowerCase()).toContain('replace_pay_configuration');
  });

  it('cross-user auth: A cannot replace B config; rows unchanged', async () => {
    const beforeA = await listConfigsForUser(userA.user.id);
    const beforeB = await listConfigsForUser(userB.user.id);

    const { data, error } = await replacePayConfiguration(userA.client, userB.user.id, 9999);

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Not authorized to modify this user's pay configuration");

    const afterA = await listConfigsForUser(userA.user.id);
    const afterB = await listConfigsForUser(userB.user.id);
    expect(afterA).toEqual(beforeA);
    expect(afterB).toEqual(beforeB);
  });

  it('concurrency: two simultaneous calls both succeed; exactly one active remains', async () => {
    const before = await listConfigsForUser(userA.user.id);
    const beforeActive = before.filter((row) => row.superseded_at == null);
    expect(beforeActive).toHaveLength(1);
    const seedRate = beforeActive[0].rate_pence as number;

    const rate1 = 1500;
    const rate2 = 1600;

    // Two independent authenticated sessions for the same user (separate JWTs /
    // HTTP clients) so the race is real, not a single-connection serialization.
    const env = getIntegrationEnv();
    const client1 = createClient(env.supabaseUrl, env.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const client2 = createClient(env.supabaseUrl, env.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const signIn1 = await client1.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    const signIn2 = await client2.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    if (signIn1.error || signIn2.error) {
      throw new Error(
        `twin sign-in failed: ${signIn1.error?.message ?? signIn2.error?.message}`,
      );
    }

    const [result1, result2] = await Promise.all([
      replacePayConfiguration(client1, userA.user.id, rate1),
      replacePayConfiguration(client2, userA.user.id, rate2),
    ]);

    expect(result1.error).toBeNull();
    expect(result2.error).toBeNull();
    expect(result1.data).toBeTruthy();
    expect(result2.data).toBeTruthy();

    const rateOf = (row: unknown): number | undefined => {
      if (Array.isArray(row)) return row[0]?.rate_pence as number | undefined;
      return (row as { rate_pence?: number } | null)?.rate_pence;
    };
    const returnedRates = [rateOf(result1.data), rateOf(result2.data)];
    expect(returnedRates).toEqual(expect.arrayContaining([rate1, rate2]));
    expect(new Set(returnedRates).size).toBe(2);

    const after = await listConfigsForUser(userA.user.id);
    const active = after.filter((row) => row.superseded_at == null);
    const superseded = after.filter((row) => row.superseded_at != null);

    expect(active).toHaveLength(1);
    expect([rate1, rate2]).toContain(active[0].rate_pence);
    expect(active[0].rate_pence).not.toBe(seedRate);
    expect(superseded.length).toBeGreaterThanOrEqual(1);

    const supersededRates = superseded.map((row) => row.rate_pence);
    const otherSubmitted = active[0].rate_pence === rate1 ? rate2 : rate1;
    expect(
      supersededRates.includes(otherSubmitted) || supersededRates.includes(seedRate),
    ).toBe(true);
  });
});
