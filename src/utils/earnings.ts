import type { Shift, WageSettings } from '../types';
import {
  calculateHoursInPeriod,
  getShiftDurationHours,
  getShiftHoursOnDate,
  getStartOfMonth,
  getStartOfToday,
  getStartOfWeek,
} from './hours';

export type EarningsSettings = {
  hourlyRate: number;
  overtimeRate: number;
  overtimeThresholdHours: number;
  currency: string;
  bonus?: number;
};

export function toEarningsSettings(settings: WageSettings): EarningsSettings {
  return {
    hourlyRate: Number(settings.hourly_rate),
    overtimeRate: Number(settings.overtime_rate),
    overtimeThresholdHours: Number(settings.overtime_threshold_hours),
    currency: settings.currency,
  };
}

export function calculateShiftEarnings(
  hours: number,
  settings: EarningsSettings,
  bonus = 0,
): number {
  const { hourlyRate, overtimeRate, overtimeThresholdHours } = settings;

  if (hours <= 0) {
    return bonus;
  }

  if (hours <= overtimeThresholdHours) {
    return hours * hourlyRate + bonus;
  }

  const regularHours = overtimeThresholdHours;
  const overtimeHours = hours - overtimeThresholdHours;
  return regularHours * hourlyRate + overtimeHours * overtimeRate + bonus;
}

function getDailyHoursMap(
  shifts: Shift[],
  periodStart: Date,
  periodEnd: Date,
  now = new Date(),
): Map<string, number> {
  const dailyHours = new Map<string, number>();
  const cursor = new Date(periodStart);

  while (cursor < periodEnd) {
    const key = cursor.toDateString();
    dailyHours.set(key, 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const shift of shifts) {
    const dayCursor = new Date(periodStart);
    while (dayCursor < periodEnd) {
      const hoursOnDay = getShiftHoursOnDate(shift, dayCursor, now);
      if (hoursOnDay > 0) {
        const key = dayCursor.toDateString();
        dailyHours.set(key, (dailyHours.get(key) ?? 0) + hoursOnDay);
      }
      dayCursor.setDate(dayCursor.getDate() + 1);
    }
  }

  return dailyHours;
}

export function calculatePeriodEarnings(
  shifts: Shift[],
  settings: EarningsSettings,
  periodStart: Date,
  periodEnd: Date,
  now = new Date(),
): number {
  const dailyHours = getDailyHoursMap(shifts, periodStart, periodEnd, now);

  let total = 0;
  for (const hours of dailyHours.values()) {
    total += calculateShiftEarnings(hours, settings);
  }

  return total;
}

export function calculateDailyEarnings(
  shifts: Shift[],
  settings: EarningsSettings,
  date = new Date(),
  now = new Date(),
): number {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return calculatePeriodEarnings(shifts, settings, dayStart, dayEnd, now);
}

export function calculateWeeklyEarnings(
  shifts: Shift[],
  settings: EarningsSettings,
  now = new Date(),
): number {
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  return calculatePeriodEarnings(shifts, settings, startOfWeek, endOfWeek, now);
}

export function calculateMonthlyEarnings(
  shifts: Shift[],
  settings: EarningsSettings,
  now = new Date(),
): number {
  const startOfMonth = getStartOfMonth(now);
  const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1);
  return calculatePeriodEarnings(shifts, settings, startOfMonth, endOfMonth, now);
}

export function calculateShiftEarningsForShift(
  shift: Shift,
  settings: EarningsSettings,
  now = new Date(),
  bonus = 0,
): number {
  const hours = getShiftDurationHours(shift, now);
  return calculateShiftEarnings(hours, settings, bonus);
}

export function formatCurrency(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const DEFAULT_WAGE_SETTINGS: Omit<WageSettings, 'user_id' | 'updated_at'> = {
  hourly_rate: 12,
  overtime_rate: 18,
  overtime_threshold_hours: 8,
  currency: 'GBP',
};
