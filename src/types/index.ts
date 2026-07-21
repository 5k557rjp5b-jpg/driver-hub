// src/types/index.ts

export type AuthProvider = 'apple' | 'google' | 'email';
export type EmploymentType = 'employed' | 'self_employed';
export type PayModel = 'hourly' | 'fixed_shift' | 'per_drop' | 'per_stop' | 'manual';
export type ShiftStatus = 'active' | 'completed' | 'needs_review';
export type AdjustmentType = 'bonus' | 'deduction';
export type PeriodType = 'daily' | 'weekly' | 'monthly';
export type SyncEntityType = 'shift' | 'break' | 'earnings_adjustment' | 'pay_configuration';
export type SyncOperationType = 'create' | 'update';
export type SyncStatus = 'pending' | 'synced' | 'conflict';

export type UserProfile = {
  id: string;
  auth_provider: AuthProvider;
  email: string;
  employment_type: EmploymentType;
  created_at: string;
  deletion_requested_at: string | null;
};

export type PayConfiguration = {
  id: string;
  user_id: string;
  pay_model: PayModel;
  rate_pence: number | null;
  paid_breaks_enabled: boolean;
  effective_from: string;
  superseded_at: string | null;
};

export type Shift = {
  id: string;
  user_id: string;
  pay_configuration_id: string;
  start_time: string;
  end_time: string | null;
  status: ShiftStatus;
  drop_count: number | null;
  stop_count: number | null;
  manual_earnings_pence: number | null;
  base_pay_pence: number | null;
  final_earnings_pence: number | null;
  notes: string;
  updated_at: string;
};

export type Break = {
  id: string;
  shift_id: string;
  start_time: string;
  end_time: string | null;
  is_paid: boolean;
};

export type EarningsAdjustment = {
  id: string;
  shift_id: string;
  type: AdjustmentType;
  label: string;
  amount_pence: number;
};

export type EarningsSummary = {
  id: string;
  user_id: string;
  period_type: PeriodType;
  period_start: string;
  total_earnings_pence: number;
  shift_count: number;
  recomputed_at: string;
};

export type SyncOperation = {
  id: string;
  user_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperationType;
  payload: Record<string, unknown>;
  queued_at: string;
  status: SyncStatus;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Profile: undefined;
};

export type HistoryStackParamList = {
  ShiftHistory: undefined;
  ShiftDetails: { shiftId: string };
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
