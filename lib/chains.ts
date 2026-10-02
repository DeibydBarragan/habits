import type { Habit, HabitChain, HabitLog } from "@/lib/types";
import { isHabitActiveOn } from "@/lib/types";
import { computeChainStreak, type Streak } from "@/lib/streak";

/**
 * Builds all full habit chains configured in the user's habits list.
 */
export function buildHabitChains(habits: Habit[]): HabitChain[] {
  const allById = new Map(habits.map((h) => [h.id, h]));
  const targetedIds = new Set<string>();

  for (const h of habits) {
    if (h.next_habit_id && allById.has(h.next_habit_id)) {
      targetedIds.add(h.next_habit_id);
    }
  }

  const chains: HabitChain[] = [];
  const visited = new Set<string>();

  // 1. Chains with an explicit head (not targeted by any other habit, but has next_habit_id)
  const heads = habits.filter(
    (h) => !targetedIds.has(h.id) && h.next_habit_id && allById.has(h.next_habit_id)
  );

  for (const head of heads) {
    if (visited.has(head.id)) continue;
    const chainHabits: Habit[] = [head];
    const inChain = new Set<string>([head.id]);
    let curr = head;

    while (curr.next_habit_id && allById.has(curr.next_habit_id)) {
      const nextH = allById.get(curr.next_habit_id)!;
      if (inChain.has(nextH.id) || visited.has(nextH.id)) break;
      chainHabits.push(nextH);
      inChain.add(nextH.id);
      curr = nextH;
    }

    if (chainHabits.length > 1) {
      chainHabits.forEach((h) => visited.add(h.id));
      chains.push({
        id: `chain-${head.id}`,
        headId: head.id,
        name: head.chain_name || `${head.name} → ...`,
        time: head.chain_time,
        habits: chainHabits,
      });
    }
  }

  // 2. Closed loops/cycles
  for (const h of habits) {
    if (!visited.has(h.id) && h.next_habit_id && allById.has(h.next_habit_id)) {
      const chainHabits: Habit[] = [h];
      const inChain = new Set<string>([h.id]);
      let curr = h;

      while (curr.next_habit_id && allById.has(curr.next_habit_id)) {
        const nextH = allById.get(curr.next_habit_id)!;
        if (inChain.has(nextH.id) || visited.has(nextH.id)) break;
        chainHabits.push(nextH);
        inChain.add(nextH.id);
        curr = nextH;
      }

      if (chainHabits.length > 1) {
        chainHabits.forEach((item) => visited.add(item.id));
        chains.push({
          id: `cycle-${h.id}`,
          headId: h.id,
          name: h.chain_name || `${h.name} → ...`,
          time: h.chain_time,
          habits: chainHabits,
        });
      }
    }
  }

  return chains;
}

export type ChainStats = {
  streak: Streak;
  rate30d: number;
  completedDays: number;
  activeDays: number;
};

/**
 * Computes chain streak and 30-day compliance rate.
 */
export function computeChainStats(
  chain: HabitChain,
  logsByHabit: Map<string, Map<string, HabitLog>>,
  today: string
): ChainStats {
  const streak = computeChainStreak(chain.habits, logsByHabit, today);

  const d = new Date(today + "T00:00:00");
  let activeDays = 0;
  let completedDays = 0;

  for (let i = 0; i < 30; i++) {
    const curDate = new Date(d);
    curDate.setDate(curDate.getDate() - i);
    const iso = curDate.toISOString().slice(0, 10);

    const activeInDay = chain.habits.filter((h) => isHabitActiveOn(h, iso));
    if (activeInDay.length > 0) {
      activeDays++;
      const allDone = activeInDay.every((h) => {
        const log = logsByHabit.get(h.id)?.get(iso);
        if (!log) return false;
        if (log.status !== "done") return false;
        if (h.counters && h.counters.length > 0) {
          const counts = log.counts ?? {};
          return h.counters.every((c) => {
            const val = counts[c.id] ?? 0;
            return h.type === "avoid" ? val <= c.target_count : val >= c.target_count;
          });
        }
        return true;
      });
      if (allDone) completedDays++;
    }
  }

  const rate30d = activeDays > 0 ? Math.round((completedDays / activeDays) * 100) : 0;

  return {
    streak,
    rate30d,
    completedDays,
    activeDays,
  };
}
