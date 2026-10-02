"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ProgressBar, Spinner } from "@heroui/react";
import { ArrowDown, ArrowRight, Check, ChevronDown, Lock, Minus, Plus, RotateCcw, X, Sparkles } from "lucide-react";
import { useLang } from "@/components/language";
import { CategoryIcon } from "@/components/category-icon";
import { AppTooltip } from "@/components/app-tooltip";
import type { Habit, HabitCategory, HabitLog } from "@/lib/types";

type Props = {
  habits: Habit[];
  categories: HabitCategory[];
  logsByHabit: Map<string, Map<string, HabitLog>>;
  optimisticLogs: Map<string, HabitLog | null>;
  savingHabitIds: Set<string>;
  today: string;
  onMark: (habit: Habit, status: "done" | "missed", count?: number) => void;
  onUnmark: (habitId: string) => void;
  onBump: (habit: Habit, delta: number) => void;
  onOpenRunner: (habitId: string) => void;
};

type ChainGroup = {
  id: string;
  name?: string;
  habits: Habit[];
  isSingle: boolean;
};

export function TodayChainView({
  habits,
  categories,
  logsByHabit,
  optimisticLogs,
  savingHabitIds,
  today,
  onMark,
  onUnmark,
  onBump,
  onOpenRunner,
}: Props) {
  const { t } = useLang();
  const byId = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);

  // Group habits into directed chains based on next_habit_id
  const chains: ChainGroup[] = useMemo(() => {
    const visitedInChain = new Set<string>();
    const multiChains: ChainGroup[] = [];

    // Track which habits are targeted by a valid next_habit_id
    const targetedIds = new Set<string>();
    for (const h of habits) {
      if (h.next_habit_id && byId.has(h.next_habit_id) && h.next_habit_id !== h.id) {
        targetedIds.add(h.next_habit_id);
      }
    }

    // 1. Identify heads of chains (habits that are not targeted, but point to a valid next habit)
    const heads = habits.filter(
      (h) => !targetedIds.has(h.id) && h.next_habit_id && byId.has(h.next_habit_id) && h.next_habit_id !== h.id
    );

    heads.forEach((head) => {
      if (visitedInChain.has(head.id)) return;
      const chain: Habit[] = [head];
      const visitedInThisChain = new Set<string>([head.id]);

      let curr = head;
      while (
        curr.next_habit_id &&
        byId.has(curr.next_habit_id) &&
        !visitedInChain.has(curr.next_habit_id) &&
        !visitedInThisChain.has(curr.next_habit_id)
      ) {
        const next = byId.get(curr.next_habit_id)!;
        chain.push(next);
        visitedInThisChain.add(next.id);
        curr = next;
      }

      if (chain.length > 1) {
        chain.forEach((h) => visitedInChain.add(h.id));
        multiChains.push({
          id: `chain-${head.id}`,
          name: `${head.name} → ...`,
          habits: chain,
          isSingle: false,
        });
      }
    });

    // 2. Identify remaining connected loops/cycles of length > 1
    habits.forEach((h) => {
      if (
        !visitedInChain.has(h.id) &&
        h.next_habit_id &&
        byId.has(h.next_habit_id) &&
        h.next_habit_id !== h.id &&
        !visitedInChain.has(h.next_habit_id)
      ) {
        const chain: Habit[] = [h];
        const visitedInThisChain = new Set<string>([h.id]);

        let curr = h;
        while (
          curr.next_habit_id &&
          byId.has(curr.next_habit_id) &&
          !visitedInChain.has(curr.next_habit_id) &&
          !visitedInThisChain.has(curr.next_habit_id)
        ) {
          const next = byId.get(curr.next_habit_id)!;
          chain.push(next);
          visitedInThisChain.add(next.id);
          curr = next;
        }

        if (chain.length > 1) {
          chain.forEach((item) => visitedInChain.add(item.id));
          multiChains.push({
            id: `cycle-${h.id}`,
            name: `${h.name} → ...`,
            habits: chain,
            isSingle: false,
          });
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
  }, [habits, byId]);

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
  t: ReturnType<typeof useLang>["t"];
  onMark: (habit: Habit, status: "done" | "missed", count?: number) => void;
  onUnmark: (habitId: string) => void;
  onBump: (habit: Habit, delta: number) => void;
  onOpenRunner: (habitId: string) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLDivElement>(null);

  // Determine completion and unlock states for every node in this chain
  const nodeStates = useMemo(() => {
    return chain.habits.map((h, index) => {
      const isSaving = savingHabitIds.has(h.id);
      const log = optimisticLogs.has(h.id)
        ? (optimisticLogs.get(h.id) ?? undefined)
        : logsByHabit.get(h.id)?.get(today);

      const isDone = log?.status === "done";
      const isMissed = log?.status === "missed";

      // In standalone list, all are unlocked. In a chain, index 0 is unlocked,
      // and subsequent nodes are unlocked only if the preceding node is done.
      let isUnlocked = true;
      if (!chain.isSingle && index > 0) {
        const prevHabit = chain.habits[index - 1];
        const prevLog = optimisticLogs.has(prevHabit.id)
          ? (optimisticLogs.get(prevHabit.id) ?? undefined)
          : logsByHabit.get(prevHabit.id)?.get(today);
        isUnlocked = prevLog?.status === "done";
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
  }, [chain, savingHabitIds, optimisticLogs, logsByHabit, today]);

  // Find the current active habit in this chain
  const currentTarget = nodeStates.find((n) => n.isCurrentTarget);
  const isChainFullyCompleted = !chain.isSingle && nodeStates.every((n) => n.isDone);

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
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-surface/60 transition-colors text-left group select-none cursor-pointer border-none bg-transparent"
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2.5">
          <ChevronDown
            size={16}
            className={`text-muted transition-transform duration-200 ${
              isCollapsed ? "-rotate-90" : "rotate-0"
            }`}
          />
          <span className="text-xs font-semibold tracking-wider uppercase text-foreground/80 group-hover:text-foreground">
            {chain.isSingle
              ? `${t.views.standaloneTitle} (${chain.habits.length})`
              : `${chain.habits[0]?.name} → ... (${chain.habits.length})`}
          </span>
          {!chain.isSingle && isChainFullyCompleted && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/15 px-2 py-0.5 rounded-full border border-success/30">
              <Sparkles size={11} />
              <span>{t.views.chainCompleted}</span>
            </span>
          )}
        </div>

        <span className="text-[11px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
          {isCollapsed ? t.views.showTrack : t.views.hideTrack}
        </span>
      </button>

      {/* Responsive pipeline track: Horizontal scroll on desktop, vertical stack on mobile */}
      {!isCollapsed && (
        <div
          ref={scrollContainerRef}
          className={
            chain.isSingle
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 w-full"
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
                  onBump={(d) => onBump(node.habit, d)}
                  onOpenRunner={() => onOpenRunner(node.habit.id)}
                />

                {/* Connecting Arrow between chain nodes */}
                {!chain.isSingle && !isLast && (
                  <ChainConnector isPreviousDone={node.isDone} />
                )}
              </div>
            );
          })}
        </div>
      )}
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
  onBump: (delta: number) => void;
  onOpenRunner: () => void;
}) {
  const currentCount = log?.count ?? 0;
  const targetCount = habit.target_count ?? 1;
  const pct = Math.min(100, (currentCount / targetCount) * 100);

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
      className={`${
        isSingle ? "w-full" : "w-full max-w-sm md:w-64 lg:w-72 xl:w-80 shrink-0"
      } rounded-2xl border transition-all duration-300 p-4 relative overflow-hidden backdrop-blur-md bg-surface/90 dark:bg-zinc-900/90 ${cardBorderAndGlow}`}
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
      <div
        className={`min-w-0 ${isUnlocked ? "cursor-pointer" : "cursor-default"}`}
        onClick={() => isUnlocked && onOpenRunner()}
      >
        <p className="truncate text-[15px] font-semibold text-foreground group-hover:text-accent transition-colors">
          {habit.name}
        </p>
        {cat && (
          <p className="text-xs text-muted truncate mt-0.5">
            {cat.name}
          </p>
        )}
      </div>

      {/* Count Progress Bar if tracking count */}
      {habit.tracking_mode === "count" && (
        <ProgressBar value={pct} className="mt-3">
          <ProgressBar.Track>
            <ProgressBar.Fill style={{ background: habit.color, width: `${pct}%` }} />
          </ProgressBar.Track>
        </ProgressBar>
      )}

      {/* Interactive Action Controls (Only when unlocked) */}
      <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between gap-2">
        {!isUnlocked ? (
          <p className="text-[11px] text-muted flex items-center gap-1">
            <Lock size={12} className="shrink-0" />
            <span className="truncate">{t.views.lockedHint}</span>
          </p>
        ) : (
          <>
            {/* If count mode, show +/- buttons */}
            {habit.tracking_mode === "count" ? (
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

function ChainConnector({ isPreviousDone }: { isPreviousDone: boolean }) {
  return (
    <>
      {/* Horizontal connector on Desktop (md+) */}
      <div className="hidden md:flex items-center px-2 shrink-0 select-none pointer-events-none relative z-20">
        <div
          className={`h-[2px] w-6 md:w-8 transition-colors duration-300 ${
            isPreviousDone
              ? "bg-success shadow-[0_0_8px_rgba(22,163,74,0.7)]"
              : "bg-zinc-400 dark:bg-zinc-500"
          }`}
        />
        <ArrowRight
          size={18}
          strokeWidth={2.5}
          className={`-ml-1 transition-colors duration-300 ${
            isPreviousDone
              ? "text-success drop-shadow-[0_0_6px_rgba(22,163,74,0.5)]"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        />
      </div>

      {/* Vertical connector on Mobile (<md) */}
      <div className="flex md:hidden flex-col items-center py-2 shrink-0 select-none pointer-events-none relative z-20">
        <div
          className={`w-[2px] h-5 transition-colors duration-300 ${
            isPreviousDone
              ? "bg-success shadow-[0_0_8px_rgba(22,163,74,0.7)]"
              : "bg-zinc-400 dark:bg-zinc-500"
          }`}
        />
        <ArrowDown
          size={18}
          strokeWidth={2.5}
          className={`-mt-1 transition-colors duration-300 ${
            isPreviousDone
              ? "text-success drop-shadow-[0_0_6px_rgba(22,163,74,0.5)]"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        />
      </div>
    </>
  );
}
