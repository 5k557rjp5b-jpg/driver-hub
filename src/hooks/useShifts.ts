import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { Shift } from '../types';
import { PAY_ERR_002 } from './usePayConfiguration';
import { endActiveShift } from './endActiveShift';
import {
  applyShiftPatch,
  nextCountValue,
  persistManualEarningsPence,
  persistShiftCount,
  type CountField,
} from './shiftPayInputs';
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
  const [payInputLoading, setPayInputLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [userId]);

  const patchLocalShift = useCallback((shiftId: string, patch: Partial<Shift>) => {
    setActiveShift((current) =>
      current && current.id === shiftId ? applyShiftPatch(current, patch) : current,
    );
    setPeriodShifts((current) =>
      current.map((shift) =>
        shift.id === shiftId ? applyShiftPatch(shift, patch) : shift,
      ),
    );
  }, []);

  const fetchShifts = useCallback(async () => {
    if (!userId) {
      setActiveShift(null);
      setPeriodShifts([]);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    // Full-screen spinner only on first load — focus/pull refreshes keep ScrollView
    // mounted so RefreshControl is not torn down mid-gesture (native).
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
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

    hasLoadedRef.current = true;
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

  const adjustCountField = useCallback(
    async (field: CountField, delta: 1 | -1) => {
      if (!activeShift) {
        return { error: 'No active shift to update.' };
      }

      const nextValue = nextCountValue(activeShift[field], delta);
      if (nextValue == null) {
        return { error: `${field} cannot go below 0.` };
      }

      const previousValue = activeShift[field];
      const patch = { [field]: nextValue } as Partial<Shift>;

      setError(null);
      setPayInputLoading(true);
      patchLocalShift(activeShift.id, patch);

      const result = await persistShiftCount(
        supabase,
        activeShift.id,
        field,
        nextValue,
      );

      if (result.error) {
        patchLocalShift(activeShift.id, { [field]: previousValue } as Partial<Shift>);
        setError(result.error);
        setPayInputLoading(false);
        return result;
      }

      setPayInputLoading(false);
      return { error: null };
    },
    [activeShift, patchLocalShift],
  );

  const incrementDropCount = useCallback(
    () => adjustCountField('drop_count', 1),
    [adjustCountField],
  );

  const decrementDropCount = useCallback(
    () => adjustCountField('drop_count', -1),
    [adjustCountField],
  );

  const incrementStopCount = useCallback(
    () => adjustCountField('stop_count', 1),
    [adjustCountField],
  );

  const decrementStopCount = useCallback(
    () => adjustCountField('stop_count', -1),
    [adjustCountField],
  );

  const setManualEarningsPence = useCallback(
    async (nextValue: number) => {
      if (!activeShift) {
        return { error: 'No active shift to update.' };
      }

      if (!Number.isInteger(nextValue) || nextValue < 0) {
        const message = 'Manual earnings must be a non-negative amount.';
        setError(message);
        return { error: message };
      }

      const previousValue = activeShift.manual_earnings_pence;
      setError(null);
      setPayInputLoading(true);
      patchLocalShift(activeShift.id, { manual_earnings_pence: nextValue });

      const result = await persistManualEarningsPence(
        supabase,
        activeShift.id,
        nextValue,
      );

      if (result.error) {
        patchLocalShift(activeShift.id, { manual_earnings_pence: previousValue });
        setError(result.error);
        setPayInputLoading(false);
        return result;
      }

      setPayInputLoading(false);
      return { error: null };
    },
    [activeShift, patchLocalShift],
  );

  return {
    activeShift,
    periodShifts,
    todayShifts,
    loading,
    error,
    actionLoading,
    payInputLoading,
    startShift,
    endShift,
    incrementDropCount,
    decrementDropCount,
    incrementStopCount,
    decrementStopCount,
    setManualEarningsPence,
    refresh: fetchShifts,
  };
}
