import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { getHabitsData, getUserAndProfile } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { HabitsClient } from "@/components/habits-client";
import { computeHabitStreak } from "@/lib/streak";
import { toLocalISODate } from "@/lib/types";

export default async function HabitosPage() {
  const { lang } = await getDictionary();
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect("/login");
  const { habits, categories, byHabit } = await getHabitsData();
  const today = toLocalISODate();

  const streaks: Record<string, any> = {};
  for (const h of habits) {
    const m = byHabit.get(h.id);
    const rec: Record<string, "done" | "missed"> = {};
    m?.forEach((v: { status: "done" | "missed" }, k: string) => { rec[k] = v.status; });
    streaks[h.id] = computeHabitStreak(rec, h.days_active, today);
  }

  return (
    <AppShell lang={lang} name={profile?.name}>
      <HabitsClient habits={habits} categories={categories} streaks={streaks} />
    </AppShell>
  );
}
