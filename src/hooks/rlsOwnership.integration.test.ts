import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createAuthenticatedUser,
  deleteUser,
  seedOwnedGraph,
  type TestUser,
} from '../test/integration/users';

/**
 * Stage 2 — RLS ownership via PostgREST.
 *
 * Cross-user SELECT/UPDATE under Supabase RLS typically return zero rows
 * (not a thrown permission error). We assert that precisely using .select()
 * after updates. Insert-side WITH CHECK for child tables is asserted as a
 * rejected insert when B attaches to A's shift.
 */

describe('RLS ownership (integration)', () => {
  let userA: TestUser;
  let userB: TestUser;
  let owned: Awaited<ReturnType<typeof seedOwnedGraph>>;

  beforeAll(async () => {
    userA = await createAuthenticatedUser('a');
    userB = await createAuthenticatedUser('b');
    owned = await seedOwnedGraph(userA);
  });

  afterAll(async () => {
    if (userA?.user?.id) await deleteUser(userA.user.id);
    if (userB?.user?.id) await deleteUser(userB.user.id);
  });

  describe('user_profiles', () => {
    it('A can select and update own profile', async () => {
      const select = await userA.client
        .from('user_profiles')
        .select('id, email')
        .eq('id', owned.profile.id);
      expect(select.error).toBeNull();
      expect(select.data).toHaveLength(1);

      const update = await userA.client
        .from('user_profiles')
        .update({ employment_type: 'employed' })
        .eq('id', owned.profile.id)
        .select('id, employment_type');
      expect(update.error).toBeNull();
      expect(update.data).toHaveLength(1);
      expect(update.data?.[0]?.employment_type).toBe('employed');
    });

    it('B cannot select or update A profile (zero rows)', async () => {
      const select = await userB.client
        .from('user_profiles')
        .select('id')
        .eq('id', owned.profile.id);
      expect(select.error).toBeNull();
      expect(select.data).toEqual([]);

      const update = await userB.client
        .from('user_profiles')
        .update({ employment_type: 'employed' })
        .eq('id', owned.profile.id)
        .select('id');
      expect(update.error).toBeNull();
      expect(update.data).toEqual([]);
    });
  });

  describe('pay_configurations', () => {
    it('A can select and update own pay configuration', async () => {
      const select = await userA.client
        .from('pay_configurations')
        .select('id, rate_pence')
        .eq('id', owned.payConfig.id);
      expect(select.error).toBeNull();
      expect(select.data).toHaveLength(1);

      const update = await userA.client
        .from('pay_configurations')
        .update({ paid_breaks_enabled: true })
        .eq('id', owned.payConfig.id)
        .select('id, paid_breaks_enabled');
      expect(update.error).toBeNull();
      expect(update.data).toHaveLength(1);
      expect(update.data?.[0]?.paid_breaks_enabled).toBe(true);
    });

    it('B cannot select or update A pay configuration (zero rows)', async () => {
      const select = await userB.client
        .from('pay_configurations')
        .select('id')
        .eq('id', owned.payConfig.id);
      expect(select.error).toBeNull();
      expect(select.data).toEqual([]);

      const update = await userB.client
        .from('pay_configurations')
        .update({ paid_breaks_enabled: false })
        .eq('id', owned.payConfig.id)
        .select('id');
      expect(update.error).toBeNull();
      expect(update.data).toEqual([]);
    });
  });

  describe('shifts', () => {
    it('A can select and update own shift', async () => {
      const select = await userA.client
        .from('shifts')
        .select('id, status')
        .eq('id', owned.shift.id);
      expect(select.error).toBeNull();
      expect(select.data).toHaveLength(1);

      const update = await userA.client
        .from('shifts')
        .update({ notes: 'owned by A' })
        .eq('id', owned.shift.id)
        .select('id, notes');
      expect(update.error).toBeNull();
      expect(update.data).toHaveLength(1);
      expect(update.data?.[0]?.notes).toBe('owned by A');
    });

    it('B cannot select or update A shift (zero rows)', async () => {
      const select = await userB.client
        .from('shifts')
        .select('id')
        .eq('id', owned.shift.id);
      expect(select.error).toBeNull();
      expect(select.data).toEqual([]);

      const update = await userB.client
        .from('shifts')
        .update({ notes: 'hijack' })
        .eq('id', owned.shift.id)
        .select('id');
      expect(update.error).toBeNull();
      expect(update.data).toEqual([]);
    });
  });

  describe('breaks', () => {
    it('A can select and update own break', async () => {
      const select = await userA.client
        .from('breaks')
        .select('id, is_paid')
        .eq('id', owned.breakRow.id);
      expect(select.error).toBeNull();
      expect(select.data).toHaveLength(1);

      const update = await userA.client
        .from('breaks')
        .update({ is_paid: true })
        .eq('id', owned.breakRow.id)
        .select('id, is_paid');
      expect(update.error).toBeNull();
      expect(update.data).toHaveLength(1);
      expect(update.data?.[0]?.is_paid).toBe(true);
    });

    it('B cannot select or update A break (zero rows)', async () => {
      const select = await userB.client
        .from('breaks')
        .select('id')
        .eq('id', owned.breakRow.id);
      expect(select.error).toBeNull();
      expect(select.data).toEqual([]);

      const update = await userB.client
        .from('breaks')
        .update({ is_paid: false })
        .eq('id', owned.breakRow.id)
        .select('id');
      expect(update.error).toBeNull();
      expect(update.data).toEqual([]);
    });

    it('B cannot INSERT a break attached to A shift (WITH CHECK)', async () => {
      const insert = await userB.client
        .from('breaks')
        .insert({
          shift_id: owned.shift.id,
          start_time: new Date().toISOString(),
          is_paid: false,
        })
        .select('id');

      // PostgREST typically returns an error for WITH CHECK / policy violation.
      expect(insert.data == null || insert.data.length === 0).toBe(true);
      expect(insert.error).not.toBeNull();
    });
  });

  describe('earnings_adjustments', () => {
    it('A can select and update own adjustment', async () => {
      const select = await userA.client
        .from('earnings_adjustments')
        .select('id, label')
        .eq('id', owned.adjustment.id);
      expect(select.error).toBeNull();
      expect(select.data).toHaveLength(1);

      const update = await userA.client
        .from('earnings_adjustments')
        .update({ label: 'Updated bonus' })
        .eq('id', owned.adjustment.id)
        .select('id, label');
      expect(update.error).toBeNull();
      expect(update.data).toHaveLength(1);
      expect(update.data?.[0]?.label).toBe('Updated bonus');
    });

    it('B cannot select or update A adjustment (zero rows)', async () => {
      const select = await userB.client
        .from('earnings_adjustments')
        .select('id')
        .eq('id', owned.adjustment.id);
      expect(select.error).toBeNull();
      expect(select.data).toEqual([]);

      const update = await userB.client
        .from('earnings_adjustments')
        .update({ label: 'hijack' })
        .eq('id', owned.adjustment.id)
        .select('id');
      expect(update.error).toBeNull();
      expect(update.data).toEqual([]);
    });

    it('B cannot INSERT an adjustment attached to A shift (WITH CHECK)', async () => {
      const insert = await userB.client
        .from('earnings_adjustments')
        .insert({
          shift_id: owned.shift.id,
          type: 'deduction',
          label: 'Bad fuel',
          amount_pence: 50,
        })
        .select('id');

      expect(insert.data == null || insert.data.length === 0).toBe(true);
      expect(insert.error).not.toBeNull();
    });
  });

  describe('earnings_summaries', () => {
    it('A can select and update own summary', async () => {
      const select = await userA.client
        .from('earnings_summaries')
        .select('id, shift_count')
        .eq('id', owned.summary.id);
      expect(select.error).toBeNull();
      expect(select.data).toHaveLength(1);

      const update = await userA.client
        .from('earnings_summaries')
        .update({ shift_count: 1 })
        .eq('id', owned.summary.id)
        .select('id, shift_count');
      expect(update.error).toBeNull();
      expect(update.data).toHaveLength(1);
      expect(update.data?.[0]?.shift_count).toBe(1);
    });

    it('B cannot select or update A summary (zero rows)', async () => {
      const select = await userB.client
        .from('earnings_summaries')
        .select('id')
        .eq('id', owned.summary.id);
      expect(select.error).toBeNull();
      expect(select.data).toEqual([]);

      const update = await userB.client
        .from('earnings_summaries')
        .update({ shift_count: 99 })
        .eq('id', owned.summary.id)
        .select('id');
      expect(update.error).toBeNull();
      expect(update.data).toEqual([]);
    });
  });

  describe('sync_operations', () => {
    it('A can select and update own sync operation', async () => {
      const select = await userA.client
        .from('sync_operations')
        .select('id, status')
        .eq('id', owned.syncOp.id);
      expect(select.error).toBeNull();
      expect(select.data).toHaveLength(1);

      const update = await userA.client
        .from('sync_operations')
        .update({ status: 'synced' })
        .eq('id', owned.syncOp.id)
        .select('id, status');
      expect(update.error).toBeNull();
      expect(update.data).toHaveLength(1);
      expect(update.data?.[0]?.status).toBe('synced');
    });

    it('B cannot select or update A sync operation (zero rows)', async () => {
      const select = await userB.client
        .from('sync_operations')
        .select('id')
        .eq('id', owned.syncOp.id);
      expect(select.error).toBeNull();
      expect(select.data).toEqual([]);

      const update = await userB.client
        .from('sync_operations')
        .update({ status: 'conflict' })
        .eq('id', owned.syncOp.id)
        .select('id');
      expect(update.error).toBeNull();
      expect(update.data).toEqual([]);
    });
  });
});
