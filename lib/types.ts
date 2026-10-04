export const PALETTE_12 = [
  "#F97316",
  "#2563EB",
  "#9333EA",
  "#16A34A",
  "#DB2777",
  "#0891B2",
  "#65A30D",
  "#64748B",
  "#EF4444",
  "#EAB308",
  "#0D9488",
  "#4F46E5",
] as const;

export type HabitType = "build" | "avoid";
export type TrackingMode = "check" | "count";
export type LogStatus = "done" | "missed";

export type HabitCounter = {
  id: string;
  name: string;
  target_count: number;
  unit?: string | null;
};

export type HabitCategory = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  type: HabitType;
  category_id: string | null;
  color: string;
  days_active: number[];
  next_habit_id: string | null;
  tracking_mode: TrackingMode;
  target_count: number | null;
  unit: string | null;
  counters?: HabitCounter[] | null;
  chain_name?: string | null;
  chain_time?: string | null;
  archived: boolean;
  created_at: string;
};

export type HabitChain = {
  id: string;
  headId: string;
  name: string;
  time?: string | null;
  habits: Habit[];
};

export type HabitLog = {
  id: string;
  user_id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD local
  status: LogStatus;
  count: number | null;
  counts?: Record<string, number> | null;
};

/** 1=lun … 7=dom (ISO). Pure calendar calculation independent of timezone. */
export function weekdayIso(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const js = date.getUTCDay(); // 0=dom
  return js === 0 ? 7 : js;
}

export function toLocalISODate(d: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch {
      // Fallback if invalid timezone string provided
    }
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isHabitActiveOn(habit: Habit, dateISO: string): boolean {
  return habit.days_active.includes(weekdayIso(dateISO));
}

/** Adds or subtracts days from a YYYY-MM-DD string, pure calendar arithmetic. */
export function shiftDate(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const newY = date.getUTCFullYear();
  const newM = String(date.getUTCMonth() + 1).padStart(2, "0");
  const newD = String(date.getUTCDate()).padStart(2, "0");
  return `${newY}-${newM}-${newD}`;
}

