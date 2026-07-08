import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { WageSettings } from '../types';
import { DEFAULT_WAGE_SETTINGS } from '../utils/earnings';

export function useWageSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<WageSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!userId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('wage_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setSettings(null);
    } else if (data) {
      setSettings(data);
    } else {
      setSettings({
        user_id: userId,
        ...DEFAULT_WAGE_SETTINGS,
        updated_at: new Date().toISOString(),
      });
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(
    async (values: {
      hourly_rate: number;
      overtime_rate: number;
      overtime_threshold_hours: number;
      currency: string;
    }) => {
      if (!userId) {
        return { error: 'You must be signed in to save settings.' };
      }

      setSaving(true);
      setError(null);

      const payload = {
        user_id: userId,
        hourly_rate: values.hourly_rate,
        overtime_rate: values.overtime_rate,
        overtime_threshold_hours: values.overtime_threshold_hours,
        currency: values.currency,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from('wage_settings')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      const { error: saveError } = existing
        ? await supabase.from('wage_settings').update(payload).eq('user_id', userId)
        : await supabase.from('wage_settings').insert(payload);

      setSaving(false);

      if (saveError) {
        setError(saveError.message);
        return { error: saveError.message };
      }

      await fetchSettings();
      return { error: null };
    },
    [userId, fetchSettings],
  );

  return {
    settings,
    loading,
    saving,
    error,
    saveSettings,
    refresh: fetchSettings,
  };
}
