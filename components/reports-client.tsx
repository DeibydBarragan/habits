"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card, ProgressBar, Select, ListBox, Spinner, Tooltip } from "@heroui/react";
import { useLang } from "@/components/language";
import { FadeIn } from "@/components/animated";
import { StreakBadge } from "@/components/streak-badge";
import type { Habit, HabitCategory, HabitLog } from "@/lib/types";
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

export function ReportsClient({
  habits,
  categories,
  logs,
  streaks,
  today,
}: {
  habits: Habit[];
  categories: HabitCategory[];
  logs: HabitLog[];
  streaks: Record<string, Streak>;
  today: string;
}) {
  const { lang, t } = useLang();
  const [sel, setSel] = useState<string>(habits[0]?.id ?? "");
  const [view, setView] = useState<"bar" | "pie">("bar");
  const [pending, startTransition] = useTransition();
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const now = new Date(today + "T12:00:00");
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  const habit = habits.find((h) => h.id === sel);
  const habitLogs = useMemo(() => logs.filter((l) => l.habit_id === sel), [logs, sel]);

  // tasa: días activos resueltos desde la creación del hábito (máx 30).
  // Los días previos a su creación no cuentan; hoy sin registro es pendiente.
  function resolvedRate(
    h: Habit,
    entries: HabitLog[]
  ): { done: number; total: number; pct: number; avg: number } {
    let done = 0, total = 0, sum = 0, n = 0;
    const map = new Map(entries.map((l) => [l.date, l]));
    const created = (h.created_at ?? "2000-01-01").slice(0, 10);
    for (let i = 0; i < 30; i++) {
      const d = new Date(today + "T12:00:00");
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (iso < created) break;
      const js = d.getDay();
      const isoW = js === 0 ? 7 : js;
      if (!h.days_active.includes(isoW)) continue;
      const l = map.get(iso);
      if (iso === today && !l) continue; // pendiente hoy
      total++;
      if (l?.status === "done") {
        done++;
        if (l.count != null) { sum += l.count; n++; }
      }
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0, avg: n ? sum / n : 0 };
  }

  const rate = useMemo(() => {
    if (!habit) return { done: 0, total: 0, pct: 0, avg: 0 };
    return resolvedRate(habit, habitLogs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit, habitLogs, today]);

  // global: barras por hábito
  const globalRates = useMemo(() => {
    return habits.map((h) => {
      const r = resolvedRate(h, logs.filter((l) => l.habit_id === h.id));
      return { habit: h, pct: r.pct, done: r.done, total: r.total };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, logs, today]);

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

  if (!habit) {
    return (
      <Card className="rounded-2xl bg-surface"><Card.Content className="p-8 text-center">
        <p className="text-4xl" aria-hidden>○</p>
        <p className="mt-2 font-medium">{t.reports.empty}</p>
      </Card.Content></Card>
    );
  }

  const pieDone = rate.done;
  const pieMiss = rate.total - rate.done;
  const R = 44;
  const C = 2 * Math.PI * R;
  const doneFrac = rate.total ? rate.done / rate.total : 0;

  return (
    <div className="flex flex-col gap-4">
      <FadeIn className="flex flex-wrap items-center gap-2">
        <Select name="habit" defaultValue={sel} onSelectionChange={(k) => setSel(String(k))} className="min-w-48 flex-1" aria-label={t.reports.pick}>
          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover><ListBox>
            {habits.map((h) => (
              <ListBox.Item key={h.id} id={h.id} textValue={h.name}>{h.name}<ListBox.ItemIndicator /></ListBox.Item>
            ))}
          </ListBox></Select.Popover>
        </Select>
        <div className="flex gap-1" role="group" aria-label="view">
          <Button size="sm" variant={view === "bar" ? "primary" : "secondary"} aria-label={t.chart.barLabel} onPress={() => setView("bar")}>{t.chart.bar}</Button>
          <Button size="sm" variant={view === "pie" ? "primary" : "secondary"} aria-label={t.chart.pieLabel} onPress={() => setView("pie")}>{t.chart.pie}</Button>
        </div>
      </FadeIn>

      <Card className="rounded-2xl bg-surface">
        <Card.Content className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{habit.name}</p>
            {streaks[habit.id] && <StreakBadge streak={streaks[habit.id]} kind={habit.type} />}
          </div>
          <p className="mt-2 text-xs text-muted tabular-nums">{t.reports.rate30}: {rate.done}/{rate.total} · {rate.pct}%{habit.tracking_mode === "count" && rate.avg ? ` · ${t.reports.avg} ${rate.avg.toFixed(1)}` : ""}</p>
          {rate.total === 0 ? (
            <p className="mt-3 text-sm text-muted">{t.reports.empty}</p>
          ) : view === "bar" ? (
            <ProgressBar value={rate.pct} className="mt-3">
              <ProgressBar.Track>
                <ProgressBar.Fill style={{ background: habit.color, width: `${rate.pct}%` }} />
              </ProgressBar.Track>
            </ProgressBar>
          ) : (
            <div className="mt-3 flex items-center gap-4">
              <svg width="110" height="110" viewBox="0 0 110 110" role="img" aria-label={`${rate.pct}%`}>
                <circle cx="55" cy="55" r={R} fill="none" strokeWidth="12" className="stroke-default" />
                <circle cx="55" cy="55" r={R} fill="none" stroke={habit.color} strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${C * doneFrac} ${C}`} transform="rotate(-90 55 55)" />
              </svg>
              <div className="text-xs text-muted tabular-nums">
                <p><span style={{ color: habit.color }}>●</span> {t.today.done}: {pieDone}</p>
                <p><span className="text-danger">●</span> {t.today.missed}: {pieMiss}</p>
              </div>
            </div>
          )}
        </Card.Content>
      </Card>

      <Card className="rounded-2xl bg-surface">
        <Card.Content className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Button size="sm" variant="ghost" onPress={() => setYm((p) => p.m === 1 ? { y: p.y - 1, m: 12 } : { y: p.y, m: p.m - 1 })}>‹ {t.reports.prev}</Button>
            <p className="text-sm font-semibold tabular-nums">{ym.m}/{ym.y}</p>
            <Button size="sm" variant="ghost" onPress={() => setYm((p) => p.m === 12 ? { y: p.y + 1, m: 1 } : { y: p.y, m: p.m + 1 })}>{t.reports.next} ›</Button>
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
                <Tooltip key={date} delay={200}>
                  <Tooltip.Trigger className="contents">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => cycleDay(date)}
                      aria-label={`${dayLabel(date)}: ${statusLabel}`}
                      aria-live="polite"
                      className={`flex aspect-square cursor-pointer items-center justify-center rounded-lg text-[11px] tabular-nums transition ${!active ? "text-muted/40" : l?.status === "done" ? "font-semibold text-white" : l?.status === "missed" ? "bg-danger/15 text-danger" : "bg-default text-muted hover:text-foreground"} ${isToday ? "ring-2 ring-accent" : ""}`}
                      style={l?.status === "done" ? { backgroundColor: habit.color } : undefined}
                    >
                      {isSaving ? <Spinner size="sm" color="current" aria-label={t.reports.editDay} /> : Number(date.slice(8))}
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    <span className="flex items-center gap-1.5 text-xs tabular-nums">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${dotClass}`}
                        style={status === "done" ? { backgroundColor: habit.color } : undefined}
                      />
                      {dayLabel(date)} · {statusLabel}
                    </span>
                  </Tooltip.Content>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
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

      <Card className="rounded-2xl bg-surface">
        <Card.Content className="p-4">
          <p className="mb-3 text-sm font-semibold">{t.reports.global}</p>
          <div className="flex flex-col gap-2.5">
            {globalRates.map(({ habit: h, pct, done, total }) => (
              <div key={h.id}>
                <div className="mb-1 flex justify-between text-xs"><span className="truncate">{h.name}</span><span className="tabular-nums text-muted">{done}/{total} · {pct}%</span></div>
                <ProgressBar value={pct}>
                  <ProgressBar.Track>
                    <ProgressBar.Fill style={{ background: h.color, width: `${pct}%` }} />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
