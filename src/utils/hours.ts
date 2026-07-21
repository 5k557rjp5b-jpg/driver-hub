import type { Shift, ShiftStatus } from '../types';

export function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getStartOfWeek(date = new Date()): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

export function getStartOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getShiftDurationMs(shift: Shift, now = new Date()): number {
  const start = new Date(shift.start_time).getTime();
  const end = shift.end_time ? new Date(shift.end_time).getTime() : now.getTime();
  return Math.max(0, end - start);
}

export function getShiftDurationHours(shift: Shift, now = new Date()): number {
  return getShiftDurationMs(shift, now) / (1000 * 60 * 60);
}

export function getShiftHoursOnDate(shift: Shift, date: Date, now = new Date()): number {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const shiftStart = new Date(shift.start_time).getTime();
  const shiftEnd = shift.end_time ? new Date(shift.end_time).getTime() : now.getTime();

  if (shiftEnd <= dayStart || shiftStart >= dayEnd) {
    return 0;
  }

  const effectiveStart = Math.max(shiftStart, dayStart);
  const effectiveEnd = Math.min(shiftEnd, dayEnd);
  return Math.max(0, effectiveEnd - effectiveStart) / (1000 * 60 * 60);
}

export function calculateHoursInPeriod(
  shifts: Shift[],
  periodStart: Date,
  periodEnd: Date,
  now = new Date(),
): number {
  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();

  return shifts.reduce((total, shift) => {
    const shiftStart = new Date(shift.start_time).getTime();
    const shiftEnd = shift.end_time ? new Date(shift.end_time).getTime() : now.getTime();

    if (shiftEnd <= startMs || shiftStart >= endMs) {
      return total;
    }

    const effectiveStart = Math.max(shiftStart, startMs);
    const effectiveEnd = Math.min(shiftEnd, endMs);
    return total + Math.max(0, effectiveEnd - effectiveStart) / (1000 * 60 * 60);
  }, 0);
}

export function calculateTodayHours(shifts: Shift[], now = new Date()): number {
  const startOfToday = getStartOfToday();
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  return calculateHoursInPeriod(shifts, startOfToday, endOfToday, now);
}

export function calculateWeekHours(shifts: Shift[], now = new Date()): number {
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  return calculateHoursInPeriod(shifts, startOfWeek, endOfWeek, now);
}

export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Display-only label for shift.status — does not change stored enum values. */
export function formatShiftStatus(status: ShiftStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'needs_review':
      return 'Needs review';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function isShiftRelevantToday(shift: Shift, now = new Date()): boolean {
  const startOfToday = getStartOfToday().getTime();
  const shiftStart = new Date(shift.start_time).getTime();
  const shiftEnd = shift.end_time ? new Date(shift.end_time).getTime() : now.getTime();

  return !shift.end_time || shiftEnd >= startOfToday || shiftStart >= startOfToday;
}

export function filterTodayShifts(shifts: Shift[], now = new Date()): Shift[] {
  return shifts.filter((shift) => isShiftRelevantToday(shift, now));
}
