import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { Shift } from '../types';
import { getStartOfToday } from '../utils/hours';

export function useShifts(userId: string | undefined) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchShifts = useCallback(async () => {
    if (!userId) {
      setShifts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const startOfToday = getStartOfToday().toISOString();

    const { data, error: fetchError } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startOfToday)
      .order('start_time', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setShifts(data ?? []);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const activeShift = shifts.find((shift) => !shift.end_time) ?? null;

  const startShift = useCallback(async () => {
    if (!userId || activeShift) {
      return { error: 'A shift is already in progress.' };
    }

    setActionLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from('shifts').insert({
      user_id: userId,
      start_time: new Date().toISOString(),
    });

    setActionLoading(false);

    if (insertError) {
      setError(insertError.message);
      return { error: insertError.message };
    }

    await fetchShifts();
    return { error: null };
  }, [userId, activeShift, fetchShifts]);

  const endShift = useCallback(async () => {
    if (!activeShift) {
      return { error: 'No active shift to end.' };
    }

    setActionLoading(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('shifts')
      .update({ end_time: new Date().toISOString() })
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
    shifts,
    activeShift,
    loading,
    error,
    actionLoading,
    startShift,
    endShift,
    refresh: fetchShifts,
  };
}
