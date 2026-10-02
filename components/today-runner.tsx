"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Button, Card, Modal, ProgressBar, Spinner, toast, useOverlayState } from "@heroui/react";
import { ArrowRight, Check, LayoutList, Minus, Plus, RotateCcw, Workflow, X } from "lucide-react";
import { useLang } from "@/components/language";
import { CategoryIcon } from "@/components/category-icon";
import { TodayChainView } from "@/components/today-chain-view";
import { AppTooltip } from "@/components/app-tooltip";
import type { Habit, HabitCategory, HabitLog } from "@/lib/types";
import { saveLog, bumpCount, clearLog } from "@/actions/logs";

type Props = {
  habits: Habit[];
  allHabits?: Habit[];
  categories: HabitCategory[];
  logsByHabit: Map<string, Map<string, HabitLog>>;
  today: string;
  startId?: string | null;
};

export function getEffectiveNextActiveHabit(
  habit: Habit,
  activeHabitIds: Set<string>,
  allById: Map<string, Habit>
): Habit | undefined {
  let curr = habit;
  const seen = new Set<string>([habit.id]);

  while (curr.next_habit_id && allById.has(curr.next_habit_id)) {
    const nextId = curr.next_habit_id;
    if (seen.has(nextId)) break;
    seen.add(nextId);

    if (activeHabitIds.has(nextId)) {
      return allById.get(nextId);
    }
    curr = allById.get(nextId)!;
  }

  return undefined;
}

function getSavedViewMode(): "list" | "chain" {
  if (typeof window === "undefined") return "list";
  try {
    const saved = localStorage.getItem("today_view_mode");
    return saved === "chain" ? "chain" : "list";
  } catch {
    return "list";
  }
}

