import type { Shift } from '../types';

export function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getShiftDurationMs(shift: Shift, now = new Date()): number {
  const start = new Date(shift.start_time).getTime();
  const end = shift.end_time ? new Date(shift.end_time).getTime() : now.getTime();
  return Math.max(0, end - start);
}

export function calculateTodayHours(shifts: Shift[], now = new Date()): number {
  const startOfToday = getStartOfToday().getTime();

  const todayMs = shifts.reduce((total, shift) => {
    const shiftStart = new Date(shift.start_time).getTime();
    const shiftEnd = shift.end_time
      ? new Date(shift.end_time).getTime()
      : now.getTime();

    if (shiftEnd < startOfToday) {
      return total;
    }

    const effectiveStart = Math.max(shiftStart, startOfToday);
    return total + Math.max(0, shiftEnd - effectiveStart);
  }, 0);

  return todayMs / (1000 * 60 * 60);
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
