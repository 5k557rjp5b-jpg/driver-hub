import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { Shift } from '../types';

export function useShiftHistory(userId: string | undefined) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId) {
      setShifts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .not('end_time', 'is', null)
      .order('start_time', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setShifts(data ?? []);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    shifts,
    loading,
    error,
    refresh: fetchHistory,
  };
}

export function useShiftDetails(userId: string | undefined, shiftId: string) {
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShift = useCallback(async () => {
    if (!userId) {
      setShift(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', shiftId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setShift(data);
    }

    setLoading(false);
  }, [userId, shiftId]);

  useEffect(() => {
    fetchShift();
  }, [fetchShift]);

  return {
    shift,
    loading,
    error,
    refresh: fetchShift,
  };
}
