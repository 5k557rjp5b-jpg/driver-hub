// src/utils/earnings.ts
import type { Shift, PayConfiguration, EarningsAdjustment, Break } from '../types';
import { getStartOfMonth, getStartOfWeek } from './hours';

/**
 * Round-half-up to the nearest penny. Applied exactly once, at the point
 * base pay + bonuses - deductions are combined. Never round intermediate
 * values (e.g. hourlyRate * fractionalHours).
 * PE-002 / PE-004 in Pay Engine Spec v1.0.
 */
function roundHalfUpPence(rawPence: number): number {
  return Math.floor(rawPence + 0.5);
}

/**
 * Working time in hours for Hourly pay model.
 * = (shiftEnd - shiftStart) - sum(unpaid break durations)
 * Paid breaks are included in worked time (PE-005 / PE-006).
 */
export function getWorkingHours(shift: Shift, breaks: Break[]): number {
  if (!shift.end_time) return 0;

  const startMs = new Date(shift.start_time).getTime();
  const endMs = new Date(shift.end_time).getTime();
  const totalMs = endMs - startMs;

  const unpaidBreakMs = breaks
    .filter((b) => !b.is_paid && b.end_time)
    .reduce((sum, b) => {
      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time as string).getTime();
      return sum + (bEnd - bStart);
    }, 0);

  const workingMs = totalMs - unpaidBreakMs;
  return workingMs / (1000 * 60 * 60);
}

/**
 * basePay per pay model, in integer pence. PE-001–PE-006, §5.
 */
export function calculateBasePayPence(
  shift: Shift,
  payConfig: PayConfiguration,
  breaks: Break[],
): number {
  switch (payConfig.pay_model) {
    case 'hourly': {
      const rate = payConfig.rate_pence ?? 0;
      const hours = getWorkingHours(shift, breaks);
      return rate * hours;
    }
    case 'fixed_shift': {
      return payConfig.rate_pence ?? 0;
    }
    case 'per_drop': {
      const rate = payConfig.rate_pence ?? 0;
      return (shift.drop_count ?? 0) * rate;
    }
    case 'per_stop': {
      const rate = payConfig.rate_pence ?? 0;
      return (shift.stop_count ?? 0) * rate;
    }
    case 'manual': {
      return shift.manual_earnings_pence ?? 0;
    }
  }
}

export type PayBreakdown = {
  basePayPence: number;
  bonusesPence: number;
  deductionsPence: number;
  finalEarningsPence: number;
  needsReview: boolean;
};

/**
 * Pure function: given a shift, its pay configuration, its breaks and its
 * adjustments, returns the full earnings breakdown.
 * finalEarnings = round(basePay + bonuses - deductions), floored at 0.
 * PE-003 / PE-004.
 */
export function calculatePay(
  shift: Shift,
  payConfig: PayConfiguration,
  breaks: Break[],
  adjustments: EarningsAdjustment[],
): PayBreakdown {
  const basePayPence = calculateBasePayPence(shift, payConfig, breaks);

  const bonusesPence = adjustments
    .filter((a) => a.type === 'bonus')
    .reduce((sum, a) => sum + a.amount_pence, 0);

  const deductionsPence = adjustments
    .filter((a) => a.type === 'deduction')
    .reduce((sum, a) => sum + a.amount_pence, 0);

  const rawFinal = basePayPence + bonusesPence - deductionsPence;
  const rounded = roundHalfUpPence(rawFinal);
  const needsReview = rounded < 0;
  const finalEarningsPence = Math.max(0, rounded);

  return {
    basePayPence: Math.round(basePayPence),
    bonusesPence,
    deductionsPence,
    finalEarningsPence,
    needsReview,
  };
}

export function formatCurrency(pence: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pence / 100);
}

export function getShiftEarningsPence(shift: Shift): number {
  if (shift.final_earnings_pence != null) {
    return shift.final_earnings_pence;
  }
  return 0;
}

function shiftOverlapsPeriod(
  shift: Shift,
  periodStart: Date,
  periodEnd: Date,
  now = new Date(),
): boolean {
  const shiftStart = new Date(shift.start_time).getTime();
  const shiftEnd = shift.end_time ? new Date(shift.end_time).getTime() : now.getTime();
  return shiftEnd > periodStart.getTime() && shiftStart < periodEnd.getTime();
}

export function calculatePeriodEarningsPence(
  shifts: Shift[],
  periodStart: Date,
  periodEnd: Date,
  now = new Date(),
): number {
  return shifts.reduce((total, shift) => {
    if (shift.status === 'active' || shift.final_earnings_pence == null) {
      return total;
    }
    if (!shiftOverlapsPeriod(shift, periodStart, periodEnd, now)) {
      return total;
    }
    return total + shift.final_earnings_pence;
  }, 0);
}

export function calculateDailyEarningsPence(
  shifts: Shift[],
  date = new Date(),
  now = new Date(),
): number {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return calculatePeriodEarningsPence(shifts, dayStart, dayEnd, now);
}

export function calculateWeeklyEarningsPence(shifts: Shift[], now = new Date()): number {
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  return calculatePeriodEarningsPence(shifts, startOfWeek, endOfWeek, now);
}

export function calculateMonthlyEarningsPence(shifts: Shift[], now = new Date()): number {
  const startOfMonth = getStartOfMonth(now);
  const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1);
  return calculatePeriodEarningsPence(shifts, startOfMonth, endOfMonth, now);
}

export const RATE_BASED_PAY_MODELS = ['hourly', 'fixed_shift', 'per_drop', 'per_stop'] as const;

export function isRateBasedPayModel(payModel: PayConfiguration['pay_model']): boolean {
  return (RATE_BASED_PAY_MODELS as readonly string[]).includes(payModel);
}
