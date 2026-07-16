import type { SupabaseClient } from '@supabase/supabase-js';

import type { Break, EarningsAdjustment, Shift } from '../types';
import { calculatePay } from '../utils/earnings';

export type EndShiftClient = Pick<SupabaseClient, 'from'>;

/**
 * Complete an active shift: load pay config / breaks / adjustments, compute pay,
 * then write end_time + earnings fields. Fetch errors are surfaced and abort
 * the update (do not calculate with partial/missing data).
 */
export async function endActiveShift(
  activeShift: Shift,
  client: EndShiftClient,
  now: () => Date = () => new Date(),
): Promise<{ error: string | null }> {
  const endTime = now().toISOString();
  const completedShift: Shift = { ...activeShift, end_time: endTime };

  const [payConfigResult, breaksResult, adjustmentsResult] = await Promise.all([
    client
      .from('pay_configurations')
      .select('*')
      .eq('id', activeShift.pay_configuration_id)
      .maybeSingle(),
    client.from('breaks').select('*').eq('shift_id', activeShift.id),
    client.from('earnings_adjustments').select('*').eq('shift_id', activeShift.id),
  ]);

  if (payConfigResult.error) {
    return { error: payConfigResult.error.message };
  }

  if (!payConfigResult.data) {
    return { error: 'Pay configuration for this shift could not be found.' };
  }

  if (breaksResult.error) {
    return { error: breaksResult.error.message };
  }

  if (adjustmentsResult.error) {
    return { error: adjustmentsResult.error.message };
  }

  const breaks = (breaksResult.data ?? []) as Break[];
  const adjustments = (adjustmentsResult.data ?? []) as EarningsAdjustment[];
  const payBreakdown = calculatePay(
    completedShift,
    payConfigResult.data,
    breaks,
    adjustments,
  );

  const { error: updateError } = await client
    .from('shifts')
    .update({
      end_time: endTime,
      base_pay_pence: payBreakdown.basePayPence,
      final_earnings_pence: payBreakdown.finalEarningsPence,
      status: payBreakdown.needsReview ? 'needs_review' : 'completed',
      updated_at: endTime,
    })
    .eq('id', activeShift.id);

  if (updateError) {
    return { error: updateError.message };
  }

  return { error: null };
}
