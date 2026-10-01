"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card, ProgressBar, Select, ListBox, Spinner } from "@heroui/react";
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
  const { t } = useLang();
  const [sel, setSel] = useState<string>(habits[0]?.id ?? "");
  const [view, setView] = useState<"bar" | "pie">("bar");
  const [pending, startTransition] = useTransition();
  const now = new Date(today + "T12:00:00");
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  const habit = habits.find((h) => h.id === sel);
  const habitLogs = useMemo(() => logs.filter((l) => l.habit_id === sel), [logs, sel]);

  // tasa 30 días (solo días activos)
  const rate = useMemo(() => {
    if (!habit) return { done: 0, total: 0, pct: 0, avg: 0 };
    let done = 0, total = 0, sum = 0, n = 0;
    const map = new Map(habitLogs.map((l) => [l.date, l]));
    for (let i = 0; i < 30; i++) {
      const d = new Date(today + "T12:00:00");
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const js = d.getDay();
      const isoW = js === 0 ? 7 : js;
      if (!habit.days_active.includes(isoW)) continue;
      total++;
      const l = map.get(iso);
      if (l?.status === "done") {
        done++;
        if (l.count != null) { sum += l.count; n++; }
      }
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0, avg: n ? sum / n : 0 };
  }, [habit, habitLogs, today]);

  // global: barras por hábito
  const globalRates = useMemo(() => {
    return habits.map((h) => {
      const map = new Map(logs.filter((l) => l.habit_id === h.id).map((l) => [l.date, l]));
      let done = 0, total = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(today + "T12:00:00");
        d.setDate(d.getDate() - i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const js = d.getDay();
        const isoW = js === 0 ? 7 : js;
        if (!h.days_active.includes(isoW)) continue;
        total++;
        if (map.get(iso)?.status === "done") done++;
      }
      return { habit: h, pct: total ? Math.round((done / total) * 100) : 0 };
    });
  }, [habits, logs, today]);

  const cells = monthGrid(ym.y, ym.m);
  const logMap = useMemo(() => new Map(habitLogs.map((l) => [l.date, l])), [habitLogs]);

  function cycleDay(date: string) {
    if (!habit) return;
    const cur = logMap.get(date)?.status;
    startTransition(async () => {
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
    });
  }

  if (!habit) {
    return (
      <Card><Card.Content className="p-8 text-center">
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

      <Card>
        <Card.Content className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{habit.name}</p>
            {streaks[habit.id] && <StreakBadge streak={streaks[habit.id]} kind={habit.type} />}
          </div>
          <p className="mt-2 text-xs text-muted tabular-nums">{t.reports.rate30}: {rate.done}/{rate.total} · {rate.pct}%{habit.tracking_mode === "count" && rate.avg ? ` · ${t.reports.avg} ${rate.avg.toFixed(1)}` : ""}</p>
          {view === "bar" ? (
            <ProgressBar value={rate.pct} className="mt-3">
              <ProgressBar.Fill style={{ background: habit.color, width: `${rate.pct}%` }} />
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

      <Card>
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
              const active = habit.days_active.includes(new Date(date + "T12:00:00").getDay() === 0 ? 7 : new Date(date + "T12:00:00").getDay());
              const isToday = date === today;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={pending}
                  onClick={() => cycleDay(date)}
                  title={`${date} · ${l?.status ?? t.reports.clear}`}
                  aria-label={`${date} ${l?.status ?? t.reports.clear}`}
                  className={`flex aspect-square items-center justify-center rounded-lg text-[11px] tabular-nums transition ${!active ? "text-muted/40" : l?.status === "done" ? "font-semibold text-white" : l?.status === "missed" ? "bg-danger/15 text-danger" : "bg-default text-muted hover:text-foreground"} ${isToday ? "ring-2 ring-accent" : ""}`}
                  style={l?.status === "done" ? { backgroundColor: habit.color } : undefined}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">{t.reports.editDay}: ✓ → ✕ → {t.reports.clear}</p>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-4">
          <p className="mb-3 text-sm font-semibold">{t.reports.global}</p>
          <div className="flex flex-col gap-2.5">
            {globalRates.map(({ habit: h, pct }) => (
              <div key={h.id}>
                <div className="mb-1 flex justify-between text-xs"><span className="truncate">{h.name}</span><span className="tabular-nums text-muted">{pct}%</span></div>
                <ProgressBar value={pct}>
                  <ProgressBar.Fill style={{ background: h.color, width: `${pct}%` }} />
                </ProgressBar>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
