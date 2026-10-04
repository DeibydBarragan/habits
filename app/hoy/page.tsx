import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { getHabitsData, getUserAndProfile } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { TodayRunner } from "@/components/today-runner";
import { FadeIn } from "@/components/animated";
import { isHabitActiveOn } from "@/lib/types";
import { getServerToday } from "@/lib/date-server";

export default async function HoyPage({ searchParams }: { searchParams?: Promise<{ abrir?: string; fecha?: string }> }) {
  const { lang, t } = await getDictionary();
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect("/login");
  const { habits, categories, byHabit } = await getHabitsData();
  const today = await getServerToday();
  const sp = await searchParams;
  const initialDate = (sp?.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) && sp.fecha <= today) ? sp.fecha : today;
  const activeToday = habits.filter((h) => isHabitActiveOn(h, today));
  const pendingToday = activeToday.filter((h) => !byHabit.get(h.id)?.get(today));

  return (
    <AppShell
      lang={lang}
      name={profile?.name}
      className="max-w-xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1536px]"
    >
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.today.title}</h1>
        <p className="mt-1 text-sm text-muted">{pendingToday.length ? t.today.subtitle : t.today.allDone}</p>
      </FadeIn>
      <FadeIn delay={0.05}>
        {habits.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-4xl" aria-hidden>○</p>
            <p className="mt-2 font-medium">{t.today.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.today.emptySub}</p>
          </div>
        ) : (
          <TodayRunner
            habits={activeToday}
            allHabits={habits}
            categories={categories}
            logsByHabit={byHabit}
            today={today}
            initialDate={initialDate}
            startId={sp?.abrir ?? null}
          />
        )}
      </FadeIn>
    </AppShell>
  );
}
