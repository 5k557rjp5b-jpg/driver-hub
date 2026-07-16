import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PayConfiguration, Shift } from '../types';
import { calculatePay } from '../utils/earnings';
import { createClient } from '@supabase/supabase-js';

import { getIntegrationEnv } from '../test/integration/env';
import {
  createAuthenticatedUser,
  deleteUser,
  type TestUser,
} from '../test/integration/users';
import { endActiveShift } from './endActiveShift';

/**
 * Stage 4 — endActiveShift against the disposable project.
 *
 * Fetch-error abort behavior is also covered in endActiveShift.test.ts (unit).
 * This suite asserts the real write path plus DB-level abort (row stays active).
 */

function sameInstant(a: string | null, b: string): boolean {
  if (!a) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

async function seedActiveShift(
  user: TestUser,
  payConfig: PayConfiguration,
  options: {
    startTime: string;
    deductionPence?: number;
  },
): Promise<Shift> {
  const shift = await user.client
    .from('shifts')
    .insert({
      user_id: user.user.id,
      pay_configuration_id: payConfig.id,
      start_time: options.startTime,
      status: 'active',
      notes: '',
    })
    .select('*')
    .single();
  if (shift.error) {
    throw new Error(`seed shift failed: ${shift.error.message}`);
  }

  if (options.deductionPence != null) {
    const adjustment = await user.client.from('earnings_adjustments').insert({
      shift_id: shift.data.id,
      type: 'deduction',
      label: 'Stage 4 deduction',
      amount_pence: options.deductionPence,
    });
    if (adjustment.error) {
      throw new Error(`seed deduction failed: ${adjustment.error.message}`);
    }
  }

  return shift.data as Shift;
}

async function readShift(user: TestUser, shiftId: string): Promise<Shift> {
  const { data, error } = await user.client
    .from('shifts')
    .select('*')
    .eq('id', shiftId)
    .single();
  if (error || !data) {
    throw new Error(`read shift failed: ${error?.message ?? 'missing row'}`);
  }
  return data as Shift;
}

describe('endActiveShift (integration)', () => {
  let user: TestUser;
  let payConfig: PayConfiguration;

  beforeAll(async () => {
    user = await createAuthenticatedUser('end-shift');
    const seeded = await user.client
      .from('pay_configurations')
      .insert({
        user_id: user.user.id,
        pay_model: 'fixed_shift',
        rate_pence: 5000,
        paid_breaks_enabled: false,
      })
      .select('*')
      .single();
    if (seeded.error) {
      throw new Error(`seed pay config failed: ${seeded.error.message}`);
    }
    payConfig = seeded.data as PayConfiguration;
  });

  afterAll(async () => {
    if (user?.user?.id) await deleteUser(user.user.id);
  });

  it('happy path: writes base_pay_pence, final_earnings_pence, status completed', async () => {
    const shift = await seedActiveShift(user, payConfig, {
      startTime: '2026-07-10T08:00:00.000Z',
    });

    const endAt = new Date('2026-07-10T16:00:00.000Z');
    const result = await endActiveShift(shift, user.client, () => endAt);
    expect(result.error).toBeNull();

    const updated = await readShift(user, shift.id);
    expect(sameInstant(updated.end_time, endAt.toISOString())).toBe(true);
    expect(updated.status).toBe('completed');
    expect(updated.base_pay_pence).toBe(5000);
    expect(updated.final_earnings_pence).toBe(5000);

    const expected = calculatePay(
      { ...shift, end_time: endAt.toISOString() },
      payConfig,
      [],
      [],
    );
    expect(updated.base_pay_pence).toBe(expected.basePayPence);
    expect(updated.final_earnings_pence).toBe(expected.finalEarningsPence);
    expect(expected.needsReview).toBe(false);
  });

  it('happy path: deductions exceeding earnings → needs_review and final 0', async () => {
    const shift = await seedActiveShift(user, payConfig, {
      startTime: '2026-07-11T08:00:00.000Z',
      deductionPence: 7500,
    });

    const endAt = new Date('2026-07-11T16:00:00.000Z');
    const result = await endActiveShift(shift, user.client, () => endAt);
    expect(result.error).toBeNull();

    const updated = await readShift(user, shift.id);
    expect(sameInstant(updated.end_time, endAt.toISOString())).toBe(true);
    expect(updated.status).toBe('needs_review');
    expect(updated.base_pay_pence).toBe(5000);
    expect(updated.final_earnings_pence).toBe(0);
  });

  it.each([
    ['pay_configurations', 'pay_configurations boom'],
    ['breaks', 'breaks boom'],
    ['earnings_adjustments', 'earnings_adjustments boom'],
  ] as const)(
    'fetch-error abort: %s failure leaves shift active in DB',
    async (failingTable, message) => {
      const hour = { pay_configurations: 8, breaks: 9, earnings_adjustments: 10 }[
        failingTable
      ];
      const shift = await seedActiveShift(user, payConfig, {
        startTime: `2026-07-12T${String(hour).padStart(2, '0')}:00:00.000Z`,
      });

      // Inject a per-table fetch failure while leaving shifts.update real —
      // proves endActiveShift aborts before writing earnings.
      const failingClient = {
        from(table: string) {
          if (table === failingTable) {
            if (table === 'pay_configurations') {
              return {
                select() {
                  return {
                    eq() {
                      return {
                        async maybeSingle() {
                          return { data: null, error: { message } };
                        },
                      };
                    },
                  };
                },
              };
            }
            return {
              select() {
                return {
                  async eq() {
                    return { data: null, error: { message } };
                  },
                };
              },
            };
          }
          return user.client.from(table);
        },
      };

      const result = await endActiveShift(shift, failingClient as never);
      expect(result.error).toBe(message);

      const unchanged = await readShift(user, shift.id);
      expect(unchanged.end_time).toBeNull();
      expect(unchanged.status).toBe('active');
      expect(unchanged.base_pay_pence).toBeNull();
      expect(unchanged.final_earnings_pence).toBeNull();

      // Clear the still-active row so the next case can insert under the
      // one-active-shift-per-user constraint. Authenticated has no DELETE
      // policy on shifts — use service role for test cleanup only.
      const env = getIntegrationEnv();
      const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const cleanup = await admin.from('shifts').delete().eq('id', shift.id);
      if (cleanup.error) {
        throw new Error(`cleanup shift failed: ${cleanup.error.message}`);
      }
    },
  );
});
