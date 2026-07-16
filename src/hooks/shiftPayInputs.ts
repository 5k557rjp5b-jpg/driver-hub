import type { SupabaseClient } from '@supabase/supabase-js';

import type { Shift } from '../types';

export type ShiftPayInputClient = Pick<SupabaseClient, 'from'>;

export type CountField = 'drop_count' | 'stop_count';

/**
 * Persist a non-negative integer count on an active shift.
 * Caller owns optimistic UI; this only performs the Supabase write.
 */
export async function persistShiftCount(
  client: ShiftPayInputClient,
  shiftId: string,
  field: CountField,
  nextValue: number,
): Promise<{ error: string | null }> {
  if (!Number.isInteger(nextValue) || nextValue < 0) {
    return { error: `${field} must be a non-negative integer.` };
  }

  const { error } = await client
    .from('shifts')
    .update({
      [field]: nextValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shiftId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Persist manual earnings in pence (null allowed to clear; otherwise >= 0).
 */
export async function persistManualEarningsPence(
  client: ShiftPayInputClient,
  shiftId: string,
  nextValue: number | null,
): Promise<{ error: string | null }> {
  if (nextValue != null && (!Number.isInteger(nextValue) || nextValue < 0)) {
    return { error: 'Manual earnings must be a non-negative amount.' };
  }

  const { error } = await client
    .from('shifts')
    .update({
      manual_earnings_pence: nextValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shiftId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export function nextCountValue(current: number | null | undefined, delta: 1 | -1): number | null {
  const base = current ?? 0;
  const next = base + delta;
  if (next < 0) {
    return null;
  }
  return next;
}

export function parseManualEarningsPounds(input: string): {
  pence: number | null;
  error: string | null;
} {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { pence: null, error: 'Enter an amount of £0.00 or more.' };
  }

  const pounds = Number(trimmed);
  if (!Number.isFinite(pounds) || pounds < 0) {
    return { pence: null, error: 'Enter a valid amount of £0.00 or more.' };
  }

  const pence = Math.round(pounds * 100);
  if (pence < 0) {
    return { pence: null, error: 'Enter a valid amount of £0.00 or more.' };
  }

  return { pence, error: null };
}

export function formatManualEarningsInput(pence: number | null | undefined): string {
  if (pence == null) {
    return '';
  }
  return (pence / 100).toFixed(2);
}

export function applyShiftPatch(shift: Shift, patch: Partial<Shift>): Shift {
  return { ...shift, ...patch };
}
