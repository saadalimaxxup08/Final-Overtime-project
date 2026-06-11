import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface OvertimeCalculation {
  totalHours: number;
  overtimeHours: number;
}

/**
 * Calculates total hours and overtime hours between check-in and check-out.
 * Overtime is calculated as hours worked beyond 8.00 hours a day.
 */
export function calculateHours(checkIn: string, checkOut: string): OvertimeCalculation {
  const start = dayjs(checkIn);
  const end = dayjs(checkOut);
  
  if (!start.isValid() || !end.isValid()) {
    return { totalHours: 0, overtimeHours: 0 };
  }

  // Difference in hours as a float
  let totalHours = end.diff(start, 'hour', true);
  
  // Guard against negative hours (checkout before checkin)
  if (totalHours < 0) {
    totalHours = 0;
  }

  // Overtime is any work exceeding 8 hours
  const overtimeHours = Math.max(0, totalHours - 8);

  return {
    totalHours: Number(totalHours.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
  };
}
