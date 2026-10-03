"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button, ProgressBar, Spinner } from "@heroui/react";
import { ArrowDown, ArrowRight, Check, ChevronDown, Clock, Lock, Minus, Pencil, Plus, RotateCcw, X, Sparkles } from "lucide-react";
import { useLang } from "@/components/language";
import { CategoryIcon } from "@/components/category-icon";
import { AppTooltip } from "@/components/app-tooltip";
import { StreakBadge } from "@/components/streak-badge";
import { computeChainStreak } from "@/lib/streak";
import { ChainEditModal } from "@/components/chain-edit-modal";
import type { Habit, HabitCategory, HabitLog } from "@/lib/types";

type Props = {
  habits: Habit[];
  allHabits?: Habit[];
  categories: HabitCategory[];
  logsByHabit: Map<string, Map<string, HabitLog>>;
  optimisticLogs: Map<string, HabitLog | null>;
  savingHabitIds: Set<string>;
  today: string;
  selectedDate?: string;
  onMark: (habit: Habit, status: "done" | "missed", count?: number) => void;
  onUnmark: (habitId: string) => void;
  onBump: (habit: Habit, delta: number, counterId?: string) => void;
  onOpenRunner: (habitId: string) => void;
};

type ChainGroup = {
  id: string;
  name?: string;
  time?: string | null;
  headHabitId?: string;
  habits: Habit[];
  isSingle: boolean;
};

function formatChainTime(timeVal: string | null | undefined, t: ReturnType<typeof useLang>["t"]) {
  if (!timeVal) return null;
  if (timeVal === "morning") return `🌅 ${t.views.morning}`;
  if (timeVal === "afternoon") return `☀️ ${t.views.afternoon}`;
  if (timeVal === "night") return `🌙 ${t.views.night}`;
  if (timeVal === "anytime") return t.views.anytime;
  return `⏰ ${timeVal}`;
}

function findChainMetadata(firstHabit: Habit, allById: Map<string, Habit>) {
  if (firstHabit.chain_name || firstHabit.chain_time) {
    return { name: firstHabit.chain_name, time: firstHabit.chain_time, headId: firstHabit.id };
  }
  const incoming = new Map<string, string>();
  for (const h of allById.values()) {
    if (h.next_habit_id) {
      incoming.set(h.next_habit_id, h.id);
    }
  }
  let currId = firstHabit.id;
  const seen = new Set<string>([currId]);
  while (incoming.has(currId)) {
    const parentId = incoming.get(currId)!;
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = allById.get(parentId);
    if (parent) {
      currId = parent.id;
      if (parent.chain_name || parent.chain_time) {
        return { name: parent.chain_name, time: parent.chain_time, headId: parent.id };
      }
    }
  }
  return { name: undefined, time: undefined, headId: currId };
}

export function getNextActiveInChain(
  habit: Habit,
  activeIds: Set<string>,
  allById: Map<string, Habit>
): Habit | undefined {
  let curr = habit;
  const seen = new Set<string>([habit.id]);
  while (curr.next_habit_id && allById.has(curr.next_habit_id)) {
    const nextId = curr.next_habit_id;
    if (seen.has(nextId)) break;
    seen.add(nextId);
    if (activeIds.has(nextId)) {
      return allById.get(nextId);
    }
    curr = allById.get(nextId)!;
  }
  return undefined;
}

