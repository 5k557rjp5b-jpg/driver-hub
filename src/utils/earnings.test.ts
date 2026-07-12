import { describe, expect, it } from 'vitest';

import type { Break, EarningsAdjustment, PayConfiguration, Shift } from '../types';
import { calculatePay } from './earnings';

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'shift-1',
    user_id: 'user-1',
    pay_configuration_id: 'config-1',
    start_time: '2026-07-10T08:00:00.000Z',
    end_time: '2026-07-10T16:30:00.000Z',
    status: 'completed',
    drop_count: null,
    stop_count: null,
    manual_earnings_pence: null,
    base_pay_pence: null,
    final_earnings_pence: null,
    notes: '',
    updated_at: '2026-07-10T16:30:00.000Z',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<PayConfiguration> = {}): PayConfiguration {
  return {
    id: 'config-1',
    user_id: 'user-1',
    pay_model: 'hourly',
    rate_pence: 1650,
    paid_breaks_enabled: false,
    effective_from: '2026-07-10T00:00:00.000Z',
    superseded_at: null,
    ...overrides,
  };
}

function makeBreak(overrides: Partial<Break> = {}): Break {
  return {
    id: 'break-1',
    shift_id: 'shift-1',
    start_time: '2026-07-10T12:00:00.000Z',
    end_time: '2026-07-10T12:30:00.000Z',
    is_paid: false,
    ...overrides,
  };
}

function makeAdjustment(overrides: Partial<EarningsAdjustment> = {}): EarningsAdjustment {
  return {
    id: 'adj-1',
    shift_id: 'shift-1',
    type: 'bonus',
    label: 'Bonus',
    amount_pence: 1000,
    ...overrides,
  };
}

describe('calculatePay', () => {
  it('hourly: £16.50/hr, 08:00–16:30, 30min unpaid break → 13200p', () => {
    const result = calculatePay(makeShift(), makeConfig(), [makeBreak()], []);
    expect(result.finalEarningsPence).toBe(13200);
    expect(result.needsReview).toBe(false);
  });

  it('fixed: £180.00 fixed → 18000p', () => {
    const result = calculatePay(
      makeShift(),
      makeConfig({ pay_model: 'fixed_shift', rate_pence: 18000 }),
      [],
      [],
    );
    expect(result.finalEarningsPence).toBe(18000);
  });

  it('per-drop: 125 drops @ £1.25 → 15625p', () => {
    const result = calculatePay(
      makeShift({ drop_count: 125 }),
      makeConfig({ pay_model: 'per_drop', rate_pence: 125 }),
      [],
      [],
    );
    expect(result.finalEarningsPence).toBe(15625);
  });

  it('per-stop: 82 stops @ £2.00 → 16400p', () => {
    const result = calculatePay(
      makeShift({ stop_count: 82 }),
      makeConfig({ pay_model: 'per_stop', rate_pence: 200 }),
      [],
      [],
    );
    expect(result.finalEarningsPence).toBe(16400);
  });

  it('manual: £150.00 entered → 15000p', () => {
    const result = calculatePay(
      makeShift({ manual_earnings_pence: 15000 }),
      makeConfig({ pay_model: 'manual', rate_pence: null }),
      [],
      [],
    );
    expect(result.finalEarningsPence).toBe(15000);
  });

  it('paid break: £16.50/hr, 8.5h shift, 30min break marked paid → 14025p', () => {
    const result = calculatePay(makeShift(), makeConfig(), [makeBreak({ is_paid: true })], []);
    expect(result.finalEarningsPence).toBe(14025);
  });

  it('bonus + deduction: £156.25 base, +£10 bonus, -£8 fuel → 15825p', () => {
    const result = calculatePay(
      makeShift({ drop_count: 125 }),
      makeConfig({ pay_model: 'per_drop', rate_pence: 125 }),
      [],
      [
        makeAdjustment({ type: 'bonus', amount_pence: 1000 }),
        makeAdjustment({ id: 'adj-2', type: 'deduction', label: 'Fuel', amount_pence: 800 }),
      ],
    );
    expect(result.finalEarningsPence).toBe(15825);
  });

  it('deductions exceed earnings: £50.00 base, £75.00 deductions → 0, needsReview', () => {
    const result = calculatePay(
      makeShift(),
      makeConfig({ pay_model: 'fixed_shift', rate_pence: 5000 }),
      [],
      [makeAdjustment({ type: 'deduction', amount_pence: 7500 })],
    );
    expect(result.finalEarningsPence).toBe(0);
    expect(result.needsReview).toBe(true);
  });

  it('rounding boundary: raw result 1649.5p → 1650p', () => {
    const hourlyFractional = calculatePay(
      makeShift({
        start_time: '2026-07-10T08:00:00.000Z',
        end_time: '2026-07-10T09:00:00.000Z',
      }),
      makeConfig({ pay_model: 'hourly', rate_pence: 1649.5 }),
      [],
      [],
    );
    expect(hourlyFractional.finalEarningsPence).toBe(1650);
  });
});
