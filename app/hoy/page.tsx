import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { getHabitsData, getUserAndProfile } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { TodayRunner } from "@/components/today-runner";
import { FadeIn } from "@/components/animated";
import { toLocalISODate, isHabitActiveOn } from "@/lib/types";

export default async function HoyPage({ searchParams }: { searchParams?: Promise<{ abrir?: string }> }) {
  const { lang, t } = await getDictionary();
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect("/login");
  const { habits, categories, byHabit } = await getHabitsData();
  const today = toLocalISODate();
  const active = habits.filter((h) => isHabitActiveOn(h, today));
  const pending = active.filter((h) => !byHabit.get(h.id)?.get(today));
  const sp = await searchParams;

  return (
    <AppShell lang={lang} t={t} name={profile?.name}>
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.today.title}</h1>
        <p className="mt-1 text-sm text-muted">{pending.length ? t.today.subtitle : t.today.allDone}</p>
      </FadeIn>
      <FadeIn delay={0.05}>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-4xl" aria-hidden>○</p>
            <p className="mt-2 font-medium">{t.today.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.today.emptySub}</p>
          </div>
        ) : (
          <TodayRunner habits={active} categories={categories} logsByHabit={byHabit} today={today} startId={sp?.abrir ?? null} />
        )}
      </FadeIn>
    </AppShell>
  );
}
