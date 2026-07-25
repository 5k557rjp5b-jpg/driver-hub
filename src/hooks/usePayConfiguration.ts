import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { PayConfiguration, PayModel } from '../types';
import { isRateBasedPayModel } from '../utils/earnings';

export const PAY_ERR_002 = 'Complete Pay Setup before starting a shift.';

export type PayConfigurationInput = {
  pay_model: PayModel;
  rate_pence: number | null;
  paid_breaks_enabled: boolean;
};

export const DEFAULT_PAY_CONFIGURATION: PayConfigurationInput = {
  pay_model: 'hourly',
  rate_pence: 1650,
  paid_breaks_enabled: false,
};

export function validatePayConfiguration(values: PayConfigurationInput): string | null {
  if (isRateBasedPayModel(values.pay_model)) {
    if (values.rate_pence == null || values.rate_pence <= 0) {
      return 'Rate must be greater than £0.00 for this pay model.';
    }
  }
  return null;
}

export async function replacePayConfigurationRpc(
  userId: string,
  values: PayConfigurationInput,
): Promise<{ configuration: PayConfiguration | null; error: string | null }> {
  const { data, error } = await supabase.rpc('replace_pay_configuration', {
    p_user_id: userId,
    p_pay_model: values.pay_model,
    p_rate_pence: isRateBasedPayModel(values.pay_model) ? values.rate_pence : null,
    p_paid_breaks_enabled: values.paid_breaks_enabled,
  });

  if (error) {
    return { configuration: null, error: error.message };
  }

  return { configuration: (data as PayConfiguration | null) ?? null, error: null };
}

export function usePayConfiguration(userId: string | undefined) {
  const [configuration, setConfiguration] = useState<PayConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [userId]);

  const fetchConfiguration = useCallback(async () => {
    if (!userId) {
      setConfiguration(null);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    // Full-screen spinner only on first load — focus/pull refreshes keep UI mounted
    // so RefreshControl is not torn down mid-gesture (native).
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('pay_configurations')
      .select('*')
      .eq('user_id', userId)
      .is('superseded_at', null)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setConfiguration(null);
    } else {
      setConfiguration(data);
    }

    hasLoadedRef.current = true;
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration]);

  const saveConfiguration = useCallback(
    async (values: PayConfigurationInput) => {
      if (!userId) {
        return { error: 'You must be signed in to save pay setup.' };
      }

      const validationError = validatePayConfiguration(values);
      if (validationError) {
        setError(validationError);
        return { error: validationError };
      }

      setSaving(true);
      setError(null);

      const result = await replacePayConfigurationRpc(userId, values);

      setSaving(false);

      if (result.error) {
        setError(result.error);
        return { error: result.error };
      }

      await fetchConfiguration();
      return { error: null };
    },
    [userId, fetchConfiguration],
  );

  const fetchConfigurationById = useCallback(async (configurationId: string) => {
    const { data, error: fetchError } = await supabase
      .from('pay_configurations')
      .select('*')
      .eq('id', configurationId)
      .maybeSingle();

    if (fetchError) {
      return { configuration: null, error: fetchError.message };
    }

    return { configuration: data, error: null };
  }, []);

  return {
    configuration,
    hasActiveConfiguration: configuration != null,
    loading,
    saving,
    error,
    saveConfiguration,
    fetchConfigurationById,
    refresh: fetchConfiguration,
  };
}
