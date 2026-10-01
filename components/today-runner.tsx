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

  function markList(target: Habit, status: "done" | "missed", log?: HabitLog) {
    const value = target.tracking_mode === "count" ? (status === "done" ? (target.target_count ?? 1) : (log?.count ?? 0)) : undefined;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("date", today);
      fd.set("status", status);
      if (value !== undefined) fd.set("count", String(value));
      await saveLog(target.id, fd);
      toast.success(t.toasts.logSaved);
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
            <div key={h.id} className="rounded-2xl bg-surface relative group overflow-hidden border border-transparent dark:border-border/10 cursor-pointer transition-colors hover:border-border/40" onClick={() => openChain(h.id)}>
              <Card.Content className="p-4 relative z-10 pointer-events-none">
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
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-success hover:bg-success/10"
                      aria-label={t.habit.completeGoal}
                      onPress={() => markList(h, "done", log)}
                      isDisabled={pending}
                    >
                      <Check size={16} strokeWidth={2.5} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger/10"
                      aria-label={t.habit.failed}
                      onPress={() => markList(h, "missed", log)}
                      isDisabled={pending}
                    >
                      <X size={16} strokeWidth={2.5} />
                    </Button>
                    {log && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t.reports.clear}
                        onPress={() => unmark(h.id)}
                        isDisabled={pending}
                      >
                        <RotateCcw size={15} />
                      </Button>
                    )}
                  </div>
                </div>
                {h.tracking_mode === "count" && (
                  <ProgressBar value={pct} className="mt-3">
                    <ProgressBar.Track>
                      <ProgressBar.Fill style={{ background: h.color, width: `${pct}%` }} />
                    </ProgressBar.Track>
                  </ProgressBar>
                )}
              </Card.Content>
            </div>
          );
        })}
      </div>

      <Modal state={state}>
        <Modal.Backdrop className="bg-background/40 backdrop-blur-md">
          <Modal.Container placement="center">
            <Modal.Dialog className="bg-transparent  max-w-sm w-full mx-auto p-0">
              {({ close }) => current ? (
              <div className="flex flex-col gap-4 items-center w-full relative">
                <div className="absolute right-0 top-0 -translate-y-full pb-2 z-50">
                  <Modal.CloseTrigger />
                </div>

                <div className="w-full relative overflow-visible" style={{ perspective: 1000 }}>
                  {/* Precargar tarjeta siguiente detrás */}
                  {current.next_habit_id && byId.has(current.next_habit_id) && (
                    <div className="absolute inset-0 w-full z-0 pointer-events-none opacity-50 scale-95 origin-bottom translate-y-4">
                      <SwipeCardStatic
                        habit={byId.get(current.next_habit_id)!}
                        cat={categories.find((c) => c.id === byId.get(current.next_habit_id!)?.category_id)}
                      />
                    </div>
                  )}

                  <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    <motion.div
                      key={current.id}
                      custom={direction}
                      variants={{
                        enter: (dir: number) => ({
                          x: dir > 0 ? -200 : 200,
                          opacity: 0,
                          scale: 0.8,
                          rotate: dir > 0 ? -15 : 15,
                          y: 20
                        }),
                        center: {
                          x: 0,
                          opacity: 1,
                          scale: 1,
                          rotate: 0,
                          y: 0,
                          transition: { type: "spring", stiffness: 300, damping: 25 }
                        },
                        exit: (dir: number) => ({
                          x: dir > 0 ? 200 : -200,
                          opacity: 0,
                          scale: 0.9,
                          rotate: dir > 0 ? 15 : -15,
                          transition: { duration: 0.25, ease: "easeOut" }
                        })
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="w-full relative z-10"
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
                  <p className="mt-4 text-xs text-muted text-center bg-background/50 backdrop-blur rounded-full px-3 py-1 opacity-0 pointer-events-none">{t.flash.nextUp}: {byId.get(current.next_habit_id)?.name}</p>
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
  const [hoverDir, setHoverDir] = useState<"left" | "right" | null>(null);

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
      className="relative flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center  touch-none"
    >
      <div className="absolute inset-y-0 left-0 w-[20%] z-20 cursor-w-resize" onPointerEnter={() => setHoverDir("left")} onPointerLeave={() => setHoverDir(null)} onClick={() => onSwipeLeft()} />
      <div className="absolute inset-y-0 right-0 w-[20%] z-20 cursor-e-resize" onPointerEnter={() => setHoverDir("right")} onPointerLeave={() => setHoverDir(null)} onClick={() => onSwipeRight()} />

      <motion.div style={{ opacity: hoverDir === "right" ? 1 : opacityRight }} className="absolute right-4 top-4 rounded-lg border-2 border-success px-2 py-1 text-xs font-bold uppercase text-success rotate-12 bg-success/10 z-10 pointer-events-none transition-opacity">
        {current.type === "avoid" ? t.habit.clean : current.tracking_mode === "count" ? t.habit.completeGoal : t.habit.didIt}
      </motion.div>
      <motion.div style={{ opacity: hoverDir === "left" ? 1 : opacityLeft }} className="absolute left-4 top-4 rounded-lg border-2 border-danger px-2 py-1 text-xs font-bold uppercase text-danger -rotate-12 bg-danger/10 z-10 pointer-events-none transition-opacity">
        {current.type === "avoid" ? t.habit.relapsed : t.habit.failed}
      </motion.div>

      <span className="flex h-16 w-16 items-center justify-center rounded-2xl relative z-10" style={{ backgroundColor: current.color + "40", color: current.color }}>
        <CategoryIcon icon={cat?.icon ?? "other"} size={30} />
      </span>
      <p className="text-lg font-semibold text-balance relative z-10">{current.name}</p>
      {current.tracking_mode === "count" ? (
        <div className="flex items-center gap-3 relative z-30" aria-live="polite">
          <Button isIconOnly variant="secondary" aria-label="-1" onPress={() => bump(-1)}><Minus size={18} /></Button>
          <span className="min-w-24 text-2xl font-semibold tabular-nums">{localCount} <span className="text-sm font-normal text-muted">/ {current.target_count} {current.unit ?? ""}</span></span>
          <Button isIconOnly variant="secondary" aria-label="+1" onPress={() => bump(1)}><Plus size={18} /></Button>
        </div>
      ) : (
        <p className="text-sm text-muted relative z-10">{current.type === "avoid" ? t.habit.avoidHint : t.habit.buildHint}</p>
      )}
      {pending && <Spinner size="sm" color="current" className="relative z-10" />}
    </motion.div>
  );
}

function SwipeCardStatic({ habit, cat }: { habit: Habit; cat?: HabitCategory }) {
  const { t } = useLang();
  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center ">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: habit.color + "40", color: habit.color }}>
        <CategoryIcon icon={cat?.icon ?? "other"} size={30} />
      </span>
      <p className="text-lg font-semibold text-balance">{habit.name}</p>
      {habit.tracking_mode === "count" ? (
        <div className="flex items-center gap-3" aria-hidden>
          <Button isIconOnly variant="secondary" isDisabled><Minus size={18} /></Button>
          <span className="min-w-24 text-2xl font-semibold tabular-nums text-muted">0 <span className="text-sm font-normal">/ {habit.target_count} {habit.unit ?? ""}</span></span>
          <Button isIconOnly variant="secondary" isDisabled><Plus size={18} /></Button>
        </div>
      ) : (
        <p className="text-sm text-muted">{habit.type === "avoid" ? t.habit.avoidHint : t.habit.buildHint}</p>
      )}
    </div>
  );
}
