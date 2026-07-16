import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { Shift } from '../types';
import { PAY_ERR_002 } from './usePayConfiguration';
import { endActiveShift } from './endActiveShift';
import {
  filterTodayShifts,
  getStartOfMonth,
} from '../utils/hours';

export { endActiveShift } from './endActiveShift';

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

    const result = await endActiveShift(activeShift, supabase);
    setActionLoading(false);

    if (result.error) {
      setError(result.error);
      return result;
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
