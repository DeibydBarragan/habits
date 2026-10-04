"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, Card, ProgressBar, Spinner } from "@heroui/react";
import { BarChart3, Clock, Layers, PieChart, Workflow } from "lucide-react";
import { useLang } from "@/components/language";
import { FadeIn } from "@/components/animated";
import { StreakBadge } from "@/components/streak-badge";
import { AppTooltip } from "@/components/app-tooltip";
import { SearchableSelect } from "@/components/searchable-select";
import { CategoryIcon } from "@/components/category-icon";
import { buildHabitChains, computeChainStats } from "@/lib/chains";
import { isHabitActiveOn, shiftDate, weekdayIso, toLocalISODate, type Habit, type HabitCategory, type HabitChain, type HabitLog } from "@/lib/types";
import type { Streak } from "@/lib/streak";
import { saveLog, clearLog } from "@/actions/logs";

function monthGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const startIsoDay = (first.getDay() + 6) % 7; // 0=lun
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startIsoDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

function formatChainTime(timeVal: string | null | undefined, t: ReturnType<typeof useLang>["t"]) {
  if (!timeVal) return null;
  if (timeVal === "morning") return `🌅 ${t.views.morning}`;
  if (timeVal === "afternoon") return `☀️ ${t.views.afternoon}`;
  if (timeVal === "night") return `🌙 ${t.views.night}`;
  if (timeVal === "anytime") return t.views.anytime;
  return `⏰ ${timeVal}`;
}

type Props = {
  habits: Habit[];
  categories: HabitCategory[];
  logs: HabitLog[];
  logsByHabit?: Map<string, Map<string, HabitLog>>;
  streaks: Record<string, Streak>;
  today: string;
};

