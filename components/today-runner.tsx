"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Button, Card, Modal, ProgressBar, Spinner, useOverlayState } from "@heroui/react";
import { ArrowLeft, ArrowRight, Check, Flame, Minus, Plus, X } from "lucide-react";
import { useLang } from "@/components/language";
import { CategoryIcon } from "@/components/category-icon";
import type { Habit, HabitCategory, HabitLog } from "@/lib/types";
import { saveLog, bumpCount } from "@/actions/logs";

type Props = {
  habits: Habit[];
  categories: HabitCategory[];
  logsByHabit: Map<string, Map<string, HabitLog>>;
  today: string;
  startId?: string | null;
};

export function TodayRunner({ habits, categories, logsByHabit, today, startId }: Props) {
  const { t } = useLang();
  const state = useOverlayState();
  const [queue, setQueue] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);

  const openChain = useCallback((firstId: string) => {
    setVisited([]);
    setQueue([firstId]);
    state.open();
  }, [state]);

  useEffect(() => {
    if (startId) openChain(startId);
    // solo al montar con ?abrir=
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentId = queue[0];
  const current = currentId ? byId.get(currentId) : undefined;
  const cat = current ? categories.find((c) => c.id === current.category_id) : undefined;
  const prevLog = current ? logsByHabit.get(current.id)?.get(today) : undefined;
  const [localCount, setLocalCount] = useState<number>(0);

  useEffect(() => {
    setLocalCount(prevLog?.count ?? 0);
  }, [currentId, prevLog?.count]);

  function advance(from: Habit) {
    const nextId = from.next_habit_id;
    setVisited((v) => [...v, from.id]);
    if (nextId && byId.has(nextId) && !visited.includes(nextId) && visited.length < 20) {
      const nextLog = logsByHabit.get(nextId)?.get(today);
      if (!nextLog) {
        setQueue([nextId]);
        return;
      }
    }
    // cerrar o siguiente pendiente de la lista general
    const rest = queue.slice(1);
    if (rest.length) setQueue(rest);
    else {
      setQueue([]);
      state.close();
    }
  }

  function mark(status: "done" | "missed", count?: number) {
    if (!current) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("date", today);
      fd.set("status", status);
      if (current.tracking_mode === "count") fd.set("count", String(count ?? localCount));
      await saveLog(current.id, fd);
      advance(current);
    });
  }

  function bump(d: number) {
    if (!current) return;
    const next = Math.max(0, localCount + d);
    setLocalCount(next);
    startTransition(async () => {
      await bumpCount(current.id, today, d);
    });
  }

  // teclado ← → y +/- para contador
  useEffect(() => {
    if (!state.isOpen || !current) return;
    const cur: Habit = current;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") mark("done", cur.tracking_mode === "count" ? localCount : undefined);
      else if (e.key === "ArrowLeft") mark("missed", cur.tracking_mode === "count" ? localCount : undefined);
      else if (cur.tracking_mode === "count" && e.key === "ArrowUp") bump(1);
      else if (cur.tracking_mode === "count" && e.key === "ArrowDown") bump(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className="flex flex-col gap-2">
        {habits.map((h) => {
          const log = logsByHabit.get(h.id)?.get(today);
          const c = categories.find((x) => x.id === h.category_id);
          return (
            <Card key={h.id}>
              <Card.Content className="p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: h.color + "40", color: h.color }}>
                    <CategoryIcon icon={c?.icon ?? "other"} size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{h.name}</p>
                    <p className="text-xs text-muted tabular-nums">
                      {h.tracking_mode === "count"
                        ? `${log?.count ?? 0} ${t.habit.of} ${h.target_count} ${h.unit ?? ""}`
                        : log?.status === "done" ? t.today.done : log?.status === "missed" ? t.today.missed : t.habit.pendingToday}
                    </p>
                  </div>
                  <Button size="sm" variant={log ? "secondary" : "primary"} onPress={() => openChain(h.id)}>
                    {t.today.open}
                  </Button>
                </div>
                {h.tracking_mode === "count" && (
                  <ProgressBar value={Math.min(100, ((log?.count ?? 0) / (h.target_count ?? 1)) * 100)} className="mt-3">
                    <ProgressBar.Fill style={{ background: h.color, width: `${Math.min(100, ((log?.count ?? 0) / (h.target_count ?? 1)) * 100)}%` }} />
                  </ProgressBar>
                )}
              </Card.Content>
            </Card>
          );
        })}
      </div>

      <Modal state={state}>
        <Modal.Backdrop />
        <Modal.Container placement="center">
          <Modal.Dialog>
            {({ close }) => current ? (
              <div className="flex flex-col gap-4">
                <Modal.Header>
                  <Modal.Heading>{current.name}</Modal.Heading>
                  <Modal.CloseTrigger />
                </Modal.Header>
                <Modal.Body>
                  <p className="text-xs text-muted">{t.flash.swipeHint}</p>
                  <motion.div
                    key={current.id}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.6}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 120) mark("done", current.tracking_mode === "count" ? localCount : undefined);
                      else if (info.offset.x < -120) mark("missed", current.tracking_mode === "count" ? localCount : undefined);
                    }}
                    className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: current.color + "40", color: current.color }}>
                      <CategoryIcon icon={cat?.icon ?? "other"} size={30} />
                    </span>
                    <p className="text-lg font-semibold text-balance">{current.name}</p>
                    {current.tracking_mode === "count" ? (
                      <div className="flex items-center gap-3" aria-live="polite">
                        <Button isIconOnly variant="secondary" aria-label="-1" onPress={() => bump(-1)}><Minus size={18} /></Button>
                        <span className="min-w-24 text-2xl font-semibold tabular-nums">{localCount} <span className="text-sm font-normal text-muted">/ {current.target_count} {current.unit ?? ""}</span></span>
                        <Button isIconOnly variant="secondary" aria-label="+1" onPress={() => bump(1)}><Plus size={18} /></Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">{current.type === "avoid" ? t.habit.avoidHint : t.habit.buildHint}</p>
                    )}
                    {pending && <Spinner size="sm" color="current" />}
                  </motion.div>
                  {current.next_habit_id && byId.has(current.next_habit_id) ? (
                    <p className="text-xs text-muted">{t.flash.nextUp}: {byId.get(current.next_habit_id)?.name}</p>
                  ) : null}
                </Modal.Body>
                <Modal.Footer>
                  <div className="grid w-full grid-cols-2 gap-2">
                    <Button variant="danger-soft" isDisabled={pending} onPress={() => mark("missed", current.tracking_mode === "count" ? localCount : undefined)}>
                      <span className="flex items-center gap-1.5"><ArrowLeft size={16} />{current.type === "avoid" ? t.habit.relapsed : t.habit.failed}</span>
                    </Button>
                    <Button variant="primary" isDisabled={pending} onPress={() => {
                      if (current.tracking_mode === "count" && localCount < (current.target_count ?? 1)) {
                        mark("done", current.target_count ?? localCount);
                      } else mark("done", current.tracking_mode === "count" ? localCount : undefined);
                    }}>
                      <span className="flex items-center gap-1.5">{current.type === "avoid" ? t.habit.clean : current.tracking_mode === "count" ? t.habit.completeGoal : t.habit.didIt}<ArrowRight size={16} /></span>
                    </Button>
                  </div>
                </Modal.Footer>
              </div>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </>
  );
}
