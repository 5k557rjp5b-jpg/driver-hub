import { describe, expect, it, vi } from 'vitest';

import {
  formatManualEarningsInput,
  nextCountValue,
  parseManualEarningsPounds,
  persistManualEarningsPence,
  persistShiftCount,
} from './shiftPayInputs';

describe('nextCountValue', () => {
  it('treats null as 0 and increments', () => {
    expect(nextCountValue(null, 1)).toBe(1);
    expect(nextCountValue(undefined, 1)).toBe(1);
    expect(nextCountValue(3, 1)).toBe(4);
  });

  it('decrements but refuses going below 0', () => {
    expect(nextCountValue(2, -1)).toBe(1);
    expect(nextCountValue(0, -1)).toBeNull();
    expect(nextCountValue(null, -1)).toBeNull();
  });
});

describe('parseManualEarningsPounds', () => {
  it('accepts zero and positive pounds', () => {
    expect(parseManualEarningsPounds('0')).toEqual({ pence: 0, error: null });
    expect(parseManualEarningsPounds('12.34')).toEqual({ pence: 1234, error: null });
  });

  it('rejects empty and negative input', () => {
    expect(parseManualEarningsPounds('').error).toBeTruthy();
    expect(parseManualEarningsPounds('-1').error).toBeTruthy();
    expect(parseManualEarningsPounds('abc').error).toBeTruthy();
  });
});

describe('formatManualEarningsInput', () => {
  it('formats pence as pounds with two decimals', () => {
    expect(formatManualEarningsInput(null)).toBe('');
    expect(formatManualEarningsInput(1234)).toBe('12.34');
  });
});

describe('persist helpers', () => {
  it('persistShiftCount rejects negative values before writing', async () => {
    const from = vi.fn();
    const result = await persistShiftCount({ from } as never, 'shift-1', 'drop_count', -1);
    expect(result.error).toMatch(/non-negative/);
    expect(from).not.toHaveBeenCalled();
  });

  it('persistShiftCount writes integer counts', async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));

    const result = await persistShiftCount({ from } as never, 'shift-1', 'stop_count', 4);

    expect(result.error).toBeNull();
    expect(from).toHaveBeenCalledWith('shifts');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ stop_count: 4 }),
    );
    expect(eq).toHaveBeenCalledWith('id', 'shift-1');
  });

  it('persistManualEarningsPence surfaces supabase errors', async () => {
    const eq = vi.fn(async () => ({ error: { message: 'write failed' } }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));

    const result = await persistManualEarningsPence({ from } as never, 'shift-1', 500);

    expect(result).toEqual({ error: 'write failed' });
  });
});
