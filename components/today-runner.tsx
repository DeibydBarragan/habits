"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
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
      if (e.key === "ArrowRight") {
        if (cur.tracking_mode === "count" && localCount < (cur.target_count ?? 1)) {
          mark("done", cur.target_count ?? localCount);
        } else {
          mark("done", cur.tracking_mode === "count" ? localCount : undefined);
        }
      }
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
            <Card key={h.id} className="rounded-2xl border-none bg-surface">
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
            <Modal.Dialog className="bg-transparent shadow-none border-none max-w-sm w-full mx-auto p-0">
              {({ close }) => current ? (
              <div className="flex flex-col gap-4 items-center w-full relative">
                <div className="absolute right-0 top-0 -translate-y-full pb-2 z-50">
                  <Modal.CloseTrigger />
                </div>

                <div className="w-full relative overflow-visible">
                  <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    <motion.div
                      key={current.id}
                      custom={direction}
                      variants={{
                        enter: (dir: number) => ({
                          x: dir > 0 ? -100 : 100,
                          opacity: 0,
                          scale: 0.95,
                          rotate: dir > 0 ? -10 : 10
                        }),
                        center: {
                          x: 0,
                          opacity: 1,
                          scale: 1,
                          rotate: 0
                        },
                        exit: (dir: number) => ({
                          x: dir > 0 ? 100 : -100,
                          opacity: 0,
                          scale: 0.95,
                          rotate: dir > 0 ? 10 : -10
                        })
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{
                        x: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 },
                        rotate: { type: "spring", stiffness: 300, damping: 30 }
                      }}
                      className="w-full"
                    >
                      <SwipeCard
                        current={current}
                        cat={cat}
                        localCount={localCount}
                        bump={bump}
                        pending={pending}
                        onSwipeRight={() => {
                          if (current.tracking_mode === "count" && localCount < (current.target_count ?? 1)) {
                            mark("done", current.target_count ?? localCount);
                          } else {
                            mark("done", current.tracking_mode === "count" ? localCount : undefined);
                          }
                        }}
                        onSwipeLeft={() => mark("missed", current.tracking_mode === "count" ? localCount : undefined)}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {current.next_habit_id && byId.has(current.next_habit_id) ? (
                  <p className="mt-2 text-xs text-muted text-center bg-background/50 backdrop-blur rounded-full px-3 py-1">{t.flash.nextUp}: {byId.get(current.next_habit_id)?.name}</p>
                ) : null}
              </div>
            ) : null}
          </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

function SwipeCard({ current, cat, localCount, bump, pending, onSwipeLeft, onSwipeRight }: {
  current: Habit;
  cat?: HabitCategory;
  localCount: number;
  bump: (d: number) => void;
  pending: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const { t } = useLang();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacityLeft = useTransform(x, [-100, -20], [1, 0]);
  const opacityRight = useTransform(x, [20, 100], [0, 1]);

  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) onSwipeRight();
        else if (info.offset.x < -120) onSwipeLeft();
      }}
      className="relative flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-lg"
    >
      <motion.div style={{ opacity: opacityRight }} className="absolute right-4 top-4 rounded-lg border-2 border-success px-2 py-1 text-xs font-bold uppercase text-success rotate-12 bg-success/10 z-10">
        {current.type === "avoid" ? t.habit.clean : current.tracking_mode === "count" ? t.habit.completeGoal : t.habit.didIt}
      </motion.div>
      <motion.div style={{ opacity: opacityLeft }} className="absolute left-4 top-4 rounded-lg border-2 border-danger px-2 py-1 text-xs font-bold uppercase text-danger -rotate-12 bg-danger/10 z-10">
        {current.type === "avoid" ? t.habit.relapsed : t.habit.failed}
      </motion.div>

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
  );
}
