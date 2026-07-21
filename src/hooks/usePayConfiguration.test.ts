import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PayConfiguration } from '../types';
import {
  DEFAULT_PAY_CONFIGURATION,
  replacePayConfigurationRpc,
} from './usePayConfiguration';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const existingConfiguration: PayConfiguration = {
  id: 'config-old',
  user_id: 'user-1',
  pay_model: 'hourly',
  rate_pence: 1650,
  paid_breaks_enabled: false,
  effective_from: '2026-07-10T08:00:00.000Z',
  superseded_at: null,
};

describe('replacePayConfigurationRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: vi.fn() }),
      insert: vi.fn(),
    });
  });

  it('calls replace_pay_configuration RPC with mapped arguments', async () => {
    mockRpc.mockResolvedValue({
      data: existingConfiguration,
      error: null,
    });

    const result = await replacePayConfigurationRpc('user-1', DEFAULT_PAY_CONFIGURATION);

    expect(mockRpc).toHaveBeenCalledWith('replace_pay_configuration', {
      p_user_id: 'user-1',
      p_pay_model: 'hourly',
      p_rate_pence: 1650,
      p_paid_breaks_enabled: false,
    });
    expect(result.error).toBeNull();
    expect(result.configuration).toEqual(existingConfiguration);
  });

  it('returns error on failed RPC without mutating via separate update/insert', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'insert failed after supersede' },
    });

    const result = await replacePayConfigurationRpc('user-1', DEFAULT_PAY_CONFIGURATION);

    expect(result.error).toBe('insert failed after supersede');
    expect(result.configuration).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passes null rate for manual pay model', async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...existingConfiguration,
        pay_model: 'manual',
        rate_pence: null,
      },
      error: null,
    });

    await replacePayConfigurationRpc('user-1', {
      pay_model: 'manual',
      rate_pence: null,
      paid_breaks_enabled: false,
    });

    expect(mockRpc).toHaveBeenCalledWith('replace_pay_configuration', {
      p_user_id: 'user-1',
      p_pay_model: 'manual',
      p_rate_pence: null,
      p_paid_breaks_enabled: false,
    });
  });
});
