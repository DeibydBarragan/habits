export type Streak = {
  current: number;
  best: number;
  freeze: boolean;
  todayPending: boolean;
  todayCovered: boolean;
};

function nextDayISO(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return toISO(d);
}

function prevDayISO(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return toISO(d);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekdayIso(dateISO: string): number {
  const js = new Date(dateISO + "T12:00:00").getDay();
  return js === 0 ? 7 : js;
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
