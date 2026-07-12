import { useCallback, useEffect, useState } from 'react';

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

export function usePayConfiguration(userId: string | undefined) {
  const [configuration, setConfiguration] = useState<PayConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfiguration = useCallback(async () => {
    if (!userId) {
      setConfiguration(null);
      setLoading(false);
      return;
    }

    setLoading(true);
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

      const now = new Date().toISOString();

      if (configuration) {
        const { error: supersedeError } = await supabase
          .from('pay_configurations')
          .update({ superseded_at: now })
          .eq('id', configuration.id);

        if (supersedeError) {
          setSaving(false);
          setError(supersedeError.message);
          return { error: supersedeError.message };
        }
      }

      const { error: insertError } = await supabase.from('pay_configurations').insert({
        user_id: userId,
        pay_model: values.pay_model,
        rate_pence: isRateBasedPayModel(values.pay_model) ? values.rate_pence : null,
        paid_breaks_enabled: values.paid_breaks_enabled,
        effective_from: now,
      });

      setSaving(false);

      if (insertError) {
        setError(insertError.message);
        return { error: insertError.message };
      }

      await fetchConfiguration();
      return { error: null };
    },
    [userId, configuration, fetchConfiguration],
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
