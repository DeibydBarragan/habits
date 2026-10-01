"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Card, Modal, ProgressBar, Spinner, toast, useOverlayState } from "@heroui/react";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useLang } from "@/components/language";
import { CategoryIcon } from "@/components/category-icon";
import type { Habit, HabitCategory, HabitLog } from "@/lib/types";
import { saveLog, bumpCount, clearLog } from "@/actions/logs";

type Props = {
  habits: Habit[];
  categories: HabitCategory[];
  logsByHabit: Map<string, Map<string, HabitLog>>;
  today: string;
  startId?: string | null;
};

export function TodayRunner({ habits, categories, logsByHabit, today, startId }: Props) {
  const { t } = useLang();
  const router = useRouter();
  const state = useOverlayState();
  const [queue, setQueue] = useState<string[]>([]);
  const visitedRef = useRef<string[]>([]);
  const queueRef = useRef<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [direction, setDirection] = useState<number>(0);

  const byId = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);

  const openChain = useCallback((firstId: string) => {
    visitedRef.current = [];
    queueRef.current = [firstId];
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
    visitedRef.current = [...visitedRef.current, from.id];
    const nextId = from.next_habit_id;
    if (nextId && byId.has(nextId) && !visitedRef.current.includes(nextId) && visitedRef.current.length < 20) {
      const nextLog = logsByHabit.get(nextId)?.get(today);
      if (!nextLog) {
        queueRef.current = [nextId];
        setQueue([nextId]);
        return;
      }
    }
    const rest = queueRef.current.slice(1);
    queueRef.current = rest;
    if (rest.length) setQueue(rest);
    else {
      setQueue([]);
      state.close();
    }
    router.refresh();
  }

  function mark(status: "done" | "missed", count?: number) {
    if (!current) return;
    const target = current;
    const value = target.tracking_mode === "count" ? (count ?? localCount) : undefined;

    // Set direction based on status for animation
    setDirection(status === "done" ? 1 : -1);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("date", today);
      fd.set("status", status);
      if (value !== undefined) fd.set("count", String(value));
      await saveLog(target.id, fd);
      toast.success(t.toasts.logSaved);
      advance(target);
    });
  }

  function unmark(habitId: string) {
    startTransition(async () => {
      await clearLog(habitId, today);
      router.refresh();
    });
  }

  function bump(d: number) {
    if (!current) return;
    const next = Math.max(0, localCount + d);
    setLocalCount(next);
    startTransition(async () => {
      await bumpCount(current.id, today, d);
      router.refresh();
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
          const pct = Math.min(100, ((log?.count ?? 0) / (h.target_count ?? 1)) * 100);
          return (
            <Card key={h.id}>
              <Card.Content className="p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: h.color + "40", color: h.color }}>
                    <CategoryIcon icon={c?.icon ?? "other"} size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{h.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs tabular-nums" aria-live="polite">
                      {log?.status === "done" ? (
                        <span className="inline-flex items-center gap-1 font-medium text-success">
                          <Check size={13} strokeWidth={2.5} />
                          {h.tracking_mode === "count"
                            ? `${log.count ?? 0} ${t.habit.of} ${h.target_count} ${h.unit ?? ""}`
                            : h.type === "avoid" ? t.habit.clean : t.today.done}
                        </span>
                      ) : log?.status === "missed" ? (
                        <span className="inline-flex items-center gap-1 font-medium text-danger">
                          <X size={13} strokeWidth={2.5} />
                          {h.type === "avoid" ? t.habit.relapsed : t.today.missed}
                        </span>
                      ) : (
                        <span className="text-muted">
                          {h.tracking_mode === "count"
                            ? `0 ${t.habit.of} ${h.target_count} ${h.unit ?? ""}`
                            : t.habit.pendingToday}
                        </span>
                      )}
                    </p>
                  </div>
                  {log && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={t.reports.clear}
                      onPress={() => unmark(h.id)}
                      isDisabled={pending}
                    >
                      <RotateCcw size={15} />
                    </Button>
                  )}
                  <Button size="sm" variant={log ? "secondary" : "primary"} onPress={() => openChain(h.id)}>
                    {t.today.open}
                  </Button>
                </div>
                {h.tracking_mode === "count" && (
                  <ProgressBar value={pct} className="mt-3">
                    <ProgressBar.Track>
                      <ProgressBar.Fill style={{ background: h.color, width: `${pct}%` }} />
                    </ProgressBar.Track>
                  </ProgressBar>
                )}
              </Card.Content>
            </Card>
          );
        })}
      </div>

      <Modal state={state}>
        <Modal.Backdrop className="bg-background/60 backdrop-blur-sm">
          <Modal.Container placement="center">
            <Modal.Dialog>
              {({ close }) => current ? (
              <div className="flex flex-col gap-4" key={current.id}>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>{current.name}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    <motion.div
                      key={current.id}
                      custom={direction}
                      variants={{
                        enter: (dir: number) => ({
                          x: dir > 0 ? -100 : 100,
                          opacity: 0,
                          scale: 0.95
                        }),
                        center: {
                          x: 0,
                          opacity: 1,
                          scale: 1
                        },
                        exit: (dir: number) => ({
                          x: dir > 0 ? 100 : -100,
                          opacity: 0,
                          scale: 0.95
                        })
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{
                        x: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 }
                      }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.6}
                      onDragEnd={(_, info) => {
                        if (info.offset.x > 120) mark("done", current.tracking_mode === "count" ? localCount : undefined);
                        else if (info.offset.x < -120) mark("missed", current.tracking_mode === "count" ? localCount : undefined);
                      }}
                      className="flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center"
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
                  </AnimatePresence>
                  {current.next_habit_id && byId.has(current.next_habit_id) ? (
                    <p className="mt-4 text-xs text-muted">{t.flash.nextUp}: {byId.get(current.next_habit_id)?.name}</p>
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
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
