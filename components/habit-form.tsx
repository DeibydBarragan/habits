"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
  Input,
  Label,
  Spinner,
  TextField,
} from "@heroui/react";
import { useLang } from "@/components/language";
import { IconPicker } from "@/components/icon-picker";
import { SearchableSelect } from "@/components/searchable-select";
import { PALETTE_12, type Habit, type HabitCategory, type HabitCounter } from "@/lib/types";
import { createHabit, updateHabit } from "@/actions/habits";
import { Check, Plus, Trash2 } from "lucide-react";

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const DAY_SHORT_ES = ["L", "M", "X", "J", "V", "S", "D"];
const DAY_SHORT_EN = ["M", "T", "W", "T", "F", "S", "S"];

export function HabitForm({
  categories,
  habits,
  initial,
  onDone,
}: {
  categories: HabitCategory[];
  habits: Habit[];
  initial?: Habit;
  onDone?: () => void;
}) {
  const { lang, t } = useLang();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [type, setType] = useState<"build" | "avoid">(initial?.type ?? "build");
  const [tracking, setTracking] = useState<"check" | "count">(initial?.tracking_mode ?? "check");
  const [counterMode, setCounterMode] = useState<"single" | "multi">(
    initial?.counters && initial.counters.length > 0 ? "multi" : "single"
  );
  const [counters, setCounters] = useState<HabitCounter[]>(
    initial?.counters && initial.counters.length > 0 ? initial.counters : []
  );
  const [catId, setCatId] = useState(initial?.category_id ?? categories[0]?.id ?? "");
  const [nextHabitId, setNextHabitId] = useState<string | null>(initial?.next_habit_id ?? null);
  const catColor = categories.find((c) => c.id === catId)?.color ?? PALETTE_12[7];
  const [color, setColor] = useState(initial?.color ?? catColor);
  const [colorTouched, setColorTouched] = useState(!!initial);
  const [days, setDays] = useState<number[]>(initial?.days_active ?? [1, 2, 3, 4, 5, 6, 7]);

  const shownColor = colorTouched ? color : catColor;
  const dayLabels = lang === "es" ? DAY_SHORT_ES : DAY_SHORT_EN;

  const categoryOptions = useMemo(() => {
    return categories.map((c) => ({
      id: c.id,
      label: c.name,
      color: c.color,
      icon: c.icon,
    }));
  }, [categories]);

  const nextHabitOptions = useMemo(() => {
    return habits
      .filter((h) => h.id !== initial?.id)
      .map((h) => {
        const c = categories.find((cat) => cat.id === h.category_id);
        return {
          id: h.id,
          label: h.name,
          sublabel: c?.name,
          color: h.color,
          icon: c?.icon,
        };
      });
  }, [habits, initial?.id, categories]);

  function handleAddCounter() {
    setCounters((prev) => [
      ...prev,
      {
        id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: "",
        target_count: 1,
        unit: "",
      },
    ]);
  }

  function handleRemoveCounter(id: string) {
    setCounters((prev) => prev.filter((c) => c.id !== id));
  }

  function handleUpdateCounter(id: string, updates: Partial<HabitCounter>) {
    setCounters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  function switchCounterMode(mode: "single" | "multi") {
    setCounterMode(mode);
    if (mode === "multi" && counters.length === 0) {
      setCounters([
        {
          id: `cnt_${Date.now()}_1`,
          name: "",
          target_count: 1,
          unit: "",
        },
        {
          id: `cnt_${Date.now()}_2`,
          name: "",
          target_count: 1,
          unit: "",
        },
      ]);
    }
  }

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function handle(fd: FormData) {
    fd.set("type", type);
    fd.set("category_id", catId);
    fd.set("next_habit_id", nextHabitId || "");
    fd.set("tracking_mode", tracking);
    fd.set("color", shownColor);
    fd.set("days_active", days.join(","));

    if (tracking === "count") {
      if (counterMode === "multi") {
        const validCounters = counters.filter((c) => c.name.trim().length > 0);
        if (validCounters.length === 0) {
          setError(t.errors.needTarget);
          return;
        }
        fd.set("counters", JSON.stringify(validCounters));
      } else {
        fd.set("counters", "[]");
      }
    } else {
      fd.set("counters", "[]");
    }

    startTransition(async () => {
      setError(undefined);
      const res = initial
        ? await updateHabit(initial.id, fd)
        : await createHabit(fd);
      if (res?.error) {
        setError(res.error === "cycle" ? t.errors.cycle : res.error === "needTarget" ? t.errors.needTarget : res.error === "needName" ? t.errors.needName : t.errors.saveFail);
      } else {
        onDone?.();
      }
    });
  }

  return (
    <form action={handle} className="flex flex-col gap-4">
      <TextField fullWidth isRequired name="name" defaultValue={initial?.name ?? ""}>
        <Label>{t.habit.name}</Label>
        <Input placeholder={type === "build" ? t.habit.namePhBuild : t.habit.namePhAvoid} spellCheck={false} />
      </TextField>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t.habit.type}</span>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.habit.type}>
          {(["build", "avoid"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={type === k}
              onClick={() => setType(k)}
              className={`rounded-2xl px-3 py-2 text-left transition ${type === k ? "border-accent bg-accent/10" : "bg-surface"}`}
            >
              <span className="block text-sm font-semibold">{k === "build" ? t.habit.build : t.habit.avoid}</span>
              <span className="block text-xs text-muted">{k === "build" ? t.habit.buildHint : t.habit.avoidHint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <SearchableSelect
          label={t.habit.category}
          placeholder={t.habit.choose}
          searchPlaceholder={t.habit.choose}
          options={categoryOptions}
          value={catId}
          onChange={(val) => {
            if (val) setCatId(val);
          }}
          allowClear={false}
        />
        <input type="hidden" name="category_id" value={catId} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t.habit.color}</span>
        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label={t.habit.color}>
          {PALETTE_12.map((c) => {
            const sel = shownColor.toUpperCase() === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={sel}
                aria-label={c}
                onClick={() => { setColor(c); setColorTouched(true); }}
                className={`flex h-9 items-center justify-center rounded-xl transition ${sel ? "ring-2 ring-offset-2 ring-accent" : "hover:scale-105"}`}
                style={{ backgroundColor: c + "40" }}
              >
                <span style={{ color: c }}>
                  {sel ? <Check size={16} strokeWidth={2.5} /> : <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c }} />}
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-xs text-muted">{t.habit.colorHint}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t.habit.days}</span>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={t.habit.days}>
          {DAYS.map((d, i) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d)}
                className={`h-9 rounded-xl text-sm font-semibold tabular-nums transition ${on ? "bg-accent text-accent-foreground" : "bg-default text-muted"}`}
              >
                {dayLabels[i]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t.habit.tracking}</span>
        <div className="grid grid-cols-2 gap-2">
          {(["check", "count"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={tracking === k}
              onClick={() => setTracking(k)}
              className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${tracking === k ? "border-accent bg-accent/10" : "bg-surface"}`}
            >
              {k === "check" ? t.habit.simple : t.habit.counter}
            </button>
          ))}
        </div>
      </div>

      {tracking === "count" && (
        <div className="flex flex-col gap-3 p-3 rounded-2xl bg-surface/50 border border-border/40">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">{t.habit.counterMode}</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={counterMode === "single"}
                onClick={() => switchCounterMode("single")}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${counterMode === "single" ? "border-accent bg-accent/15 text-accent font-semibold" : "bg-surface text-muted hover:text-foreground"}`}
              >
                {t.habit.singleCounter}
              </button>
              <button
                type="button"
                aria-pressed={counterMode === "multi"}
                onClick={() => switchCounterMode("multi")}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${counterMode === "multi" ? "border-accent bg-accent/15 text-accent font-semibold" : "bg-surface text-muted hover:text-foreground"}`}
              >
                {t.habit.multiCounter}
              </button>
            </div>
          </div>

          {counterMode === "single" ? (
            <div className="grid grid-cols-2 gap-3">
              <TextField fullWidth name="target_count" type="number" defaultValue={String(initial?.target_count ?? 8)}>
                <Label>{t.habit.target}</Label>
                <Input inputMode="numeric" min={1} />
              </TextField>
              <TextField fullWidth name="unit" defaultValue={initial?.unit ?? ""}>
                <Label>{t.habit.unit}</Label>
                <Input placeholder={t.habit.unitPh} spellCheck={false} />
              </TextField>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-2">
                {counters.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 bg-surface p-2 rounded-xl border border-border/30">
                    <input
                      type="text"
                      placeholder={t.habit.counterNamePh}
                      value={c.name}
                      onChange={(e) => handleUpdateCounter(c.id, { name: e.target.value })}
                      className="flex-1 min-w-0 text-xs h-8 rounded-lg bg-background/60 border border-border/40 px-2.5 outline-none focus:border-accent text-foreground"
                      spellCheck={false}
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder={t.habit.counterTarget}
                      value={c.target_count || ""}
                      onChange={(e) => handleUpdateCounter(c.id, { target_count: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-16 shrink-0 text-xs h-8 rounded-lg bg-background/60 border border-border/40 px-2 text-center outline-none focus:border-accent text-foreground tabular-nums"
                    />
                    <input
                      type="text"
                      placeholder={t.habit.counterUnit}
                      value={c.unit ?? ""}
                      onChange={(e) => handleUpdateCounter(c.id, { unit: e.target.value || null })}
                      className="w-20 shrink-0 text-xs h-8 rounded-lg bg-background/60 border border-border/40 px-2 outline-none focus:border-accent text-foreground"
                      spellCheck={false}
                    />
                    {counters.length > 1 && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={t.habit.removeCounter}
                        className="h-8 w-8 text-danger/70 hover:text-danger hover:bg-danger/10 shrink-0"
                        onPress={() => handleRemoveCounter(c.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="self-start text-xs h-8"
                onPress={handleAddCounter}
              >
                <Plus size={13} className="mr-1" />
                {t.habit.addCounter}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <SearchableSelect
          label={t.habit.next}
          placeholder={t.habit.none}
          emptyLabel={t.habit.none}
          searchPlaceholder={t.habit.next}
          options={nextHabitOptions}
          value={nextHabitId}
          onChange={(val) => setNextHabitId(val)}
          allowClear={true}
        />
        <input type="hidden" name="next_habit_id" value={nextHabitId || ""} />
      </div>

      {error && <p aria-live="polite" className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button variant="primary" type="submit" isDisabled={pending || days.length === 0}>
          {pending ? (
            <span className="flex items-center gap-2"><Spinner size="sm" color="current" />{t.habit.saving}</span>
          ) : initial ? t.habit.update : t.habit.create}
        </Button>
      </div>
    </form>
  );
}

export function CategoryQuickForm({ onDone }: { onDone?: () => void }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  function handle(fd: FormData) {
    startTransition(async () => {
      const { createCategory } = await import("@/actions/categories");
      const res = await createCategory(fd);
      if (res?.error) setError(res.error === "catExists" ? t.errors.catExists : t.errors.saveFail);
      else onDone?.();
    });
  }
  return (
    <form action={handle} className="flex flex-col gap-3">
      <TextField fullWidth isRequired name="name">
        <Label>{t.categories.name}</Label>
        <Input placeholder={t.categories.newPh} spellCheck={false} />
      </TextField>
      <IconPicker label={t.categories.icon} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button variant="primary" type="submit" isDisabled={pending}>
        {pending ? <span className="flex items-center gap-2"><Spinner size="sm" color="current" />{t.categories.saving}</span> : t.categories.add}
      </Button>
    </form>
  );
}
