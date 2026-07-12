import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { AdjustmentType, EarningsAdjustment } from '../types';

export function useEarningsAdjustments(shiftId: string | undefined) {
  const [adjustments, setAdjustments] = useState<EarningsAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAdjustments = useCallback(async () => {
    if (!shiftId) {
      setAdjustments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('earnings_adjustments')
      .select('*')
      .eq('shift_id', shiftId)
      .order('label', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setAdjustments(data ?? []);
    }

    setLoading(false);
  }, [shiftId]);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  const addAdjustment = useCallback(
    async (values: { type: AdjustmentType; label: string; amount_pence: number }) => {
      if (!shiftId) {
        return { error: 'No shift selected for this adjustment.' };
      }

      const label = values.label.trim();
      if (label.length < 1 || label.length > 60) {
        const message = 'Label must be between 1 and 60 characters.';
        setError(message);
        return { error: message };
      }

      if (values.amount_pence <= 0) {
        const message = 'Amount must be greater than £0.00.';
        setError(message);
        return { error: message };
      }

      setActionLoading(true);
      setError(null);

      const { error: insertError } = await supabase.from('earnings_adjustments').insert({
        shift_id: shiftId,
        type: values.type,
        label,
        amount_pence: values.amount_pence,
      });

      setActionLoading(false);

      if (insertError) {
        setError(insertError.message);
        return { error: insertError.message };
      }

      await fetchAdjustments();
      return { error: null };
    },
    [shiftId, fetchAdjustments],
  );

  return {
    adjustments,
    loading,
    error,
    actionLoading,
    addAdjustment,
    refresh: fetchAdjustments,
  };
}
