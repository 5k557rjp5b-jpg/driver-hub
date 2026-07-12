import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { Break } from '../types';

const ACTIVE_BREAK_ERROR = 'A break is already in progress. End it before starting another.';

export function useBreaks(shiftId: string | undefined, paidBreaksDefault = false) {
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const activeBreak = breaks.find((item) => !item.end_time) ?? null;

  const fetchBreaks = useCallback(async () => {
    if (!shiftId) {
      setBreaks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('breaks')
      .select('*')
      .eq('shift_id', shiftId)
      .order('start_time', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setBreaks(data ?? []);
    }

    setLoading(false);
  }, [shiftId]);

  useEffect(() => {
    fetchBreaks();
  }, [fetchBreaks]);

  const startBreak = useCallback(async () => {
    if (!shiftId) {
      return { error: 'No active shift for this break.' };
    }

    if (activeBreak) {
      const message = ACTIVE_BREAK_ERROR;
      setError(message);
      return { error: message };
    }

    setActionLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from('breaks').insert({
      shift_id: shiftId,
      start_time: new Date().toISOString(),
      is_paid: paidBreaksDefault,
    });

    setActionLoading(false);

    if (insertError) {
      setError(insertError.message);
      return { error: insertError.message };
    }

    await fetchBreaks();
    return { error: null };
  }, [shiftId, activeBreak, paidBreaksDefault, fetchBreaks]);

  const endBreak = useCallback(async () => {
    if (!activeBreak) {
      return { error: 'No active break to end.' };
    }

    setActionLoading(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('breaks')
      .update({ end_time: new Date().toISOString() })
      .eq('id', activeBreak.id);

    setActionLoading(false);

    if (updateError) {
      setError(updateError.message);
      return { error: updateError.message };
    }

    await fetchBreaks();
    return { error: null };
  }, [activeBreak, fetchBreaks]);

  return {
    breaks,
    activeBreak,
    loading,
    error,
    actionLoading,
    startBreak,
    endBreak,
    refresh: fetchBreaks,
  };
}
