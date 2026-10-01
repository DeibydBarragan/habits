"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextField,
} from "@heroui/react";
import { useLang } from "@/components/language";
import { IconPicker } from "@/components/icon-picker";
import { PALETTE_12, type Habit, type HabitCategory } from "@/lib/types";
import { createHabit, updateHabit } from "@/actions/habits";
import { Check } from "lucide-react";

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
  const [catId, setCatId] = useState(initial?.category_id ?? categories[0]?.id ?? "");
  const catColor = categories.find((c) => c.id === catId)?.color ?? PALETTE_12[7];
  const [color, setColor] = useState(initial?.color ?? catColor);
  const [colorTouched, setColorTouched] = useState(!!initial);
  const [days, setDays] = useState<number[]>(initial?.days_active ?? [1, 2, 3, 4, 5, 6, 7]);

  const shownColor = colorTouched ? color : catColor;
  const dayLabels = lang === "es" ? DAY_SHORT_ES : DAY_SHORT_EN;

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function handle(fd: FormData) {
    fd.set("type", type);
    fd.set("tracking_mode", tracking);
    fd.set("color", shownColor);
    fd.set("days_active", days.join(","));
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
              className={`rounded-xl border px-3 py-2 text-left transition ${type === k ? "border-accent bg-accent/10" : "border-border bg-surface"}`}
            >
              <span className="block text-sm font-semibold">{k === "build" ? t.habit.build : t.habit.avoid}</span>
              <span className="block text-xs text-muted">{k === "build" ? t.habit.buildHint : t.habit.avoidHint}</span>
            </button>
          ))}
        </div>
      </div>

      <Select fullWidth isRequired name="category_id" defaultValue={catId} placeholder={t.habit.choose} onSelectionChange={(k) => { const id = String(k); setCatId(id); }}>
        <Label>{t.habit.category}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {categories.map((c) => (
              <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                {c.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

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
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${tracking === k ? "border-accent bg-accent/10" : "border-border bg-surface"}`}
            >
              {k === "check" ? t.habit.simple : t.habit.counter}
            </button>
          ))}
        </div>
      </div>

      {tracking === "count" && (
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
      )}

      <Select fullWidth name="next_habit_id" defaultValue={initial?.next_habit_id ?? ""} placeholder={t.habit.none}>
        <Label>{t.habit.next}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="" textValue={t.habit.none}>{t.habit.none}</ListBox.Item>
            {habits.filter((h) => h.id !== initial?.id).map((h) => (
              <ListBox.Item key={h.id} id={h.id} textValue={h.name}>
                {h.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

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
