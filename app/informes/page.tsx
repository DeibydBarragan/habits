import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { getHabitsData, getUserAndProfile } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { ReportsClient } from "@/components/reports-client";
import { computeHabitStreak } from "@/lib/streak";
import { toLocalISODate } from "@/lib/types";
import { FadeIn } from "@/components/animated";

export default async function InformesPage() {
  const { lang, t } = await getDictionary();
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect("/login");
  const { habits, categories, logs, byHabit } = await getHabitsData();
  const today = toLocalISODate();
  const streaks: Record<string, any> = {};
  for (const h of habits) {
    const rec: Record<string, "done" | "missed"> = {};
    byHabit.get(h.id)?.forEach((v: { status: "done" | "missed" }, k: string) => { rec[k] = v.status; });
    streaks[h.id] = computeHabitStreak(rec, h.days_active, today);
  }
  return (
    <AppShell lang={lang} name={profile?.name}>
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.reports.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.reports.subtitle}</p>
      </FadeIn>
      <ReportsClient habits={habits} categories={categories} logs={logs} logsByHabit={byHabit} streaks={streaks} today={today} />
    </AppShell>
  );
}