export function TodayChainView({
  habits,
  allHabits,
  categories,
  logsByHabit,
  optimisticLogs,
  savingHabitIds,
  today,
  selectedDate,
  onMark,
  onUnmark,
  onBump,
  onOpenRunner,
}: Props) {
  const { t } = useLang();
  const allList = allHabits ?? habits;
  const allById = useMemo(() => new Map(allList.map((h) => [h.id, h])), [allList]);
  const activeIds = useMemo(() => new Set(habits.map((h) => h.id)), [habits]);

  // Group habits into directed chains based on effective next active habit
  const chains: ChainGroup[] = useMemo(() => {
    const visitedInChain = new Set<string>();
    const multiChains: ChainGroup[] = [];

    // Track which habits are targeted by an active predecessor
    const targetedIds = new Set<string>();
    for (const h of habits) {
      const nextActive = getNextActiveInChain(h, activeIds, allById);
      if (nextActive && nextActive.id !== h.id) {
        targetedIds.add(nextActive.id);
      }
    }

    // 1. Identify heads of chains (active habits that are not targeted, but point to an active next habit)
    const heads = habits.filter(
      (h) => !targetedIds.has(h.id) && !!getNextActiveInChain(h, activeIds, allById)
    );

    heads.forEach((head) => {
      if (visitedInChain.has(head.id)) return;
      const chain: Habit[] = [head];
      const visitedInThisChain = new Set<string>([head.id]);

      let curr = head;
      let nextActive = getNextActiveInChain(curr, activeIds, allById);
      while (
        nextActive &&
        !visitedInChain.has(nextActive.id) &&
        !visitedInThisChain.has(nextActive.id)
      ) {
        chain.push(nextActive);
        visitedInThisChain.add(nextActive.id);
        curr = nextActive;
        nextActive = getNextActiveInChain(curr, activeIds, allById);
      }

      if (chain.length > 1) {
        chain.forEach((h) => visitedInChain.add(h.id));
        const meta = findChainMetadata(head, allById);
        multiChains.push({
          id: `chain-${head.id}`,
          name: meta.name || `${head.name} → ...`,
          time: meta.time,
          headHabitId: meta.headId,
          habits: chain,
          isSingle: false,
        });
      }
    });

    // 2. Identify remaining connected loops/cycles of length > 1
    habits.forEach((h) => {
      if (!visitedInChain.has(h.id)) {
        let nextActive = getNextActiveInChain(h, activeIds, allById);
        if (nextActive && nextActive.id !== h.id && !visitedInChain.has(nextActive.id)) {
          const chain: Habit[] = [h];
          const visitedInThisChain = new Set<string>([h.id]);

          let curr = h;
          while (
            nextActive &&
            !visitedInChain.has(nextActive.id) &&
            !visitedInThisChain.has(nextActive.id)
          ) {
            chain.push(nextActive);
            visitedInThisChain.add(nextActive.id);
            curr = nextActive;
            nextActive = getNextActiveInChain(curr, activeIds, allById);
          }

          if (chain.length > 1) {
            chain.forEach((item) => visitedInChain.add(item.id));
            const meta = findChainMetadata(h, allById);
            multiChains.push({
              id: `cycle-${h.id}`,
              name: meta.name || `${h.name} → ...`,
              time: meta.time,
              headHabitId: meta.headId,
              habits: chain,
              isSingle: false,
            });
          }
        }
      }
    });

    // 3. Every habit NOT in an active multi-step chain belongs to Standalone habits
    const standalones = habits.filter((h) => !visitedInChain.has(h.id));
    if (standalones.length > 0) {
      multiChains.push({
        id: "standalones",
        name: undefined,
        habits: standalones,
        isSingle: true,
      });
    }

    return multiChains;
  }, [habits, activeIds, allById]);

  return (
    <div className="flex flex-col gap-8 w-full py-2">
      {chains.map((chain) => (
        <ChainTrack
          key={chain.id}
          chain={chain}
          categories={categories}
          logsByHabit={logsByHabit}
          optimisticLogs={optimisticLogs}
          savingHabitIds={savingHabitIds}
          today={today}
          selectedDate={selectedDate ?? today}
          t={t}
          onMark={onMark}
          onUnmark={onUnmark}
          onBump={onBump}
          onOpenRunner={onOpenRunner}
        />
      ))}
    </div>
  );
}