export function ReportsClient({
  habits,
  categories,
  logs,
  logsByHabit = new Map(),
  streaks,
  today: initialToday,
}: Props) {
  const { lang, t } = useLang();
  const [today, setToday] = useState(initialToday);

  useEffect(() => {
    const syncToday = () => {
      const browserToday = toLocalISODate(new Date());
      if (browserToday !== today) {
        setToday(browserToday);
      }
    };
    syncToday();
    const interval = setInterval(syncToday, 30000);
    return () => clearInterval(interval);
  }, [today]);

  const [reportMode, setReportMode] = useState<"habits" | "chains">("habits");

  // All chains
  const chains = useMemo(() => buildHabitChains(habits), [habits]);

  // Selected habit / chain
  const [selHabitId, setSelHabitId] = useState<string>(habits[0]?.id ?? "");
  const [selChainId, setSelChainId] = useState<string>(chains[0]?.id ?? "");

  const [view, setView] = useState<"bar" | "pie">("bar");
  const [, startTransition] = useTransition();
  const [savingDate, setSavingDate] = useState<string | null>(null);

  const now = new Date(today + "T12:00:00");
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  // Currently selected habit
  const habit = habits.find((h) => h.id === selHabitId) ?? habits[0];
  const habitLogs = useMemo(
    () => (habit ? logs.filter((l) => l.habit_id === habit.id) : []),
    [logs, habit]
  );

  // Currently selected chain
  const chain = chains.find((c) => c.id === selChainId) ?? chains[0];

  // Options for SearchableSelect
  const habitOptions = useMemo(() => {
    return habits.map((h) => {
      const c = categories.find((cat) => cat.id === h.category_id);
      return {
        id: h.id,
        label: h.name,
        sublabel: c?.name,
        color: h.color,
        icon: c?.icon,
      };
    });
  }, [habits, categories]);

  const chainOptions = useMemo(() => {
    return chains.map((c) => ({
      id: c.id,
      label: c.name,
      sublabel: `${c.habits.length} ${t.views.chainProgress}${c.time ? ` · ${formatChainTime(c.time, t)}` : ""}`,
      color: c.habits[0]?.color ?? "#6366f1",
    }));
  }, [chains, t]);

  // Rate calculation for habit
  function resolvedRate(
    h: Habit,
    entries: HabitLog[]
  ): { done: number; total: number; pct: number; avg: number } {
    let done = 0,
      total = 0,
      sum = 0,
      n = 0;
    const map = new Map(entries.map((l) => [l.date, l]));
    const created = (h.created_at ?? "2000-01-01").slice(0, 10);
    for (let i = 0; i < 30; i++) {
      const iso = shiftDate(today, -i);
      if (iso < created) break;
      const isoW = weekdayIso(iso);
      if (!h.days_active.includes(isoW)) continue;
      const l = map.get(iso);
      if (iso === today && !l) continue; // pendiente hoy
      total++;
      if (l?.status === "done") {
        done++;
        if (l.count != null) {
          sum += l.count;
          n++;
        }
      }
    }
    return {
      done,
      total,
      pct: total ? Math.round((done / total) * 100) : 0,
      avg: n ? sum / n : 0,
    };
  }

  const habitRate = useMemo(() => {
    if (!habit) return { done: 0, total: 0, pct: 0, avg: 0 };
    return resolvedRate(habit, habitLogs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit, habitLogs, today]);

  // Global rates for habits
  const globalHabitRates = useMemo(() => {
    return habits.map((h) => {
      const r = resolvedRate(h, logs.filter((l) => l.habit_id === h.id));
      return { habit: h, pct: r.pct, done: r.done, total: r.total };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, logs, today]);

  // Stats for currently selected chain
  const chainStats = useMemo(() => {
    if (!chain) return null;
    return computeChainStats(chain, logsByHabit, today);
  }, [chain, logsByHabit, today]);

  // Comparative stats for all chains
  const globalChainRates = useMemo(() => {
    return chains.map((c) => {
      const s = computeChainStats(c, logsByHabit, today);
      return { chain: c, ...s };
    });
  }, [chains, logsByHabit, today]);

  const cells = monthGrid(ym.y, ym.m);
  const logMap = useMemo(() => new Map(habitLogs.map((l) => [l.date, l])), [habitLogs]);

  function cycleDay(date: string) {
    if (!habit || savingDate === date) return;
    const cur = logMap.get(date)?.status;
    setSavingDate(date);
    startTransition(async () => {
      try {
        if (!cur) {
          const fd = new FormData();
          fd.set("date", date);
          fd.set("status", "done");
          if (habit.tracking_mode === "count") fd.set("count", String(habit.target_count ?? 1));
          await saveLog(habit.id, fd);
        } else if (cur === "done") {
          const fd = new FormData();
          fd.set("date", date);
          fd.set("status", "missed");
          if (habit.tracking_mode === "count") fd.set("count", String(logMap.get(date)?.count ?? 0));
          await saveLog(habit.id, fd);
        } else {
          await clearLog(habit.id, date);
        }
      } finally {
        setSavingDate(null);
      }
    });
  }

  function dayLabel(date: string): string {
    return new Date(date + "T12:00:00").toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
      day: "numeric",
      month: "short",
    });
  }

  // Common pie radius
  const R = 44;
  const C = 2 * Math.PI * R;

  // Active item stats
  const activeName = reportMode === "habits" ? habit?.name : chain?.name;
  const activeColor = reportMode === "habits" ? (habit?.color ?? "#3b82f6") : (chain?.habits[0]?.color ?? "#6366f1");
  const activeDone = reportMode === "habits" ? habitRate.done : (chainStats?.completedDays ?? 0);
  const activeTotal = reportMode === "habits" ? habitRate.total : (chainStats?.activeDays ?? 0);
  const activePct = reportMode === "habits" ? habitRate.pct : (chainStats?.rate30d ?? 0);
  const activeMiss = Math.max(0, activeTotal - activeDone);
  const doneFrac = activeTotal ? activeDone / activeTotal : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Top Filter and Select Bar */}
      <FadeIn className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Toggle Mode: Habits vs Chains */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-surface/60 dark:bg-zinc-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 w-fit shrink-0 shadow-xs">
          <button
            type="button"
            onClick={() => setReportMode("habits")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              reportMode === "habits"
                ? "bg-accent text-accent-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Layers size={13} />
            <span>{t.views.tabHabits}</span>
          </button>
          <button
            type="button"
            onClick={() => setReportMode("chains")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              reportMode === "chains"
                ? "bg-accent text-accent-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Workflow size={13} />
            <span>{t.views.tabChains}</span>
            <span className="text-[11px] opacity-80 tabular-nums">({chains.length})</span>
          </button>
        </div>

        {/* Searchable Combobox Selector */}
        <div className="flex-1 max-w-md w-full">
          {reportMode === "habits" ? (
            <SearchableSelect
              options={habitOptions}
              value={selHabitId}
              onChange={(val) => {
                if (val) setSelHabitId(val);
              }}
              placeholder={t.reports.pick}
              searchPlaceholder={`${t.common?.search || "Buscar"} hábito…`}
              allowClear={false}
            />
          ) : (
            <SearchableSelect
              options={chainOptions}
              value={selChainId}
              onChange={(val) => {
                if (val) setSelChainId(val);
              }}
              placeholder={t.views.tabChains}
              searchPlaceholder={`${t.common?.search || "Buscar"} cadena…`}
              allowClear={false}
              disabled={chains.length === 0}
            />
          )}
        </div>

        {/* Bar vs Pie Chart Switcher */}
        <div className="flex gap-1 bg-surface/60 dark:bg-zinc-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl p-1 shadow-xs shrink-0" role="group" aria-label="view">
          <AppTooltip content={t.chart.bar}>
            <Button
              isIconOnly
              size="sm"
              variant={view === "bar" ? "primary" : "ghost"}
              className={`h-8 w-8 rounded-xl ${view === "bar" ? "" : "text-muted hover:text-foreground"}`}
              aria-label={t.chart.barLabel}
              onPress={() => setView("bar")}
            >
              <BarChart3 size={16} />
            </Button>
          </AppTooltip>

          <AppTooltip content={t.chart.pie}>
            <Button
              isIconOnly
              size="sm"
              variant={view === "pie" ? "primary" : "ghost"}
              className={`h-8 w-8 rounded-xl ${view === "pie" ? "" : "text-muted hover:text-foreground"}`}
              aria-label={t.chart.pieLabel}
              onPress={() => setView("pie")}
            >
              <PieChart size={16} />
            </Button>
          </AppTooltip>
        </div>
      </FadeIn>

      {/* Main Content: Habits Mode */}
      {reportMode === "habits" ? (
        !habit ? (
          <Card className="rounded-2xl bg-surface border border-border/50">
            <Card.Content className="p-8 text-center">
              <p className="text-4xl" aria-hidden>○</p>
              <p className="mt-2 font-medium">{t.reports.empty}</p>
            </Card.Content>
          </Card>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
            {/* Left: Stats & Charts */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 w-full">
              {/* Quick Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Card className="rounded-2xl bg-surface border border-border/50">
                  <Card.Content className="p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{t.reports.rate30}</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: habit.color }}>{habitRate.pct}%</span>
                      </div>
                      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                        {habitRate.done} <span className="text-sm font-normal text-muted">/ {habitRate.total} {t.reports.total}</span>
                      </p>
                    </div>
                    {habit.tracking_mode === "count" && habitRate.avg > 0 && (
                      <p className="mt-2 text-xs text-muted tabular-nums">
                        {t.reports.avg}: <span className="font-semibold text-foreground">{habitRate.avg.toFixed(1)} {habit.unit ?? ""}</span>
                      </p>
                    )}
                  </Card.Content>
                </Card>

                <Card className="rounded-2xl bg-surface border border-border/50">
                  <Card.Content className="p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted uppercase tracking-wider">{t.reports.current}</span>
                      {streaks[habit.id] && <StreakBadge streak={streaks[habit.id]} kind={habit.type} />}
                    </div>
                    <div className="mt-2 flex items-baseline gap-4">
                      <div>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                          {streaks[habit.id]?.current ?? 0}
                        </p>
                        <p className="text-[11px] text-muted">{t.reports.current}</p>
                      </div>
                      <div className="border-l border-border/40 pl-4">
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-muted">
                          {streaks[habit.id]?.best ?? 0}
                        </p>
                        <p className="text-[11px] text-muted">{t.reports.best}</p>
                      </div>
                    </div>
                  </Card.Content>
                </Card>
              </div>

              {/* Chart Breakdown */}
              <Card className="rounded-2xl bg-surface border border-border/50">
                <Card.Content className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">{habit.name}</p>
                    <span className="text-xs text-muted tabular-nums">
                      {t.today.done}: <span className="text-foreground font-semibold">{habitRate.done}</span> · {t.today.missed}: <span className="text-foreground font-semibold">{activeMiss}</span>
                    </span>
                  </div>
                  {habitRate.total === 0 ? (
                    <p className="text-sm text-muted py-2">{t.reports.empty}</p>
                  ) : view === "bar" ? (
                    <div className="space-y-2 py-1">
                      <ProgressBar value={habitRate.pct}>
                        <ProgressBar.Track className="h-3.5 rounded-full bg-default/20">
                          <ProgressBar.Fill style={{ background: habit.color, width: `${habitRate.pct}%` }} className="rounded-full" />
                        </ProgressBar.Track>
                      </ProgressBar>
                      <div className="flex justify-between text-xs text-muted">
                        <span>0%</span>
                        <span className="font-semibold text-foreground">{habitRate.pct}%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-6 py-2">
                      <svg width="100" height="100" viewBox="0 0 110 110" role="img" aria-label={`${habitRate.pct}%`} className="shrink-0">
                        <circle cx="55" cy="55" r={R} fill="none" strokeWidth="12" className="stroke-default/20" />
                        <circle
                          cx="55"
                          cy="55"
                          r={R}
                          fill="none"
                          stroke={habit.color}
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${C * doneFrac} ${C}`}
                          transform="rotate(-90 55 55)"
                        />
                      </svg>
                      <div className="flex flex-col gap-2 text-xs tabular-nums">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
                          <span>{t.today.done}: <strong className="text-foreground">{habitRate.done}</strong> ({habitRate.pct}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-danger shrink-0" />
                          <span>{t.today.missed}: <strong className="text-foreground">{activeMiss}</strong> ({100 - habitRate.pct}%)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card.Content>
              </Card>

              {/* Global Comparative Habits */}
              <Card className="rounded-2xl bg-surface border border-border/50">
                <Card.Content className="p-5">
                  <p className="mb-3 text-sm font-semibold">{t.reports.global}</p>
                  <div className="flex flex-col gap-3">
                    {globalHabitRates.map(({ habit: h, pct, done, total }) => (
                      <div key={h.id}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="truncate font-medium">{h.name}</span>
                          <span className="tabular-nums text-muted">{done}/{total} · {pct}%</span>
                        </div>
                        <ProgressBar value={pct}>
                          <ProgressBar.Track className="h-2 rounded-full bg-default/20">
                            <ProgressBar.Fill style={{ background: h.color, width: `${pct}%` }} className="rounded-full" />
                          </ProgressBar.Track>
                        </ProgressBar>
                      </div>
                    ))}
                  </div>
                </Card.Content>
              </Card>
            </div>

            {/* Right: Interactive Month Calendar */}
            <div className="w-full lg:w-88 xl:w-96 shrink-0 lg:sticky lg:top-24">
              <Card className="rounded-2xl bg-surface border border-border/50">
                <Card.Content className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <Button size="sm" variant="ghost" onPress={() => setYm((p) => (p.m === 1 ? { y: p.y - 1, m: 12 } : { y: p.y, m: p.m - 1 }))}>
                      ‹ {t.reports.prev}
                    </Button>
                    <p className="text-sm font-semibold tabular-nums">{ym.m}/{ym.y}</p>
                    <Button size="sm" variant="ghost" onPress={() => setYm((p) => (p.m === 12 ? { y: p.y + 1, m: 1 } : { y: p.y, m: p.m + 1 }))}>
                      {t.reports.next} ›
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1" role="group" aria-label={t.reports.editDay}>
                    {cells.map((date, i) => {
                      if (!date) return <span key={i} />;
                      const l = logMap.get(date);
                      const d = new Date(date + "T12:00:00");
                      const jsDay = d.getDay();
                      const active = habit.days_active.includes(jsDay === 0 ? 7 : jsDay);
                      const isToday = date === today;
                      const isSaving = savingDate === date;
                      const status = !active ? "rest" : l?.status === "done" ? "done" : l?.status === "missed" ? "missed" : "none";
                      const statusLabel =
                        status === "done" ? t.today.done
                        : status === "missed" ? t.today.missed
                        : status === "rest" ? t.habit.restDay
                        : t.reports.clear;
                      const dotClass =
                        status === "done" ? ""
                        : status === "missed" ? "bg-danger"
                        : status === "rest" ? "border border-border"
                        : "bg-default";
                      return (
                        <AppTooltip
                          key={date}
                          content={
                            <span className="flex items-center gap-1.5 text-xs tabular-nums">
                              <span
                                className={`h-2 w-2 rounded-full ${dotClass}`}
                                style={status === "done" ? { backgroundColor: habit.color } : undefined}
                              />
                              {dayLabel(date)} · {statusLabel}
                            </span>
                          }
                          className="w-full aspect-square"
                        >
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => cycleDay(date)}
                            aria-label={`${dayLabel(date)}: ${statusLabel}`}
                            aria-live="polite"
                            className={`flex w-full h-full cursor-pointer items-center justify-center rounded-lg text-[11px] tabular-nums transition ${!active ? "text-muted/40" : l?.status === "done" ? "font-semibold text-white" : l?.status === "missed" ? "bg-danger/15 text-danger" : "bg-default text-muted hover:text-foreground"} ${isToday ? "ring-2 ring-accent" : ""}`}
                            style={l?.status === "done" ? { backgroundColor: habit.color } : undefined}
                          >
                            {isSaving ? <Spinner size="sm" color="current" aria-label={t.reports.editDay} /> : Number(date.slice(8))}
                          </button>
                        </AppTooltip>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
                      {t.today.done}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                      {t.today.missed}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-default" />
                      {t.reports.clear}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full border border-border" />
                      {t.habit.restDay}
                    </span>
                  </div>
                </Card.Content>
              </Card>
            </div>
          </div>
        )
      ) : (
        /* Main Content: Chains Mode */
        !chain ? (
          <Card className="rounded-2xl bg-surface border border-border/50">
            <Card.Content className="p-8 text-center flex flex-col items-center gap-2">
              <Workflow size={36} className="text-muted/60" />
              <p className="mt-2 font-medium text-base">{t.views.emptyChainsTitle}</p>
              <p className="text-xs text-muted max-w-sm">{t.views.emptyChainsSub}</p>
            </Card.Content>
          </Card>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
            {/* Left: Chain Stats & Charts */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 w-full">
              {/* Chain Quick Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Card className="rounded-2xl bg-surface border border-border/50">
                  <Card.Content className="p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{t.reports.rate30}</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: activeColor }}>
                          {chainStats?.rate30d ?? 0}%
                        </span>
                      </div>
                      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                        {chainStats?.completedDays ?? 0}{" "}
                        <span className="text-sm font-normal text-muted">/ {chainStats?.activeDays ?? 0} {t.reports.total}</span>
                      </p>
                    </div>
                    {chain.time && (
                      <p className="mt-2 text-xs text-accent font-medium flex items-center gap-1">
                        <Clock size={12} />
                        <span>{formatChainTime(chain.time, t)}</span>
                      </p>
                    )}
                  </Card.Content>
                </Card>

                <Card className="rounded-2xl bg-surface border border-border/50">
                  <Card.Content className="p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted uppercase tracking-wider">{t.reports.current}</span>
                      {chainStats && <StreakBadge streak={chainStats.streak} kind="build" />}
                    </div>
                    <div className="mt-2 flex items-baseline gap-4">
                      <div>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                          {chainStats?.streak?.current ?? 0}
                        </p>
                        <p className="text-[11px] text-muted">{t.reports.current}</p>
                      </div>
                      <div className="border-l border-border/40 pl-4">
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-muted">
                          {chainStats?.streak?.best ?? 0}
                        </p>
                        <p className="text-[11px] text-muted">{t.reports.best}</p>
                      </div>
                    </div>
                  </Card.Content>
                </Card>
              </div>

              {/* Chain Visualization Breakdown Card */}
              <Card className="rounded-2xl bg-surface border border-border/50">
                <Card.Content className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold truncate">{chain.name}</p>
                      <span className="text-xs text-muted tabular-nums">({chain.habits.length} {t.views.chainProgress})</span>
                    </div>
                    <span className="text-xs text-muted tabular-nums">
                      {t.today.done}: <span className="text-foreground font-semibold">{activeDone}</span> · {t.today.missed}: <span className="text-foreground font-semibold">{activeMiss}</span>
                    </span>
                  </div>

                  {/* Connected habits pills flow */}
                  <div className="flex items-center gap-1.5 flex-wrap pb-3 mb-3 border-b border-border/30">
                    {chain.habits.map((h, i) => {
                      const cat = categories.find((c) => c.id === h.category_id);
                      return (
                        <div key={h.id} className="flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-lg border border-border/40 bg-surface/80"
                            style={{ borderLeftColor: h.color, borderLeftWidth: 3 }}
                          >
                            <span style={{ color: h.color }}>
                              <CategoryIcon icon={cat?.icon ?? "other"} size={12} />
                            </span>
                            <span className="truncate max-w-[110px]">{h.name}</span>
                          </span>
                          {i < chain.habits.length - 1 && <span className="text-muted text-xs">→</span>}
                        </div>
                      );
                    })}
                  </div>

                  {activeTotal === 0 ? (
                    <p className="text-sm text-muted py-2">{t.reports.empty}</p>
                  ) : view === "bar" ? (
                    <div className="space-y-2 py-1">
                      <ProgressBar value={activePct}>
                        <ProgressBar.Track className="h-3.5 rounded-full bg-default/20">
                          <ProgressBar.Fill style={{ background: activeColor, width: `${activePct}%` }} className="rounded-full" />
                        </ProgressBar.Track>
                      </ProgressBar>
                      <div className="flex justify-between text-xs text-muted">
                        <span>0%</span>
                        <span className="font-semibold text-foreground">{activePct}%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-6 py-2">
                      <svg width="100" height="100" viewBox="0 0 110 110" role="img" aria-label={`${activePct}%`} className="shrink-0">
                        <circle cx="55" cy="55" r={R} fill="none" strokeWidth="12" className="stroke-default/20" />
                        <circle
                          cx="55"
                          cy="55"
                          r={R}
                          fill="none"
                          stroke={activeColor}
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${C * doneFrac} ${C}`}
                          transform="rotate(-90 55 55)"
                        />
                      </svg>
                      <div className="flex flex-col gap-2 text-xs tabular-nums">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: activeColor }} />
                          <span>{t.today.done}: <strong className="text-foreground">{activeDone}</strong> ({activePct}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-danger shrink-0" />
                          <span>{t.today.missed}: <strong className="text-foreground">{activeMiss}</strong> ({100 - activePct}%)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card.Content>
              </Card>

              {/* Comparative Chain Fulfillment */}
              <Card className="rounded-2xl bg-surface border border-border/50">
                <Card.Content className="p-5">
                  <p className="mb-3 text-sm font-semibold">{t.views.tabChains} - {t.reports.global}</p>
                  <div className="flex flex-col gap-3">
                    {globalChainRates.map(({ chain: c, rate30d, completedDays, activeDays }) => (
                      <div key={c.id}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="truncate font-medium">{c.name}</span>
                          <span className="tabular-nums text-muted">{completedDays}/{activeDays} · {rate30d}%</span>
                        </div>
                        <ProgressBar value={rate30d}>
                          <ProgressBar.Track className="h-2 rounded-full bg-default/20">
                            <ProgressBar.Fill style={{ background: c.habits[0]?.color ?? "#6366f1", width: `${rate30d}%` }} className="rounded-full" />
                          </ProgressBar.Track>
                        </ProgressBar>
                      </div>
                    ))}
                  </div>
                </Card.Content>
              </Card>
            </div>

            {/* Right: Chain Month Calendar */}
            <div className="w-full lg:w-88 xl:w-96 shrink-0 lg:sticky lg:top-24">
              <Card className="rounded-2xl bg-surface border border-border/50">
                <Card.Content className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <Button size="sm" variant="ghost" onPress={() => setYm((p) => (p.m === 1 ? { y: p.y - 1, m: 12 } : { y: p.y, m: p.m - 1 }))}>
                      ‹ {t.reports.prev}
                    </Button>
                    <p className="text-sm font-semibold tabular-nums">{ym.m}/{ym.y}</p>
                    <Button size="sm" variant="ghost" onPress={() => setYm((p) => (p.m === 12 ? { y: p.y + 1, m: 1 } : { y: p.y, m: p.m + 1 }))}>
                      {t.reports.next} ›
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1" role="group" aria-label={chain.name}>
                    {cells.map((date, i) => {
                      if (!date) return <span key={i} />;

                      const isToday = date === today;
                      const activeInDay = chain.habits.filter((h) => isHabitActiveOn(h, date));
                      const isRest = activeInDay.length === 0;

                      let status: "done" | "missed" | "rest" | "none" = "none";
                      if (isRest) {
                        status = "rest";
                      } else {
                        const allDone = activeInDay.every((h) => {
                          const l = logsByHabit.get(h.id)?.get(date);
                          if (!l || l.status !== "done") return false;
                          if (h.counters && h.counters.length > 0) {
                            const counts = l.counts ?? {};
                            return h.counters.every((cnt) => {
                              const val = counts[cnt.id] ?? 0;
                              return h.type === "avoid" ? val <= cnt.target_count : val >= cnt.target_count;
                            });
                          }
                          return true;
                        });

                        const anyMissed = activeInDay.some((h) => logsByHabit.get(h.id)?.get(date)?.status === "missed");

                        if (allDone) {
                          status = "done";
                        } else if (date === today && !anyMissed) {
                          status = "none";
                        } else if (anyMissed || date < today) {
                          status = "missed";
                        }
                      }

                      const statusLabel =
                        status === "done" ? t.views.chainCompleted
                        : status === "missed" ? t.today.missed
                        : status === "rest" ? t.habit.restDay
                        : t.habit.pendingToday;

                      const dotClass =
                        status === "done" ? ""
                        : status === "missed" ? "bg-danger"
                        : status === "rest" ? "border border-border"
                        : "bg-default";

                      return (
                        <AppTooltip
                          key={date}
                          content={
                            <span className="flex items-center gap-1.5 text-xs tabular-nums">
                              <span
                                className={`h-2 w-2 rounded-full ${dotClass}`}
                                style={status === "done" ? { backgroundColor: activeColor } : undefined}
                              />
                              {dayLabel(date)} · {statusLabel}
                            </span>
                          }
                          className="w-full aspect-square"
                        >
                          <div
                            aria-label={`${dayLabel(date)}: ${statusLabel}`}
                            className={`flex w-full h-full select-none items-center justify-center rounded-lg text-[11px] tabular-nums transition ${!isRest && status === "done" ? "font-semibold text-white" : status === "missed" ? "bg-danger/15 text-danger font-medium" : status === "rest" ? "text-muted/40" : "bg-default text-muted"} ${isToday ? "ring-2 ring-accent" : ""}`}
                            style={status === "done" ? { backgroundColor: activeColor } : undefined}
                          >
                            {Number(date.slice(8))}
                          </div>
                        </AppTooltip>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeColor }} />
                      {t.views.chainCompleted}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                      {t.today.missed}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-default" />
                      {t.habit.pendingToday}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full border border-border" />
                      {t.habit.restDay}
                    </span>
                  </div>
                </Card.Content>
              </Card>
            </div>
          </div>
        )
      )}
    </div>
  );
}
