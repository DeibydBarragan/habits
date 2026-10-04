import { shiftDate, weekdayIso, type Habit, type HabitLog } from "@/lib/types";

export type Streak = {
  current: number;
  best: number;
  freeze: boolean;
  todayPending: boolean;
  todayCovered: boolean;
};

function nextDayISO(iso: string): string {
  return shiftDate(iso, 1);
}

function prevDayISO(iso: string): string {
  return shiftDate(iso, -1);
}

/**
 * Racha por hábito con días de descanso.
 * - Solo cuentan días en daysActive. Descansos se saltan.
 * - logs: Map date -> "done" | "missed". Ausencia en día activo pasado = fallo.
 * - Hoy sin log = pendiente (no rompe).
 * - Congelamiento: se gana con 2 done seguidos (días activos), cap 1. Consume 1 fallo.
 * - 2 fallos seguidos (días activos) => reinicio a 0.
 */
export function computeHabitStreak(
  logs: Record<string, "done" | "missed">,
  daysActive: number[],
  todayISO: string
): Streak {
  const activeSet = new Set(daysActive);
  // Ventana: últimos 400 días activos como máximo.
  const days: string[] = [];
  let cursor = todayISO;
  for (let i = 0; i < 1200 && days.length < 400; i++) {
    if (activeSet.has(weekdayIso(cursor))) days.push(cursor);
    if (cursor <= "2000-01-01") break;
    cursor = prevDayISO(cursor);
  }
  days.reverse(); // ascendente

  let current = 0;
  let best = 0;
  let freeze = false;
  let consecDone = 0;
  let run = 0; // racha en construcción
  let curBuilt = 0;

  const todayCovered = logs[todayISO] === "done" || logs[todayISO] === "missed";
  const todayPending = !(todayISO in logs) && activeSet.has(weekdayIso(todayISO));

  for (const day of days) {
    const isToday = day === todayISO;
    const v = logs[day];
    if (v === "done") {
      run += 1;
      consecDone += 1;
      if (run === 1 || consecDone >= 2) freeze = true;
      if (run > best) best = run;
    } else if (v === "missed") {
      consecDone = 0;
      if (run > 0 && freeze) {
        freeze = false; // consume congelamiento, run se mantiene
      } else {
        run = 0;
      }
    } else {
      // sin registro
      if (isToday) {
        // pendiente: no rompe
      } else {
        consecDone = 0;
        if (run > 0 && freeze) freeze = false;
        else run = 0;
      }
    }
  }
  curBuilt = run;
  // current = racha que llega hasta hoy/ayer (si hoy pendiente, vale run actual)
  current = curBuilt;

  return { current, best, freeze, todayPending, todayCovered };
}

/**
 * Racha para una cadena completa de hábitos.
 * - Una cadena está 'done' en una fecha si TODOS los hábitos de la cadena tienen log 'done'.
 * - Está 'missed' si AL MENOS UN hábito tiene log 'missed' (o no tiene log en día activo pasado).
 * - Días activos de la cadena: intersección de days_active de todos los hábitos en la cadena.
 *   Si la intersección estuviera vacía, se usa el days_active del primer hábito.
 * - Se delega a computeHabitStreak para mantener idéntico comportamiento de freeze y racha.
 */
export function computeChainStreak(
  chainHabits: Habit[],
  logsByHabit: Map<string, Map<string, HabitLog>>,
  todayISO: string
): Streak {
  if (chainHabits.length === 0) {
    return { current: 0, best: 0, freeze: false, todayPending: false, todayCovered: false };
  }

  // 1. Días activos comunes de la cadena
  let commonDays = new Set(chainHabits[0].days_active);
  for (let i = 1; i < chainHabits.length; i++) {
    const nextSet = new Set(chainHabits[i].days_active);
    commonDays = new Set([...commonDays].filter((d) => nextSet.has(d)));
  }
  const daysActive = commonDays.size > 0 ? Array.from(commonDays).sort() : chainHabits[0].days_active;

  // 2. Construir mapa unificado de logs de la cadena
  const chainLogs: Record<string, "done" | "missed"> = {};

  // Recolectar todas las fechas en que cualquier hábito de la cadena tiene registro
  const allDates = new Set<string>();
  for (const h of chainHabits) {
    const m = logsByHabit.get(h.id);
    if (m) {
      for (const d of m.keys()) {
        allDates.add(d);
      }
    }
  }

  for (const date of allDates) {
    let allDone = true;
    let anyMissed = false;

    for (const h of chainHabits) {
      const log = logsByHabit.get(h.id)?.get(date);
      if (log?.status === "missed") {
        anyMissed = true;
        allDone = false;
        break;
      } else if (log?.status !== "done") {
        allDone = false;
      }
    }

    if (allDone) {
      chainLogs[date] = "done";
    } else if (anyMissed) {
      chainLogs[date] = "missed";
    }
  }

  return computeHabitStreak(chainLogs, daysActive, todayISO);
}
