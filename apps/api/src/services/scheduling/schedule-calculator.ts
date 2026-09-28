export interface ScheduleCalculationInput {
  startAt: Date;
  delayMs: number;
  index: number;
}

export function calculateScheduledAt({
  startAt,
  delayMs,
  index,
}: ScheduleCalculationInput): Date {
  if (delayMs < 0) {
    throw new Error('Schedule delay cannot be negative');
  }

  if (index < 0 || !Number.isInteger(index)) {
    throw new Error('Schedule index must be a non-negative integer');
  }

  return new Date(startAt.getTime() + index * delayMs);
}