function ChainTrack({
  chain,
  categories,
  logsByHabit,
  optimisticLogs,
  savingHabitIds,
  today,
  selectedDate,
  t,
  onMark,
  onUnmark,
  onBump,
  onOpenRunner,
}: {
  chain: ChainGroup;
  categories: HabitCategory[];
  logsByHabit: Map<string, Map<string, HabitLog>>;
  optimisticLogs: Map<string, HabitLog | null>;
  savingHabitIds: Set<string>;
  today: string;
  selectedDate: string;
  t: ReturnType<typeof useLang>["t"];
  onMark: (habit: Habit, status: "done" | "missed", count?: number) => void;
  onUnmark: (habitId: string) => void;
  onBump: (habit: Habit, delta: number, counterId?: string) => void;
  onOpenRunner: (habitId: string) => void;
}) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLDivElement>(null);
  const effectiveDate = selectedDate || today;

  // Compute chain streak with same freeze rules as individual habits
  const chainStreak = useMemo(() => {
    if (chain.isSingle) return null;
    return computeChainStreak(chain.habits, logsByHabit, today);
  }, [chain, logsByHabit, today]);

  // Determine completion and unlock states for every node in this chain
  const nodeStates = useMemo(() => {
    return chain.habits.map((h, index) => {
      const isSaving = savingHabitIds.has(h.id);
      const log = optimisticLogs.has(h.id)
        ? (optimisticLogs.get(h.id) ?? undefined)
        : logsByHabit.get(h.id)?.get(effectiveDate);

      let isDone = log?.status === "done";
      let isMissed = log?.status === "missed";
      if (h.counters && h.counters.length > 0 && log) {
        const counts = log.counts ?? {};
        const allDone = h.counters.every((c) => {
          const val = counts[c.id] ?? 0;
          return h.type === "avoid" ? val <= c.target_count : val >= c.target_count;
        });
        if (allDone) isDone = true;
      }

      // In standalone list, all are unlocked. In a chain, index 0 is unlocked,
      // and subsequent nodes are unlocked only if the preceding node is done or missed.
      let isUnlocked = true;
      if (!chain.isSingle && index > 0) {
        const prevHabit = chain.habits[index - 1];
        const prevLog = optimisticLogs.has(prevHabit.id)
          ? (optimisticLogs.get(prevHabit.id) ?? undefined)
          : logsByHabit.get(prevHabit.id)?.get(effectiveDate);
        
        let prevDone = prevLog?.status === "done";
        if (prevHabit.counters && prevHabit.counters.length > 0 && prevLog) {
          const pCounts = prevLog.counts ?? {};
          prevDone = prevHabit.counters.every((c) => {
            const val = pCounts[c.id] ?? 0;
            return prevHabit.type === "avoid" ? val <= c.target_count : val >= c.target_count;
          });
        }
        const prevMissed = prevLog?.status === "missed";
        isUnlocked = prevDone || prevMissed;
      }

      return {
        habit: h,
        log,
        isSaving,
        isDone,
        isMissed,
        isUnlocked,
        isCurrentTarget: isUnlocked && !isDone && !isMissed,
      };
    });
  }, [chain, savingHabitIds, optimisticLogs, logsByHabit, effectiveDate]);

  // Find the current active habit in this chain
  const currentTarget = nodeStates.find((n) => n.isCurrentTarget);
  const isChainFullyCompleted = !chain.isSingle && nodeStates.every((n) => n.isDone);
  const completedHabitsCount = useMemo(() => {
    return nodeStates.filter((n) => n.isDone).length;
  }, [nodeStates]);

  // Auto-scroll to the newly unlocked / current active habit
  useEffect(() => {
    if (!isCollapsed && activeNodeRef.current && scrollContainerRef.current) {
      activeNodeRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [currentTarget?.habit.id, isCollapsed]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Borderless Accordion Header */}
      <div className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-surface/60 transition-colors group select-none">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsCollapsed((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsCollapsed((prev) => !prev);
            }
          }}
          className="flex items-center gap-2.5 flex-wrap flex-1 cursor-pointer"
          aria-expanded={!isCollapsed}
        >
          <ChevronDown
            size={16}
            className={`text-muted transition-transform duration-200 shrink-0 ${
              isCollapsed ? "-rotate-90" : "rotate-0"
            }`}
          />
          <span className="text-xs font-semibold tracking-wider uppercase text-foreground/80 group-hover:text-foreground">
            {chain.isSingle
              ? `${t.views.standaloneTitle} (${chain.habits.length})`
              : chain.name}
          </span>

          {/* Chain Progress badge x/n */}
          {!chain.isSingle && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-surface border border-border/50 text-foreground tabular-nums">
              {completedHabitsCount}/{chain.habits.length}
            </span>
          )}

          {/* Time badge if specified */}
          {!chain.isSingle && chain.time && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">
              <Clock size={11} />
              <span>{formatChainTime(chain.time, t)}</span>
            </span>
          )}

          {!chain.isSingle && isChainFullyCompleted && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/15 px-2 py-0.5 rounded-full border border-success/30">
              <Sparkles size={11} />
              <span>{t.views.chainCompleted}</span>
            </span>
          )}
          {!chain.isSingle && chainStreak && (chainStreak.current > 0 || chainStreak.best > 0 || chainStreak.freeze) && (
            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface/80 border border-border/40">
              <StreakBadge streak={chainStreak} kind="build" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!chain.isSingle && chain.headHabitId && (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t.views.editChain}
              className="h-7 w-7 text-muted hover:text-foreground hover:bg-surface/80 rounded-lg"
              onPress={() => setIsEditModalOpen(true)}
            >
              <Pencil size={13} />
            </Button>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="text-[11px] text-muted hover:text-foreground transition-opacity"
          >
            {isCollapsed ? t.views.showTrack : t.views.hideTrack}
          </button>
        </div>
      </div>

      {!chain.isSingle && chain.headHabitId && (
        <ChainEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          headHabitId={chain.headHabitId}
          initialName={chain.name?.endsWith("→ ...") ? "" : chain.name}
          initialTime={chain.time}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Responsive pipeline track with smooth collapse/expand animation */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="pipeline-track"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="w-full overflow-hidden"
          >
            <div
              ref={scrollContainerRef}
              className={
                chain.isSingle
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 w-full py-1"
                  : "flex flex-col md:flex-row items-center md:items-stretch gap-3 md:gap-0 overflow-x-auto scroll-smooth py-3 px-1 custom-scrollbar"
              }
            >
              {nodeStates.map((node, index) => {
                const isLast = index === nodeStates.length - 1;
                const isTarget = node.isCurrentTarget;

                return (
                  <div
                    key={node.habit.id}
                    ref={isTarget ? activeNodeRef : undefined}
                    className={`flex ${
                      chain.isSingle
                        ? "w-full"
                        : "flex-col md:flex-row items-center w-full md:w-auto shrink-0"
                    }`}
                  >
                    {/* The Pipeline Node */}
                    <ChainNode
                      habit={node.habit}
                      cat={categories.find((c) => c.id === node.habit.category_id)}
                      log={node.log}
                      isSaving={node.isSaving}
                      isDone={node.isDone}
                      isMissed={node.isMissed}
                      isUnlocked={node.isUnlocked}
                      isCurrentTarget={isTarget}
                      isSingle={chain.isSingle}
                      t={t}
                      onMark={(status, count) => onMark(node.habit, status, count)}
                      onUnmark={() => onUnmark(node.habit.id)}
                      onBump={(d, cId) => onBump(node.habit, d, cId)}
                      onOpenRunner={() => onOpenRunner(node.habit.id)}
                    />

                    {/* Connecting Arrow between chain nodes */}
                    {!chain.isSingle && !isLast && (
                      <ChainConnector
                        isPreviousDone={node.isDone}
                        isPreviousMissed={node.isMissed}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChainNode({
  habit,
  cat,
  log,
  isSaving,
  isDone,
  isMissed,
  isUnlocked,
  isCurrentTarget,
  isSingle,
  t,
  onMark,
  onUnmark,
  onBump,
  onOpenRunner,
}: {
  habit: Habit;
  cat?: HabitCategory;
  log?: HabitLog;
  isSaving: boolean;
  isDone: boolean;
  isMissed: boolean;
  isUnlocked: boolean;
  isCurrentTarget: boolean;
  isSingle?: boolean;
  t: ReturnType<typeof useLang>["t"];
  onMark: (status: "done" | "missed", count?: number) => void;
  onUnmark: () => void;
  onBump: (delta: number, counterId?: string) => void;
  onOpenRunner: () => void;
}) {
  const currentCount = log?.count ?? 0;
  const targetCount = habit.target_count ?? 1;
  const pct = Math.min(100, (currentCount / targetCount) * 100);

  const subCounterStats = useMemo(() => {
    if (!habit.counters || habit.counters.length === 0) return null;
    const counts = log?.counts ?? {};
    let done = 0;
    for (const c of habit.counters) {
      const cur = counts[c.id] ?? 0;
      const isSubDone = habit.type === "avoid" ? cur <= c.target_count : cur >= c.target_count;
      if (isSubDone) done++;
    }
    const total = habit.counters.length;
    const subPct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, pct: subPct, allDone: done === total };
  }, [habit.counters, log?.counts, habit.type]);

  // Border and glow style matching node architecture from reference image
  const cardBorderAndGlow = useMemo(() => {
    if (isSaving) {
      return "border-accent/40 shadow-xs opacity-60 pointer-events-none select-none";
    }
    if (isDone) {
      return "border-success/60 bg-success/5 shadow-[0_0_24px_-6px_rgba(22,163,74,0.35)]";
    }
    if (isMissed) {
      return "border-danger/60 bg-danger/5 shadow-[0_0_24px_-6px_rgba(239,68,68,0.3)]";
    }
    if (isCurrentTarget) {
      return "shadow-lg ring-1 ring-white/10";
    }
    if (!isUnlocked) {
      return "border-border/30 opacity-55 select-none";
    }
    return "border-border/50 hover:border-border/80";
  }, [isSaving, isDone, isMissed, isCurrentTarget, isUnlocked]);

  const customStyle = useMemo(() => {
    if (isCurrentTarget && !isDone && !isMissed) {
      return {
        borderColor: habit.color,
        boxShadow: `0 0 25px -4px ${habit.color}35`,
      };
    }
    return undefined;
  }, [isCurrentTarget, isDone, isMissed, habit.color]);

  return (
    <div
      style={customStyle}
      onClick={() => {
        if (isUnlocked) onOpenRunner();
      }}
      className={`${
        isSingle ? "w-full" : "w-full max-w-sm md:w-64 lg:w-72 xl:w-80 shrink-0"
      } rounded-2xl border transition-all duration-300 p-4 relative overflow-hidden backdrop-blur-md bg-surface/90 dark:bg-zinc-900/90 ${
        isUnlocked ? "cursor-pointer" : "cursor-default"
      } ${cardBorderAndGlow}`}
    >
      {/* Header Row: Category icon & Status Badge */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform"
          style={{ backgroundColor: habit.color + "35", color: habit.color }}
        >
          <CategoryIcon icon={cat?.icon ?? "other"} size={18} />
        </span>

        {/* Status Indicators */}
        <div className="flex items-center gap-1.5">
          {isSaving ? (
            <span className="inline-flex items-center gap-1 text-xs text-accent font-medium">
              <Spinner size="sm" color="accent" className="w-3.5 h-3.5" />
              <span>{t.habit.saving}</span>
            </span>
          ) : !isUnlocked ? (
            <AppTooltip content={t.views.lockedHint}>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted bg-default/20 px-2 py-0.5 rounded-full border border-border/40">
                <Lock size={12} />
                <span>{t.views.locked}</span>
              </span>
            </AppTooltip>
          ) : isDone ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success bg-success/15 px-2 py-0.5 rounded-full border border-success/30">
              <Check size={12} strokeWidth={2.5} />
              <span>{habit.type === "avoid" ? t.habit.clean : t.today.done}</span>
            </span>
          ) : isMissed ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger bg-danger/15 px-2 py-0.5 rounded-full border border-danger/30">
              <X size={12} strokeWidth={2.5} />
              <span>{habit.type === "avoid" ? t.habit.relapsed : t.today.missed}</span>
            </span>
          ) : (
            <span
              className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: habit.color + "20", color: habit.color }}
            >
              {t.habit.pendingToday}
            </span>
          )}
        </div>
      </div>

      {/* Habit Name and Subtitle / Category */}
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-foreground group-hover:text-accent transition-colors">
          {habit.name}
        </p>
        {cat && (
          <p className="text-xs text-muted truncate mt-0.5">
            {cat.name}
          </p>
        )}
      </div>

      {/* Multi-counter compact progress bar or single counter progress */}
      {subCounterStats ? (
        <div className="mt-3 pt-2 border-t border-border/30 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground/90 tabular-nums">
              {subCounterStats.done} / {subCounterStats.total} {t.views.countersCompleted}
            </span>
            <span className={`text-[11px] font-semibold tabular-nums ${subCounterStats.allDone ? "text-success" : "text-muted"}`}>
              {subCounterStats.pct}%
            </span>
          </div>
          <ProgressBar value={subCounterStats.pct} className="h-1.5">
            <ProgressBar.Track className="bg-default/20">
              <ProgressBar.Fill
                style={{
                  background: subCounterStats.allDone ? "#22c55e" : habit.color,
                  width: `${subCounterStats.pct}%`,
                }}
              />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      ) : habit.tracking_mode === "count" ? (
        <ProgressBar value={pct} className="mt-3">
          <ProgressBar.Track>
            <ProgressBar.Fill style={{ background: habit.color, width: `${pct}%` }} />
          </ProgressBar.Track>
        </ProgressBar>
      ) : null}

      {/* Interactive Action Controls (Only when unlocked) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between gap-2"
      >
        {!isUnlocked ? (
          <p className="text-[11px] text-muted flex items-center gap-1">
            <Lock size={12} className="shrink-0" />
            <span className="truncate">{t.views.lockedHint}</span>
          </p>
        ) : (
          <>
            {/* If count mode, show +/- buttons */}
            {habit.counters && habit.counters.length > 0 ? (
              <div className="text-xs text-muted font-medium">
                {isDone ? t.today.done : isMissed ? t.today.missed : t.habit.pendingToday}
              </div>
            ) : habit.tracking_mode === "count" ? (
              <div className="flex items-center gap-2">
                <Button
                  isIconOnly
                  size="sm"
                  variant="secondary"
                  aria-label="-1"
                  className="h-7 w-7 rounded-lg"
                  isDisabled={isSaving}
                  onPress={() => onBump(-1)}
                >
                  <Minus size={13} />
                </Button>
                <span className="text-xs font-semibold tabular-nums min-w-14 text-center">
                  {currentCount} / {targetCount} {habit.unit ?? ""}
                </span>
                <Button
                  isIconOnly
                  size="sm"
                  variant="secondary"
                  aria-label="+1"
                  className="h-7 w-7 rounded-lg"
                  isDisabled={isSaving}
                  onPress={() => onBump(1)}
                >
                  <Plus size={13} />
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted font-medium">
                {isDone ? t.today.done : isMissed ? t.today.missed : t.habit.pendingToday}
              </div>
            )}

            {/* Complete / Fail / Reset actions */}
            <div className="flex items-center gap-1">
              {!isDone && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs font-semibold text-success hover:bg-success/10"
                  isDisabled={isSaving}
                  onPress={() =>
                    onMark("done", habit.tracking_mode === "count" ? targetCount : undefined)
                  }
                >
                  <Check size={14} strokeWidth={2.5} className="mr-0.5" />
                  <span>{habit.type === "avoid" ? t.habit.clean : t.habit.didIt}</span>
                </Button>
              )}

              {!isMissed && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={t.habit.failed}
                  className="h-7 w-7 text-danger hover:bg-danger/10"
                  isDisabled={isSaving}
                  onPress={() => onMark("missed")}
                >
                  <X size={14} strokeWidth={2.5} />
                </Button>
              )}

              {(isDone || isMissed) && (
                <AppTooltip content={t.reports.clear}>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={t.reports.clear}
                    className="h-7 w-7 text-muted hover:text-foreground hover:bg-default/20"
                    isDisabled={isSaving}
                    onPress={onUnmark}
                  >
                    <RotateCcw size={14} />
                  </Button>
                </AppTooltip>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChainConnector({
  isPreviousDone,
  isPreviousMissed,
}: {
  isPreviousDone: boolean;
  isPreviousMissed?: boolean;
}) {
  return (
    <>
      {/* Horizontal connector on Desktop (md+) */}
      <div className="hidden md:flex items-center px-2 shrink-0 select-none pointer-events-none relative">
        <div
          className={`h-[2px] w-6 md:w-8 transition-colors duration-300 ${
            isPreviousDone
              ? "bg-success shadow-[0_0_8px_rgba(22,163,74,0.7)]"
              : isPreviousMissed
              ? "bg-danger/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              : "bg-zinc-400 dark:bg-zinc-500"
          }`}
        />
        <ArrowRight
          size={18}
          strokeWidth={2.5}
          className={`-ml-1 transition-colors duration-300 ${
            isPreviousDone
              ? "text-success drop-shadow-[0_0_6px_rgba(22,163,74,0.5)]"
              : isPreviousMissed
              ? "text-danger drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        />
      </div>

      {/* Vertical connector on Mobile (<md) */}
      <div className="flex md:hidden flex-col items-center py-2 shrink-0 select-none pointer-events-none relative">
        <div
          className={`w-[2px] h-5 transition-colors duration-300 ${
            isPreviousDone
              ? "bg-success shadow-[0_0_8px_rgba(22,163,74,0.7)]"
              : isPreviousMissed
              ? "bg-danger/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              : "bg-zinc-400 dark:bg-zinc-500"
          }`}
        />
        <ArrowDown
          size={18}
          strokeWidth={2.5}
          className={`-mt-1 transition-colors duration-300 ${
            isPreviousDone
              ? "text-success drop-shadow-[0_0_6px_rgba(22,163,74,0.5)]"
              : isPreviousMissed
              ? "text-danger drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        />
      </div>
    </>
  );
}