function subscribeToViewMode(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function TodayRunner({ habits, allHabits, categories, logsByHabit, today, startId }: Props) {
  const { t } = useLang();
  const router = useRouter();
  const state = useOverlayState({ defaultOpen: !!startId });
  const [queue, setQueue] = useState<string[]>(() => (startId ? [startId] : []));
  const [visitedIds, setVisitedIds] = useState<string[]>(() => (startId ? [startId] : []));
  const [savingHabitIds, setSavingHabitIds] = useState<Set<string>>(new Set());
  const [optimisticLogs, setOptimisticLogs] = useState<Map<string, HabitLog | null>>(new Map());
  const [customCounts, setCustomCounts] = useState<Record<string, number>>({});
  const [customSubCounts, setCustomSubCounts] = useState<Record<string, Record<string, number>>>({});

  const storedMode = useSyncExternalStore(subscribeToViewMode, getSavedViewMode, () => "list");
  const [localMode, setLocalMode] = useState<"list" | "chain" | null>(null);
  const viewMode = localMode ?? storedMode;

  const changeViewMode = useCallback((mode: "list" | "chain") => {
    setLocalMode(mode);
    try {
      localStorage.setItem("today_view_mode", mode);
    } catch {
      // ignore
    }
  }, []);

  const savingHabitIdsRef = useRef(savingHabitIds);
  useEffect(() => {
    savingHabitIdsRef.current = savingHabitIds;
  }, [savingHabitIds]);

  // Clear optimistic entries once fresh server data arrives and habit is no longer actively saving
  useEffect(() => {
    setOptimisticLogs((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const id of Array.from(prev.keys())) {
        if (!savingHabitIdsRef.current.has(id)) {
          next.delete(id);
        }
      }
      return next;
    });
  }, [logsByHabit]);

  // Real-time drag tracking for preloaded 2-card stack emergence
  const bgDragX = useMotionValue(0);
  const bgScale1 = useTransform(bgDragX, [-240, 0, 240], [1, 0.95, 1]);
  const bgY1 = useTransform(bgDragX, [-240, 0, 240], [0, 10, 0]);
  const bgOpacity1 = useTransform(bgDragX, [-240, 0, 240], [1, 0.85, 1]);

  const bgScale2 = useTransform(bgDragX, [-240, 0, 240], [0.95, 0.90, 0.95]);
  const bgY2 = useTransform(bgDragX, [-240, 0, 240], [10, 20, 10]);
  const bgOpacity2 = useTransform(bgDragX, [-240, 0, 240], [0.85, 0.55, 0.85]);

  const fullHabitsList = allHabits ?? habits;
  const allById = useMemo(() => new Map(fullHabitsList.map((h) => [h.id, h])), [fullHabitsList]);
  const activeIds = useMemo(() => new Set(habits.map((h) => h.id)), [habits]);
  const byId = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);

  const openChain = useCallback((firstId: string) => {
    if (savingHabitIds.has(firstId)) return;
    bgDragX.set(0);
    setVisitedIds([firstId]);
    setQueue([firstId]);
    state.open();
  }, [state, bgDragX, savingHabitIds]);

  const currentId = queue[0];
  const current = currentId ? byId.get(currentId) : undefined;
  const cat = current ? categories.find((c) => c.id === current.category_id) : undefined;

  // Determine the next 2 habits for the stack (prioritize chained next_habit_id, then circular active list)
  const { nextHabit, nextNextHabit } = useMemo(() => {
    if (!current) return { nextHabit: undefined, nextNextHabit: undefined };

    const getNextAfter = (fromHabit: Habit, excludeIds: string[]): Habit | undefined => {
      // 1. Explicit chained next active habit (skipping any inactive habits in between)
      const nextActive = getEffectiveNextActiveHabit(fromHabit, activeIds, allById);
      if (nextActive && !excludeIds.includes(nextActive.id)) {
        return nextActive;
      }

      // 2. Otherwise, check next active habit in today's list
      const idx = habits.findIndex((h) => h.id === fromHabit.id);
      if (idx !== -1) {
        for (let i = idx + 1; i < habits.length; i++) {
          if (!excludeIds.includes(habits[i].id)) return habits[i];
        }
        for (let i = 0; i < idx; i++) {
          if (!excludeIds.includes(habits[i].id)) return habits[i];
        }
      }
      return undefined;
    };

    const next1 = getNextAfter(current, visitedIds);
    const next2 = next1 ? getNextAfter(next1, [...visitedIds, next1.id]) : undefined;

    return { nextHabit: next1, nextNextHabit: next2 };
  }, [current, visitedIds, habits, activeIds, allById]);

  const nextCat = nextHabit ? categories.find((c) => c.id === nextHabit.category_id) : undefined;
  const nextNextCat = nextNextHabit ? categories.find((c) => c.id === nextNextHabit.category_id) : undefined;

  const currentOptLog = current
    ? (optimisticLogs.has(current.id)
        ? optimisticLogs.get(current.id)
        : logsByHabit.get(current.id)?.get(today))
    : undefined;
  const baseCount = currentOptLog?.count ?? 0;
  const localCount = current && customCounts[current.id] !== undefined ? customCounts[current.id] : baseCount;

  // Non-blocking background save that updates individual habit spinner in "Today"
  const performSave = useCallback(async (
    habitId: string,
    status: "done" | "missed",
    count?: number,
    counts?: Record<string, number>
  ) => {
    setSavingHabitIds((prev) => new Set(prev).add(habitId));

    const targetHabit = byId.get(habitId);
    let effectiveCounts = counts;
    if (!effectiveCounts && targetHabit?.counters && targetHabit.counters.length > 0) {
      effectiveCounts = {};
      for (const c of targetHabit.counters) {
        effectiveCounts[c.id] = status === "done" ? c.target_count : 0;
      }
    }

    if (targetHabit) {
      setOptimisticLogs((prev) => {
        const next = new Map(prev);
        next.set(habitId, {
          id: prev.get(habitId)?.id ?? `opt-${habitId}-${Date.now()}`,
          user_id: targetHabit.user_id,
          habit_id: habitId,
          date: today,
          status,
          count: count ?? (targetHabit.tracking_mode === "count" ? (status === "done" ? (targetHabit.target_count ?? 1) : 0) : null),
          counts: effectiveCounts ?? {},
        });
        return next;
      });
    }

    try {
      const fd = new FormData();
      fd.set("date", today);
      fd.set("status", status);
      if (count !== undefined) fd.set("count", String(count));
      if (effectiveCounts) fd.set("counts", JSON.stringify(effectiveCounts));
      const res = await saveLog(habitId, fd);
      if (res?.error) {
        toast.danger(t.errors.saveFail);
        setOptimisticLogs((prev) => {
          const next = new Map(prev);
          next.delete(habitId);
          return next;
        });
      } else {
        router.refresh();
      }
    } catch {
      toast.danger(t.errors.saveFail);
      setOptimisticLogs((prev) => {
        const next = new Map(prev);
        next.delete(habitId);
        return next;
      });
    } finally {
      setSavingHabitIds((prev) => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  }, [byId, today, t, router]);

  // Coordinated fluid dismissal for the 3-card stack
  const handleStartDismiss = useCallback((status: "done" | "missed", count?: number) => {
    if (!current) return;
    performSave(current.id, status, count);
    const targetBg = status === "done" ? 240 : -240;
    animate(bgDragX, targetBg, {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1],
    });
  }, [current, performSave, bgDragX]);

  const handleDismissComplete = useCallback(() => {
    bgDragX.set(0);
    if (nextHabit) {
      setVisitedIds((prev) => [...prev, nextHabit.id]);
      setQueue([nextHabit.id]);
    } else {
      setQueue([]);
      state.close();
    }
  }, [nextHabit, state, bgDragX]);

  const unmark = useCallback(async (habitId: string) => {
    setSavingHabitIds((prev) => new Set(prev).add(habitId));
    setOptimisticLogs((prev) => {
      const next = new Map(prev);
      next.set(habitId, null);
      return next;
    });
    setCustomCounts((prev) => {
      const next = { ...prev };
      delete next[habitId];
      return next;
    });
    setCustomSubCounts((prev) => {
      const next = { ...prev };
      delete next[habitId];
      return next;
    });
    try {
      await clearLog(habitId, today);
      router.refresh();
    } catch {
      toast.danger(t.errors.saveFail);
      setOptimisticLogs((prev) => {
        const next = new Map(prev);
        next.delete(habitId);
        return next;
      });
    } finally {
      setSavingHabitIds((prev) => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  }, [today, router, t]);

  const bumpHabit = useCallback(async (target: Habit, d: number, counterId?: string) => {
    const currentOpt = optimisticLogs.has(target.id)
      ? optimisticLogs.get(target.id)
      : logsByHabit.get(target.id)?.get(today);

    let nextCount: number;
    let nextSubCounts: Record<string, number> = { ...(currentOpt?.counts ?? customSubCounts[target.id] ?? {}) };

    if (counterId) {
      const prevSub = nextSubCounts[counterId] ?? 0;
      nextSubCounts[counterId] = Math.max(0, prevSub + d);
      nextCount = Object.values(nextSubCounts).reduce((a, b) => a + (Number(b) || 0), 0);
      setCustomSubCounts((prev) => ({ ...prev, [target.id]: nextSubCounts }));
    } else {
      const prevCount = customCounts[target.id] !== undefined ? customCounts[target.id] : (currentOpt?.count ?? 0);
      nextCount = Math.max(0, prevCount + d);
      if (target.counters && target.counters.length > 0) {
        const firstId = target.counters[0].id;
        nextSubCounts[firstId] = Math.max(0, (nextSubCounts[firstId] ?? 0) + d);
        nextCount = Object.values(nextSubCounts).reduce((a, b) => a + (Number(b) || 0), 0);
        setCustomSubCounts((prev) => ({ ...prev, [target.id]: nextSubCounts }));
      }
    }
    setCustomCounts((prev) => ({ ...prev, [target.id]: nextCount }));

    let isDone = false;
    if (target.counters && target.counters.length > 0) {
      isDone = target.counters.every((c) => {
        const val = nextSubCounts[c.id] ?? 0;
        return target.type === "avoid" ? val <= c.target_count : val >= c.target_count;
      });
    } else {
      isDone = nextCount >= (target.target_count ?? 1);
    }

    setSavingHabitIds((prev) => new Set(prev).add(target.id));
    setOptimisticLogs((prev) => {
      const nextMap = new Map(prev);
      nextMap.set(target.id, {
        id: prev.get(target.id)?.id ?? `opt-${target.id}-${Date.now()}`,
        user_id: target.user_id,
        habit_id: target.id,
        date: today,
        status: isDone ? "done" : "missed",
        count: nextCount,
        counts: nextSubCounts,
      });
      return nextMap;
    });

    try {
      await bumpCount(target.id, today, d, counterId);
      router.refresh();
    } catch {
      toast.danger(t.errors.saveFail);
    } finally {
      setSavingHabitIds((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
    }
  }, [optimisticLogs, logsByHabit, today, customCounts, customSubCounts, router, t]);

  const bump = useCallback(async (d: number, counterId?: string) => {
    if (!current) return;
    await bumpHabit(current, d, counterId);
  }, [current, bumpHabit]);

  const markHabit = useCallback((target: Habit, status: "done" | "missed", count?: number) => {
    const value = target.tracking_mode === "count"
      ? (count !== undefined ? count : (status === "done" ? (target.target_count ?? 1) : 0))
      : undefined;
    performSave(target.id, status, value);
  }, [performSave]);

  return (
    <>
      {/* View selector toolbar */}
      <div className={`flex items-center justify-end mb-3 w-full ${viewMode === "list" ? "max-w-xl mx-auto" : ""}`}>
        <div className="flex gap-1" role="group" aria-label="view">
          <AppTooltip content={t.views.list}>
            <Button
              isIconOnly
              size="sm"
              variant={viewMode === "list" ? "primary" : "secondary"}
              aria-label={t.views.list}
              onPress={() => changeViewMode("list")}
            >
              <LayoutList size={16} />
            </Button>
          </AppTooltip>

          <AppTooltip content={t.views.chain}>
            <Button
              isIconOnly
              size="sm"
              variant={viewMode === "chain" ? "primary" : "secondary"}
              aria-label={t.views.chain}
              onPress={() => changeViewMode("chain")}
            >
              <Workflow size={16} />
            </Button>
          </AppTooltip>
        </div>
      </div>

      {/* Habits View: List or Chain */}
      {viewMode === "list" ? (
        <div className="flex flex-col gap-2 max-w-xl w-full mx-auto">
          {habits.map((h) => {
            const isSaving = savingHabitIds.has(h.id);
            const log = optimisticLogs.has(h.id)
              ? (optimisticLogs.get(h.id) ?? undefined)
              : logsByHabit.get(h.id)?.get(today);
            const c = categories.find((x) => x.id === h.category_id);
            const currentCount = log?.count ?? 0;
            const pct = Math.min(100, (currentCount / (h.target_count ?? 1)) * 100);

            return (
              <div
                key={h.id}
                className={`rounded-2xl bg-surface relative group overflow-hidden border transition-all ${
                  isSaving
                    ? "border-accent/40 shadow-xs pointer-events-none opacity-60 select-none cursor-not-allowed"
                    : "border-transparent dark:border-border/10 hover:border-border/40 cursor-pointer"
                }`}
                onClick={() => {
                  if (!isSaving) openChain(h.id);
                }}
                aria-disabled={isSaving}
              >
                <Card.Content className="p-4 relative z-10 pointer-events-none">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                      style={{ backgroundColor: h.color + "40", color: h.color }}
                    >
                      <CategoryIcon icon={c?.icon ?? "other"} size={19} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{h.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs tabular-nums" aria-live="polite">
                        {isSaving ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                            <Spinner size="sm" color="accent" className="w-3 h-3" />
                            <span>{t.habit.saving}</span>
                          </span>
                        ) : log?.status === "done" ? (
                          <span className="inline-flex items-center gap-1 font-medium text-success">
                            <Check size={13} strokeWidth={2.5} />
                            {h.tracking_mode === "count"
                              ? h.counters && h.counters.length > 0
                                ? h.counters.map((cnt) => `${log.count != null ? (log.counts?.[cnt.id] ?? 0) : 0}/${cnt.target_count} ${cnt.name}`).join(" · ")
                                : `${log.count ?? 0} ${t.habit.of} ${h.target_count} ${h.unit ?? ""}`
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
                              ? h.counters && h.counters.length > 0
                                ? h.counters.map((cnt) => `0/${cnt.target_count} ${cnt.name}`).join(" · ")
                                : `0 ${t.habit.of} ${h.target_count} ${h.unit ?? ""}`
                              : t.habit.pendingToday}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Actions or Spinner */}
                    <div className="flex items-center gap-1 pointer-events-auto">
                      {isSaving ? (
                        <div className="flex items-center justify-center h-8 w-8 text-accent">
                          <Spinner size="sm" color="accent" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-success hover:bg-success/10"
                            aria-label={t.habit.completeGoal}
                            onPress={() => markHabit(h, "done")}
                            isDisabled={isSaving}
                          >
                            <Check size={16} strokeWidth={2.5} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger/10"
                            aria-label={t.habit.failed}
                            onPress={() => markHabit(h, "missed", log?.count ?? 0)}
                            isDisabled={isSaving}
                          >
                            <X size={16} strokeWidth={2.5} />
                          </Button>
                          {log && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={t.reports.clear}
                              onPress={() => unmark(h.id)}
                              isDisabled={isSaving}
                            >
                              <RotateCcw size={15} />
                            </Button>
                          )}
                        </div>
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
      ) : (
        <TodayChainView
          habits={habits}
          allHabits={fullHabitsList}
          categories={categories}
          logsByHabit={logsByHabit}
          optimisticLogs={optimisticLogs}
          savingHabitIds={savingHabitIds}
          today={today}
          onMark={markHabit}
          onUnmark={unmark}
          onBump={bumpHabit}
          onOpenRunner={openChain}
        />
      )}

      {/* Fluid Flashcard Modal: opaque backdrop without blur, semi-transparent frosted containers */}
      <Modal state={state}>
        <Modal.Backdrop
          isDismissable={true}
          className="bg-black/60 dark:bg-black/75 overflow-x-hidden p-4 flex items-center justify-center transition-opacity duration-200"
        >
          <Modal.Container
            placement="center"
            scroll="outside"
            className="w-full max-w-sm sm:max-w-md mx-auto !overflow-visible p-0"
          >
            <Modal.Dialog
              className="bg-transparent w-full max-w-sm sm:max-w-md mx-auto p-0 !overflow-visible border-none shadow-none ring-0 outline-none"
            >
              {() => current ? (
                <div className="flex flex-col gap-4 items-center w-full relative !overflow-visible">
                  {/* Card Stack container with CSS Grid locked alignment */}
                  <div
                    className="w-full relative !overflow-visible grid grid-cols-1 grid-rows-1 place-items-center"
                    style={{ perspective: 1200, overflow: "visible" }}
                  >
                    {/* 2nd Background Card (index 2, deepest in stack) */}
                    {nextNextHabit && (
                      <motion.div
                        key={`bg2-${nextNextHabit.id}`}
                        className="col-start-1 row-start-1 w-full pointer-events-none select-none z-0"
                        style={{
                          scale: bgScale2,
                          y: bgY2,
                          opacity: bgOpacity2,
                        }}
                      >
                        <SwipeCardStatic habit={nextNextHabit} cat={nextNextCat} />
                      </motion.div>
                    )}

                    {/* 1st Background Card (index 1, middle in stack) */}
                    {nextHabit && (
                      <motion.div
                        key={`bg1-${nextHabit.id}`}
                        className="col-start-1 row-start-1 w-full pointer-events-none select-none z-10"
                        style={{
                          scale: bgScale1,
                          y: bgY1,
                          opacity: bgOpacity1,
                        }}
                      >
                        <SwipeCardStatic habit={nextHabit} cat={nextCat} />
                      </motion.div>
                    )}

                    {/* Active Top Card (index 0, interactive) */}
                    <div className="col-start-1 row-start-1 w-full z-20 !overflow-visible">
                      <SwipeCard
                        key={current.id}
                        current={current}
                        cat={cat}
                        localCount={localCount}
                        localCounts={currentOptLog?.counts ?? customSubCounts[current.id] ?? {}}
                        bump={bump}
                        onDragProgress={(ox) => bgDragX.set(ox)}
                        onDragCancel={() => {
                          animate(bgDragX, 0, { duration: 0.22, ease: [0.16, 1, 0.3, 1] });
                        }}
                        onStartDismiss={handleStartDismiss}
                        onDismissComplete={handleDismissComplete}
                      />
                    </div>
                  </div>

                  {/* Indicator for next habit if one exists */}
                  {nextHabit && (
                    <div className="flex items-center gap-2 text-xs text-muted font-medium bg-background/60 backdrop-blur-lg border border-border/50 rounded-full px-3.5 py-1 shadow-xs transition-all">
                      <span>{t.flash.nextUp}:</span>
                      <span className="text-foreground font-semibold">{nextHabit.name}</span>
                      <ArrowRight size={13} className="text-muted" />
                    </div>
                  )}
                </div>
              ) : null}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

function SwipeCard({
  current,
  cat,
  localCount,
  localCounts,
  bump,
  onDragProgress,
  onDragCancel,
  onStartDismiss,
  onDismissComplete,
}: {
  current: Habit;
  cat?: HabitCategory;
  localCount: number;
  localCounts?: Record<string, number>;
  bump: (d: number, counterId?: string) => void;
  onDragProgress?: (x: number) => void;
  onDragCancel?: () => void;
  onStartDismiss?: (status: "done" | "missed", count?: number) => void;
  onDismissComplete?: () => void;
}) {
  const { t } = useLang();
  const [isDismissing, setIsDismissing] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-12, 12]);

  // The further away the card is moved, the more transparent it becomes until it disappears completely
  const cardOpacity = useTransform(x, [-260, -130, 0, 130, 260], [0, 0.5, 1, 0.5, 0]);

  // Stamps fade in as threshold approaches
  const opacityLeft = useTransform(x, [-40, -110], [0, 1]);
  const opacityRight = useTransform(x, [40, 110], [0, 1]);

  const dismissCard = useCallback(
    (dir: "left" | "right") => {
      if (isDismissing) return;
      setIsDismissing(true);

      const status = dir === "right" ? "done" : "missed";
      const value =
        current.tracking_mode === "count"
          ? status === "done"
            ? (current.target_count ?? 1)
            : localCount
          : undefined;

      onStartDismiss?.(status, value);

      const targetX = dir === "right" ? 650 : -650;
      animate(x, targetX, {
        duration: 0.22,
        ease: [0.32, 0.72, 0, 1],
        onComplete: () => {
          onDismissComplete?.();
        },
      });
    },
    [isDismissing, current, localCount, onStartDismiss, x, onDismissComplete]
  );

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isDismissing) return;
      if (e.key === "ArrowRight") {
        dismissCard("right");
      } else if (e.key === "ArrowLeft") {
        dismissCard("left");
      } else if (current.tracking_mode === "count" && e.key === "ArrowUp") {
        e.preventDefault();
        bump(1);
      } else if (current.tracking_mode === "count" && e.key === "ArrowDown") {
        e.preventDefault();
        bump(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDismissing, dismissCard, bump, current.tracking_mode]);

  return (
    <motion.div
      initial={false}
      style={{ x, rotate, opacity: cardOpacity }}
      drag={isDismissing ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.65}
      dragTransition={{
        bounceStiffness: 500,
        bounceDamping: 28,
        power: 0.15,
      }}
      onDrag={(_, info) => {
        if (isDismissing) return;
        onDragProgress?.(info.offset.x);
      }}
      onDragEnd={(_, info) => {
        if (isDismissing) return;
        const { offset, velocity } = info;
        const SWIPE_THRESHOLD = 130;
        const FLICK_VELOCITY = 500;

        // Swiping right: must be past threshold without user pulling back, or intentional fast forward flick
        const isRightSwipe =
          (offset.x > SWIPE_THRESHOLD && velocity.x >= -60) ||
          (offset.x > 50 && velocity.x > FLICK_VELOCITY);

        // Swiping left: must be past threshold without user pulling back, or intentional fast forward flick
        const isLeftSwipe =
          (offset.x < -SWIPE_THRESHOLD && velocity.x <= 60) ||
          (offset.x < -50 && velocity.x < -FLICK_VELOCITY);

        if (isRightSwipe) {
          dismissCard("right");
        } else if (isLeftSwipe) {
          dismissCard("left");
        } else {
          onDragCancel?.();
        }
      }}
      className="relative flex w-full min-h-[280px] flex-col items-center justify-center gap-5 rounded-3xl border border-border/50 bg-background/60 dark:bg-background/50 backdrop-blur-lg p-7 text-center shadow-xl select-none touch-none cursor-grab active:cursor-grabbing !overflow-visible"
    >
      {/* Sello HECHO / LIMPIO (Derecha) */}
      <motion.div
        style={{ opacity: opacityRight }}
        className="absolute right-5 top-5 rounded-xl border-2 border-success px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-success rotate-12 bg-success/15 backdrop-blur-sm pointer-events-none select-none z-20"
      >
        {current.type === "avoid" ? t.habit.clean : current.tracking_mode === "count" ? t.habit.completeGoal : t.habit.didIt}
      </motion.div>

      {/* Sello FALLADO / RECAÍ (Izquierda) */}
      <motion.div
        style={{ opacity: opacityLeft }}
        className="absolute left-5 top-5 rounded-xl border-2 border-danger px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-danger -rotate-12 bg-danger/15 backdrop-blur-sm pointer-events-none select-none z-20"
      >
        {current.type === "avoid" ? t.habit.relapsed : t.habit.failed}
      </motion.div>

      {/* Icono de categoría */}
      <span
        className="flex h-18 w-18 items-center justify-center rounded-2xl relative z-10 transition-transform shadow-xs"
        style={{
          backgroundColor: current.color + "30",
          color: current.color,
        }}
      >
        <CategoryIcon icon={cat?.icon ?? "other"} size={32} />
      </span>

      {/* Nombre del hábito */}
      <div className="flex flex-col gap-1 items-center relative z-10">
        <p className="text-xl font-semibold text-balance tracking-tight">{current.name}</p>
        {cat && (
          <p className="text-xs text-muted max-w-xs font-medium">
            {cat.name}
          </p>
        )}
      </div>

      {/* Contador con estilo frosted glass matching AppNav */}
      {current.tracking_mode === "count" && (
        current.counters && current.counters.length > 0 ? (
          <div
            className="flex flex-col gap-2 w-full max-w-xs relative z-30 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
            aria-live="polite"
          >
            {current.counters.map((c) => {
              const subCount = localCounts?.[c.id] ?? 0;
              const isSubDone = current.type === "avoid" ? subCount <= c.target_count : subCount >= c.target_count;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl bg-background/50 backdrop-blur-md border border-border/50"
                >
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-xs font-semibold truncate text-foreground">{c.name}</span>
                    <span className={`text-[11px] font-medium tabular-nums ${isSubDone ? "text-success" : "text-muted"}`}>
                      {subCount} / {c.target_count} {c.unit ?? ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="secondary"
                      aria-label={`-1 ${c.name}`}
                      className="h-7 w-7 rounded-xl active:scale-95 transition-transform"
                      onPress={() => bump(-1, c.id)}
                    >
                      <Minus size={13} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="secondary"
                      aria-label={`+1 ${c.name}`}
                      className="h-7 w-7 rounded-xl active:scale-95 transition-transform"
                      onPress={() => bump(1, c.id)}
                    >
                      <Plus size={13} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="flex items-center gap-3 py-1.5 px-3 rounded-2xl bg-background/40 backdrop-blur-md border border-border/50 relative z-30 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
            aria-live="polite"
          >
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              aria-label="-1"
              className="h-8 w-8 rounded-xl active:scale-95 transition-transform"
              onPress={() => bump(-1)}
            >
              <Minus size={15} />
            </Button>
            <span className="min-w-24 text-2xl font-bold tabular-nums">
              {localCount}{" "}
              <span className="text-sm font-normal text-muted">
                / {current.target_count} {current.unit ?? ""}
              </span>
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              aria-label="+1"
              className="h-8 w-8 rounded-xl active:scale-95 transition-transform"
              onPress={() => bump(1)}
            >
              <Plus size={15} />
            </Button>
          </div>
        )
      )}
    </motion.div>
  );
}

function SwipeCardStatic({ habit, cat }: { habit: Habit; cat?: HabitCategory }) {
  return (
    <div className="flex w-full min-h-[280px] flex-col items-center justify-center gap-5 rounded-3xl border border-border/50 bg-background/60 dark:bg-background/50 backdrop-blur-lg p-7 text-center shadow-xl select-none">
      <span
        className="flex h-18 w-18 items-center justify-center rounded-2xl shadow-xs"
        style={{
          backgroundColor: habit.color + "30",
          color: habit.color,
        }}
      >
        <CategoryIcon icon={cat?.icon ?? "other"} size={32} />
      </span>

      <div className="flex flex-col gap-1 items-center">
        <p className="text-xl font-semibold text-balance tracking-tight">{habit.name}</p>
        {cat && (
          <p className="text-xs text-muted max-w-xs font-medium">
            {cat.name}
          </p>
        )}
      </div>

      {habit.tracking_mode === "count" && (
        habit.counters && habit.counters.length > 0 ? (
          <div className="flex flex-col gap-1.5 w-full max-w-xs opacity-60">
            {habit.counters.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-1 rounded-xl bg-background/40 border border-border/40 text-xs text-muted">
                <span>{c.name}</span>
                <span>0 / {c.target_count} {c.unit ?? ""}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-1.5 px-3 rounded-2xl bg-background/40 backdrop-blur-md border border-border/50 opacity-60">
            <Button isIconOnly size="sm" variant="secondary" className="h-8 w-8 rounded-xl" isDisabled>
              <Minus size={15} />
            </Button>
            <span className="min-w-24 text-2xl font-bold tabular-nums text-muted">
              0 <span className="text-sm font-normal">/ {habit.target_count} {habit.unit ?? ""}</span>
            </span>
            <Button isIconOnly size="sm" variant="secondary" className="h-8 w-8 rounded-xl" isDisabled>
              <Plus size={15} />
            </Button>
          </div>
        )
      )}
    </div>
  );
}
