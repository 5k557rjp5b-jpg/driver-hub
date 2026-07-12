import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { Break, EarningsAdjustment, Shift } from '../types';
import { calculatePay } from '../utils/earnings';
import { PAY_ERR_002 } from './usePayConfiguration';
import {
  filterTodayShifts,
  getStartOfMonth,
} from '../utils/hours';

const ACTIVE_SHIFT_ERROR =
  'You already have an active shift. End it before starting a new one.';

function isActiveShiftConstraintError(message: string): boolean {
  return message.includes('shifts_one_active_per_user_idx');
}

export function useShifts(userId: string | undefined) {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [periodShifts, setPeriodShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchShifts = useCallback(async () => {
    if (!userId) {
      setActiveShift(null);
      setPeriodShifts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const startOfMonth = getStartOfMonth().toISOString();

    const [activeResult, periodResult] = await Promise.all([
      supabase
        .from('shifts')
        .select('*')
        .eq('user_id', userId)
        .is('end_time', null)
        .maybeSingle(),
      supabase
        .from('shifts')
        .select('*')
        .eq('user_id', userId)
        .or(
          `end_time.is.null,start_time.gte.${startOfMonth},end_time.gte.${startOfMonth}`,
        )
        .order('start_time', { ascending: false }),
    ]);

    if (activeResult.error) {
      setError(activeResult.error.message);
    } else {
      setActiveShift(activeResult.data);
    }

    if (periodResult.error) {
      setError(periodResult.error.message);
    } else {
      setPeriodShifts(periodResult.data ?? []);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const todayShifts = filterTodayShifts(periodShifts);

  const startShift = useCallback(async () => {
    if (!userId) {
      return { error: 'You must be signed in to start a shift.' };
    }

    if (activeShift) {
      const message = ACTIVE_SHIFT_ERROR;
      setError(message);
      return { error: message };
    }

    setActionLoading(true);
    setError(null);

    const { data: payConfig, error: payConfigError } = await supabase
      .from('pay_configurations')
      .select('id')
      .eq('user_id', userId)
      .is('superseded_at', null)
      .maybeSingle();

    if (payConfigError) {
      setActionLoading(false);
      setError(payConfigError.message);
      return { error: payConfigError.message };
    }

    if (!payConfig) {
      setActionLoading(false);
      setError(PAY_ERR_002);
      return { error: PAY_ERR_002 };
    }

    const { data: existingActive, error: checkError } = await supabase
      .from('shifts')
      .select('id')
      .eq('user_id', userId)
      .is('end_time', null)
      .maybeSingle();

    if (checkError) {
      setActionLoading(false);
      setError(checkError.message);
      return { error: checkError.message };
    }

    if (existingActive) {
      setActionLoading(false);
      const message = ACTIVE_SHIFT_ERROR;
      setError(message);
      await fetchShifts();
      return { error: message };
    }

    const { error: insertError } = await supabase.from('shifts').insert({
      user_id: userId,
      pay_configuration_id: payConfig.id,
      start_time: new Date().toISOString(),
      status: 'active',
      notes: '',
    });

    if (insertError) {
      const message = isActiveShiftConstraintError(insertError.message)
        ? ACTIVE_SHIFT_ERROR
        : insertError.message;
      setError(message);
      setActionLoading(false);
      await fetchShifts();
      return { error: message };
    }

    setActionLoading(false);
    await fetchShifts();
    return { error: null };
  }, [userId, activeShift, fetchShifts]);

  const endShift = useCallback(async () => {
    if (!activeShift) {
      return { error: 'No active shift to end.' };
    }

    setActionLoading(true);
    setError(null);

    const endTime = new Date().toISOString();
    const completedShift: Shift = { ...activeShift, end_time: endTime };

    const [payConfigResult, breaksResult, adjustmentsResult] = await Promise.all([
      supabase
        .from('pay_configurations')
        .select('*')
        .eq('id', activeShift.pay_configuration_id)
        .maybeSingle(),
      supabase.from('breaks').select('*').eq('shift_id', activeShift.id),
      supabase.from('earnings_adjustments').select('*').eq('shift_id', activeShift.id),
    ]);

    if (payConfigResult.error) {
      setActionLoading(false);
      setError(payConfigResult.error.message);
      return { error: payConfigResult.error.message };
    }

    if (!payConfigResult.data) {
      setActionLoading(false);
      const message = 'Pay configuration for this shift could not be found.';
      setError(message);
      return { error: message };
    }

    if (breaksResult.error) {
      setActionLoading(false);
      setError(breaksResult.error.message);
      return { error: breaksResult.error.message };
    }

    if (adjustmentsResult.error) {
      setActionLoading(false);
      setError(adjustmentsResult.error.message);
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

    const { error: updateError } = await supabase
      .from('shifts')
      .update({
        end_time: endTime,
        base_pay_pence: payBreakdown.basePayPence,
        final_earnings_pence: payBreakdown.finalEarningsPence,
        status: payBreakdown.needsReview ? 'needs_review' : 'completed',
        updated_at: endTime,
      })
      .eq('id', activeShift.id);

    setActionLoading(false);

    if (updateError) {
      setError(updateError.message);
      return { error: updateError.message };
    }

    await fetchShifts();
    return { error: null };
  }, [activeShift, fetchShifts]);

  return {
    activeShift,
    periodShifts,
    todayShifts,
    loading,
    error,
    actionLoading,
    startShift,
    endShift,
    refresh: fetchShifts,
  };
}
