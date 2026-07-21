import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { calculatePay } from '../utils/earnings';
import {
  createAuthenticatedUser,
  deleteUser,
  type TestUser,
} from '../test/integration/users';
import { endActiveShift } from './endActiveShift';
import { persistManualEarningsPence, persistShiftCount } from './shiftPayInputs';

/**
 * End-to-end verification for drop/stop/manual capture → endShift pay.
 * Mirrors the Dashboard flow against the disposable project.
 */

async function seedPayConfig(
  user: TestUser,
  payModel: 'per_drop' | 'per_stop' | 'manual',
  ratePence: number | null,
) {
  // Supersede any prior active config for this user.
  await user.client
    .from('pay_configurations')
    .update({ superseded_at: new Date().toISOString() })
    .eq('user_id', user.user.id)
    .is('superseded_at', null);

  const { data, error } = await user.client
    .from('pay_configurations')
    .insert({
      user_id: user.user.id,
      pay_model: payModel,
      rate_pence: ratePence,
      paid_breaks_enabled: false,
    })
    .select('*')
    .single();
  if (error) throw new Error(`seed pay config failed: ${error.message}`);
  return data;
}

async function seedActiveShift(user: TestUser, payConfigurationId: string) {
  const { data, error } = await user.client
    .from('shifts')
    .insert({
      user_id: user.user.id,
      pay_configuration_id: payConfigurationId,
      start_time: '2026-07-16T08:00:00.000Z',
      status: 'active',
      notes: '',
    })
    .select('*')
    .single();
  if (error) throw new Error(`seed shift failed: ${error.message}`);
  return data;
}

describe('shift pay inputs → endShift (integration)', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createAuthenticatedUser('pay-inputs');
  });

  afterAll(async () => {
    if (user?.user?.id) await deleteUser(user.user.id);
  });

  it('Per Drop: increments persist and endShift base pay = count × rate', async () => {
    const rate = 250;
    const config = await seedPayConfig(user, 'per_drop', rate);
    let shift = await seedActiveShift(user, config.id);

    expect(await persistShiftCount(user.client, shift.id, 'drop_count', 1)).toEqual({
      error: null,
    });
    expect(await persistShiftCount(user.client, shift.id, 'drop_count', 2)).toEqual({
      error: null,
    });
    expect(await persistShiftCount(user.client, shift.id, 'drop_count', 3)).toEqual({
      error: null,
    });

    const refreshed = await user.client
      .from('shifts')
      .select('*')
      .eq('id', shift.id)
      .single();
    shift = refreshed.data!;
    expect(shift.drop_count).toBe(3);

    const endAt = new Date('2026-07-16T12:00:00.000Z');
    const endResult = await endActiveShift(shift, user.client, () => endAt);
    expect(endResult.error).toBeNull();

    const completed = await user.client
      .from('shifts')
      .select('*')
      .eq('id', shift.id)
      .single();
    const expected = calculatePay(
      { ...shift, end_time: endAt.toISOString() },
      config,
      [],
      [],
    );

    expect(completed.data?.status).toBe('completed');
    expect(completed.data?.base_pay_pence).toBe(3 * rate);
    expect(completed.data?.final_earnings_pence).toBe(expected.finalEarningsPence);
    expect(completed.data?.base_pay_pence).toBe(expected.basePayPence);
  });

  it('Per Stop: increments persist and endShift base pay = count × rate', async () => {
    const rate = 400;
    const config = await seedPayConfig(user, 'per_stop', rate);
    let shift = await seedActiveShift(user, config.id);

    expect(await persistShiftCount(user.client, shift.id, 'stop_count', 2)).toEqual({
      error: null,
    });

    const refreshed = await user.client
      .from('shifts')
      .select('*')
      .eq('id', shift.id)
      .single();
    shift = refreshed.data!;
    expect(shift.stop_count).toBe(2);

    const endAt = new Date('2026-07-16T13:00:00.000Z');
    const endResult = await endActiveShift(shift, user.client, () => endAt);
    expect(endResult.error).toBeNull();

    const completed = await user.client
      .from('shifts')
      .select('*')
      .eq('id', shift.id)
      .single();
    expect(completed.data?.base_pay_pence).toBe(2 * rate);
    expect(completed.data?.final_earnings_pence).toBe(800);
    expect(completed.data?.status).toBe('completed');
  });

  it('Manual: saved pence become base/final earnings on endShift', async () => {
    const config = await seedPayConfig(user, 'manual', null);
    let shift = await seedActiveShift(user, config.id);

    expect(await persistManualEarningsPence(user.client, shift.id, 1250)).toEqual({
      error: null,
    });

    const refreshed = await user.client
      .from('shifts')
      .select('*')
      .eq('id', shift.id)
      .single();
    shift = refreshed.data!;
    expect(shift.manual_earnings_pence).toBe(1250);

    const endAt = new Date('2026-07-16T14:00:00.000Z');
    const endResult = await endActiveShift(shift, user.client, () => endAt);
    expect(endResult.error).toBeNull();

    const completed = await user.client
      .from('shifts')
      .select('*')
      .eq('id', shift.id)
      .single();
    expect(completed.data?.base_pay_pence).toBe(1250);
    expect(completed.data?.final_earnings_pence).toBe(1250);
    expect(completed.data?.status).toBe('completed');
  });
});
