import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PayConfiguration, Shift } from '../types';
import { endActiveShift } from './endActiveShift';

const activeShift: Shift = {
  id: 'shift-1',
  user_id: 'user-1',
  pay_configuration_id: 'config-1',
  start_time: '2026-07-10T08:00:00.000Z',
  end_time: null,
  status: 'active',
  drop_count: null,
  stop_count: null,
  manual_earnings_pence: null,
  base_pay_pence: null,
  final_earnings_pence: null,
  notes: '',
  updated_at: '2026-07-10T08:00:00.000Z',
};

const payConfig: PayConfiguration = {
  id: 'config-1',
  user_id: 'user-1',
  pay_model: 'fixed_shift',
  rate_pence: 5000,
  paid_breaks_enabled: false,
  effective_from: '2026-07-10T00:00:00.000Z',
  superseded_at: null,
};

type TableHandlers = {
  pay_configurations?: () => unknown;
  breaks?: () => unknown;
  earnings_adjustments?: () => unknown;
  shifts?: () => unknown;
};

function makeClient(handlers: TableHandlers) {
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));

  const from = vi.fn((table: string) => {
    if (table === 'pay_configurations') {
      return (
        handlers.pay_configurations?.() ?? {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: payConfig, error: null }),
            }),
          }),
        }
      );
    }
    if (table === 'breaks') {
      return (
        handlers.breaks?.() ?? {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        }
      );
    }
    if (table === 'earnings_adjustments') {
      return (
        handlers.earnings_adjustments?.() ?? {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        }
      );
    }
    if (table === 'shifts') {
      return (
        handlers.shifts?.() ?? {
          update,
        }
      );
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { from, update, updateEq };
}

describe('endActiveShift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces pay_configurations fetch errors and does not update the shift', async () => {
    const client = makeClient({
      pay_configurations: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: { message: 'pay_configurations boom' },
            }),
          }),
        }),
      }),
    });

    const result = await endActiveShift(activeShift, client as never);

    expect(result).toEqual({ error: 'pay_configurations boom' });
    expect(client.update).not.toHaveBeenCalled();
  });

  it('surfaces breaks fetch errors and does not update the shift', async () => {
    const client = makeClient({
      breaks: () => ({
        select: () => ({
          eq: async () => ({
            data: null,
            error: { message: 'breaks boom' },
          }),
        }),
      }),
    });

    const result = await endActiveShift(activeShift, client as never);

    expect(result).toEqual({ error: 'breaks boom' });
    expect(client.update).not.toHaveBeenCalled();
  });

  it('surfaces earnings_adjustments fetch errors and does not update the shift', async () => {
    const client = makeClient({
      earnings_adjustments: () => ({
        select: () => ({
          eq: async () => ({
            data: null,
            error: { message: 'earnings_adjustments boom' },
          }),
        }),
      }),
    });

    const result = await endActiveShift(activeShift, client as never);

    expect(result).toEqual({ error: 'earnings_adjustments boom' });
    expect(client.update).not.toHaveBeenCalled();
  });

  it('surfaces missing pay configuration without writing earnings', async () => {
    const client = makeClient({
      pay_configurations: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    });

    const result = await endActiveShift(activeShift, client as never);

    expect(result).toEqual({
      error: 'Pay configuration for this shift could not be found.',
    });
    expect(client.update).not.toHaveBeenCalled();
  });

  it('surfaces shifts.update errors after a successful calculation', async () => {
    const client = makeClient({
      shifts: () => ({
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({
            error: { message: 'shifts update boom' },
          })),
        })),
      }),
    });

    const result = await endActiveShift(activeShift, client as never);

    expect(result).toEqual({ error: 'shifts update boom' });
  });

  it('happy path (unit): writes base/final pay and completed status', async () => {
    const client = makeClient({});
    const endAt = new Date('2026-07-10T12:00:00.000Z');

    const result = await endActiveShift(activeShift, client as never, () => endAt);

    expect(result).toEqual({ error: null });
    expect(client.update).toHaveBeenCalledWith({
      end_time: endAt.toISOString(),
      base_pay_pence: 5000,
      final_earnings_pence: 5000,
      status: 'completed',
      updated_at: endAt.toISOString(),
    });
    expect(client.updateEq).toHaveBeenCalledWith('id', activeShift.id);
  });

  it('happy path (unit): deductions above base set needs_review and floor final at 0', async () => {
    const client = makeClient({
      earnings_adjustments: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              {
                id: 'adj-1',
                shift_id: activeShift.id,
                type: 'deduction',
                label: 'Chargeback',
                amount_pence: 7500,
              },
            ],
            error: null,
          }),
        }),
      }),
    });
    const endAt = new Date('2026-07-10T12:00:00.000Z');

    const result = await endActiveShift(activeShift, client as never, () => endAt);

    expect(result).toEqual({ error: null });
    expect(client.update).toHaveBeenCalledWith({
      end_time: endAt.toISOString(),
      base_pay_pence: 5000,
      final_earnings_pence: 0,
      status: 'needs_review',
      updated_at: endAt.toISOString(),
    });
  });
});
