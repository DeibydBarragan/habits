import { createClient } from "@/lib/supabase/server";
import type { Habit, HabitCategory, HabitLog } from "@/lib/types";

export async function getUserAndProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
  return { supabase, user, profile: profile as { name: string | null } | null };
}

export async function getHabitsData() {
  const { supabase, user } = await getUserAndProfile();
  if (!user) return { user: null, habits: [], categories: [], logs: [], byHabit: new Map() };
  const [{ data: habits }, { data: categories }, { data: logs }] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", user.id).eq("archived", false).order("created_at"),
    supabase.from("habit_categories").select("*").eq("user_id", user.id).order("name"),
    supabase.from("habit_logs").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(2000),
  ]);
  const byHabit = new Map<string, Map<string, HabitLog>>();
  for (const l of (logs ?? []) as HabitLog[]) {
    if (!byHabit.has(l.habit_id)) byHabit.set(l.habit_id, new Map());
    byHabit.get(l.habit_id)!.set(l.date, l);
  }
  return {
    user,
    habits: (habits ?? []) as Habit[],
    categories: (categories ?? []) as HabitCategory[],
    logs: (logs ?? []) as HabitLog[],
    byHabit: byHabit as Map<string, Map<string, HabitLog>>,
  };
}
