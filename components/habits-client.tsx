"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Spinner, TextField, toast, useOverlayState } from "@heroui/react";
import { Clock, Eye, Filter, FolderPlus, Layers, Pencil, Plus, Search, Workflow, X } from "lucide-react";
import { useLang } from "@/components/language";
import { GlassModal } from "@/components/glass-modal";
import { CategoryIcon } from "@/components/category-icon";
import { HabitForm } from "@/components/habit-form";
import { IconPicker } from "@/components/icon-picker";
import { ColorPicker } from "@/components/color-picker";
import { DeleteModal } from "@/components/delete-modal";
import { Stagger, StaggerItem, FadeIn } from "@/components/animated";
import { StreakBadge } from "@/components/streak-badge";
import { ChainPipelineModal } from "@/components/chain-pipeline-modal";
import { ChainEditModal } from "@/components/chain-edit-modal";
import { buildHabitChains, computeChainStats } from "@/lib/chains";
import type { Habit, HabitCategory, HabitChain, HabitLog } from "@/lib/types";
import type { Streak } from "@/lib/streak";
import { deleteHabit } from "@/actions/habits";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";

function formatChainTime(timeVal: string | null | undefined, t: ReturnType<typeof useLang>["t"]) {
  if (!timeVal) return null;
  if (timeVal === "morning") return `🌅 ${t.views.morning}`;
  if (timeVal === "afternoon") return `☀️ ${t.views.afternoon}`;
  if (timeVal === "night") return `🌙 ${t.views.night}`;
  if (timeVal === "anytime") return t.views.anytime;
  return `⏰ ${timeVal}`;
}

type Props = {
  habits: Habit[];
  categories: HabitCategory[];
  streaks: Record<string, Streak>;
  logsByHabit?: Map<string, Map<string, HabitLog>>;
  today?: string;
};

export function HabitsClient({
  habits,
  categories,
  streaks,
  logsByHabit = new Map(),
  today = new Date().toISOString().slice(0, 10),
}: Props) {
  const { t } = useLang();
  const router = useRouter();
  const createModal = useOverlayState();
  const editModal = useOverlayState();
  const catCreateModal = useOverlayState();
  const catEditModal = useOverlayState();

  const [activeTab, setActiveTab] = useState<"habits" | "chains">("habits");
  const [editing, setEditing] = useState<Habit | null>(null);
  const [editingCat, setEditingCat] = useState<HabitCategory | null>(null);
  const [previewChain, setPreviewChain] = useState<HabitChain | null>(null);
  const [editingChain, setEditingChain] = useState<HabitChain | null>(null);
  const [formKey, setFormKey] = useState(0);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "build" | "avoid">("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");

  // Build all habit chains
  const chains = useMemo(() => buildHabitChains(habits), [habits]);

  // Filtered habits
  const filteredHabits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return habits.filter((h) => {
      if (q && !h.name.toLowerCase().includes(q)) return false;
      if (catFilter !== "all" && h.category_id !== catFilter) return false;
      if (typeFilter !== "all" && h.type !== typeFilter) return false;
      return true;
    });
  }, [habits, searchQuery, catFilter, typeFilter]);

  // Filtered chains
  const filteredChains = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return chains.filter((c) => {
      if (q) {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesHabit = c.habits.some((h) => h.name.toLowerCase().includes(q));
        if (!matchesName && !matchesHabit) return false;
      }
      if (timeFilter !== "all") {
        if (timeFilter === "custom") {
          if (!c.time || ["morning", "afternoon", "night", "anytime"].includes(c.time)) {
            return false;
          }
        } else if (c.time !== timeFilter) {
          return false;
        }
      }
      return true;
    });
  }, [chains, searchQuery, timeFilter]);

  function openEdit(h: Habit) {
    setEditing(h);
    editModal.open();
  }

  function openCatEdit(c: HabitCategory) {
    setEditingCat(c);
    catEditModal.open();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <FadeIn className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.habit.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.habit.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onPress={() => createModal.open()}>
            <span className="flex items-center gap-1.5">
              <Plus size={16} />
              {t.habit.new}
            </span>
          </Button>
        </div>
      </FadeIn>

      {/* Tabs & Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/40">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-surface/60 dark:bg-zinc-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 w-fit shadow-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("habits");
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "habits"
                ? "bg-accent text-accent-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Layers size={14} />
            <span>{t.views.tabHabits}</span>
            <span className="text-[11px] opacity-80 font-normal tabular-nums">({habits.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("chains");
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "chains"
                ? "bg-accent text-accent-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Workflow size={14} />
            <span>{t.views.tabChains}</span>
            <span className="text-[11px] opacity-80 font-normal tabular-nums">({chains.length})</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "habits"
                ? `${t.common?.search || "Buscar"} ${t.views.tabHabits.toLowerCase()}…`
                : `${t.common?.search || "Buscar"} ${t.views.tabChains.toLowerCase()}…`
            }
            className="w-full h-9 pl-9 pr-8 text-xs rounded-xl bg-surface/50 dark:bg-zinc-900/50 backdrop-blur-md border border-white/20 dark:border-white/10 text-foreground placeholder:text-muted focus:border-accent outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Filters */}
      {activeTab === "habits" ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted flex items-center gap-1 mr-1">
            <Filter size={12} />
            <span>{t.views?.filter || "Filtros"}:</span>
          </span>

          {/* Type Filter */}
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium transition cursor-pointer backdrop-blur-sm ${
              typeFilter === "all"
                ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                : "bg-surface/60 dark:bg-zinc-900/60 text-muted hover:text-foreground border border-white/10 dark:border-white/5"
            }`}
          >
            {t.common?.all || "Todos"}
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("build")}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium transition cursor-pointer backdrop-blur-sm ${
              typeFilter === "build"
                ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                : "bg-surface/60 dark:bg-zinc-900/60 text-muted hover:text-foreground border border-white/10 dark:border-white/5"
            }`}
          >
            {t.habit.build}
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("avoid")}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium transition cursor-pointer backdrop-blur-sm ${
              typeFilter === "avoid"
                ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                : "bg-surface/60 dark:bg-zinc-900/60 text-muted hover:text-foreground border border-white/10 dark:border-white/5"
            }`}
          >
            {t.habit.avoid}
          </button>

          {/* Category Filter Chips */}
          <div className="h-4 w-[1px] bg-border/40 mx-1 hidden sm:block" />
          <button
            type="button"
            onClick={() => setCatFilter("all")}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium transition cursor-pointer backdrop-blur-sm ${
              catFilter === "all"
                ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                : "bg-surface/60 dark:bg-zinc-900/60 text-muted hover:text-foreground border border-white/10 dark:border-white/5"
            }`}
          >
            {t.categories.title} ({t.common?.all || "Todas"})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatFilter(catFilter === c.id ? "all" : c.id)}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer backdrop-blur-sm ${
                catFilter === c.id
                  ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                  : "bg-surface/60 dark:bg-zinc-900/60 text-muted hover:text-foreground border border-white/10 dark:border-white/5"
              }`}
            >
              <span style={{ color: c.color }}>
                <CategoryIcon icon={c.icon} size={12} />
              </span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted flex items-center gap-1 mr-1">
            <Filter size={12} />
            <span>{t.views.timeSlot}:</span>
          </span>
          {[
            { id: "all", label: t.common?.all || "Todas" },
            { id: "morning", label: `🌅 ${t.views.morning}` },
            { id: "afternoon", label: `☀️ ${t.views.afternoon}` },
            { id: "night", label: `🌙 ${t.views.night}` },
            { id: "anytime", label: t.views.anytime },
            { id: "custom", label: `⏰ ${t.views.customTime}` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTimeFilter(item.id)}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition cursor-pointer backdrop-blur-sm ${
                timeFilter === item.id
                  ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                  : "bg-surface/60 dark:bg-zinc-900/60 text-muted hover:text-foreground border border-white/10 dark:border-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab 1: Hábitos individuales */}
      {activeTab === "habits" && (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          {/* Main Habits List */}
          <div className="flex-1 min-w-0 flex flex-col gap-3 w-full">
            {filteredHabits.length === 0 ? (
              <Card className="rounded-2xl bg-surface">
                <Card.Content className="p-8 text-center">
                  <p className="text-4xl" aria-hidden>○</p>
                  <p className="mt-2 font-medium">{t.habit.emptyTitle}</p>
                  <p className="mt-1 text-sm text-muted">{t.habit.emptySub}</p>
                </Card.Content>
              </Card>
            ) : (
              <Stagger key={filteredHabits.map((h) => h.id).join(",")} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredHabits.map((h) => {
                  const cat = categories.find((c) => c.id === h.category_id);
                  return (
                    <StaggerItem key={h.id} className="h-full">
                      <Card className="rounded-2xl bg-surface h-full border border-border/50 hover:border-border/80 transition-all">
                        <Card.Content className="p-4 flex flex-col justify-between h-full">
                          <div className="flex items-start gap-3">
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                              style={{ backgroundColor: h.color + "30", color: h.color }}
                            >
                              <CategoryIcon icon={cat?.icon ?? "other"} size={19} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold">{h.name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-muted">{h.type === "build" ? t.habit.build : t.habit.avoid}</span>
                                {h.counters && h.counters.length > 0 ? (
                                  <span className="text-xs text-muted tabular-nums">
                                    · {h.counters.length} {t.habit.multiCounter.toLowerCase()}
                                  </span>
                                ) : h.tracking_mode === "count" ? (
                                  <span className="text-xs text-muted tabular-nums">
                                    · {t.habit.counter} {h.target_count}{h.unit ? ` ${h.unit}` : ""}
                                  </span>
                                ) : null}
                              </div>
                              {streaks[h.id] && (
                                <div className="mt-2">
                                  <StreakBadge streak={streaks[h.id]} kind={h.type} />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button isIconOnly variant="ghost" size="sm" aria-label={t.categories.edit} onPress={() => openEdit(h)}>
                                <Pencil size={15} />
                              </Button>
                              <DeleteModal
                                title={t.del.titleHabit}
                                message={h.name}
                                ariaLabel={t.del.titleHabit}
                                onConfirm={async () => { await deleteHabit(h.id); }}
                              />
                            </div>
                          </div>
                        </Card.Content>
                      </Card>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            )}
          </div>

          {/* Sidebar: Categories Management */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-24">
            <Card className="rounded-2xl bg-surface border border-border/50">
              <Card.Content className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{t.categories.title}</p>
                  <Button size="sm" variant="ghost" onPress={() => catCreateModal.open()}>
                    <span className="flex items-center gap-1"><Plus size={14} />{t.categories.new}</span>
                  </Button>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {categories.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm p-1.5 rounded-xl hover:bg-default/10 transition-colors">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: c.color + "30", color: c.color }}>
                        <CategoryIcon icon={c.icon} size={15} />
                      </span>
                      <span className="flex-1 truncate font-medium">{c.name}</span>
                      <Button isIconOnly variant="ghost" size="sm" aria-label={`${t.categories.edit} ${c.name}`} onPress={() => openCatEdit(c)}>
                        <Pencil size={13} />
                      </Button>
                      <DeleteModal
                        title={t.del.titleCategory}
                        message={t.categories.delConfirm(c.name)}
                        ariaLabel={t.categories.delLabel(c.name)}
                        onConfirm={async () => { await deleteCategory(c.id); }}
                      />
                    </div>
                  ))}
                  {categories.length === 0 && <p className="text-sm text-muted">{t.categories.empty}</p>}
                </div>
              </Card.Content>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Cadenas de hábitos */}
      {activeTab === "chains" && (
        <div className="flex flex-col gap-4 w-full">
          {filteredChains.length === 0 ? (
            <Card className="rounded-2xl bg-surface border border-border/50">
              <Card.Content className="p-10 text-center flex flex-col items-center justify-center gap-2">
                <Workflow size={36} className="text-muted/60" />
                <p className="font-semibold text-foreground text-base">
                  {chains.length === 0 ? t.views.emptyChainsTitle : t.views.emptyChainsFilter}
                </p>
                <p className="text-xs text-muted max-w-md">
                  {chains.length === 0 ? t.views.emptyChainsSub : t.views.emptyChainsFilterSub}
                </p>
              </Card.Content>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredChains.map((chain) => {
                const stats = computeChainStats(chain, logsByHabit, today);

                return (
                  <Card
                    key={chain.id}
                    className="rounded-2xl bg-surface border border-border/50 hover:border-accent/40 transition-all flex flex-col justify-between"
                  >
                    <Card.Content className="p-5 flex flex-col gap-4">
                      {/* Card Header: Chain Name, Time Slot, and Edit action */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base text-foreground truncate">{chain.name}</h3>
                            {chain.time && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">
                                <Clock size={11} />
                                <span>{formatChainTime(chain.time, t)}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted">
                            {chain.habits.length} {t.views.chainProgress}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            aria-label={t.views.editChain}
                            className="h-8 w-8 text-muted hover:text-foreground rounded-lg"
                            onPress={() => setEditingChain(chain)}
                          >
                            <Pencil size={14} />
                          </Button>
                        </div>
                      </div>

                      {/* Stats Row: Chain streak and 30d compliance */}
                      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/30">
                        <StreakBadge streak={stats.streak} kind="build" />
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-default/20 text-foreground tabular-nums">
                          {stats.rate30d}% {t.reports.complianceRate} (30d)
                        </span>
                      </div>

                      {/* Connected Habits Flow Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap py-1">
                        {chain.habits.map((h, i) => {
                          const cat = categories.find((c) => c.id === h.category_id);
                          return (
                            <div key={h.id} className="flex items-center gap-1.5">
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-xl border border-border/40 bg-surface/80"
                                style={{ borderLeftColor: h.color, borderLeftWidth: 3 }}
                              >
                                <span style={{ color: h.color }}>
                                  <CategoryIcon icon={cat?.icon ?? "other"} size={13} />
                                </span>
                                <span className="truncate max-w-[120px]">{h.name}</span>
                              </span>
                              {i < chain.habits.length - 1 && (
                                <span className="text-muted text-xs">→</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* View Pipeline Modal Trigger */}
                      <div className="pt-2 border-t border-border/30 flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs font-medium"
                          onPress={() => setPreviewChain(chain)}
                        >
                          <Eye size={13} className="mr-1.5" />
                          <span>{t.views.viewPipeline}</span>
                        </Button>
                      </div>
                    </Card.Content>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Read-only Chain Pipeline Modal */}
      {previewChain && (
        <ChainPipelineModal
          isOpen={!!previewChain}
          onClose={() => setPreviewChain(null)}
          chainName={previewChain.name}
          chainTime={previewChain.time}
          habits={previewChain.habits}
          categories={categories}
        />
      )}

      {/* Chain Edit Modal */}
      {editingChain && (
        <ChainEditModal
          isOpen={!!editingChain}
          onClose={() => setEditingChain(null)}
          headHabitId={editingChain.headId}
          initialName={editingChain.name.endsWith("→ ...") ? "" : editingChain.name}
          initialTime={editingChain.time}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* Modal: New Habit */}
      <GlassModal
        state={createModal}
        title={t.habit.new}
        maxWidth="lg"
      >
        <HabitForm
          key={formKey}
          categories={categories}
          habits={habits}
          onDone={() => {
            createModal.close();
            setFormKey((k) => k + 1);
          }}
        />
      </GlassModal>

      {/* Modal: Edit Habit */}
      <GlassModal
        state={editModal}
        title={t.habit.edit}
        maxWidth="lg"
      >
        {editing && (
          <HabitForm
            key={editing.id}
            categories={categories}
            habits={habits}
            initial={editing}
            onDone={() => editModal.close()}
          />
        )}
      </GlassModal>

      {/* Modal: New Category */}
      <GlassModal
        state={catCreateModal}
        title={t.categories.new}
        icon={<FolderPlus size={18} className="text-accent" />}
        maxWidth="sm"
      >
        <CategoryCreateForm
          key={formKey}
          defaultColor={categories[0]?.color ?? "#64748B"}
          onDone={() => {
            catCreateModal.close();
            setFormKey((k) => k + 1);
          }}
        />
      </GlassModal>

      {/* Modal: Edit Category */}
      <GlassModal
        state={catEditModal}
        title={`${t.categories.edit} “${editingCat?.name}”`}
        icon={<Pencil size={18} className="text-accent" />}
        maxWidth="sm"
      >
        {editingCat && (
          <CategoryEditForm
            key={editingCat.id}
            category={editingCat}
            onDone={() => catEditModal.close()}
          />
        )}
      </GlassModal>
    </div>
  );
}

function CategoryCreateForm({ defaultColor, onDone }: { defaultColor: string; onDone: () => void }) {
  const { t } = useLang();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handle(fd: FormData) {
    startTransition(async () => {
      setError(undefined);
      const res = await createCategory(fd);
      if (res?.error) setError(res.error === "catExists" ? t.errors.catExists : t.errors.saveFail);
      else {
        toast.success(t.toasts.categorySaved);
        onDone();
      }
    });
  }

  return (
    <form action={handle} className="flex flex-col gap-4">
      <TextField fullWidth isRequired name="name" autoFocus>
        <Label className="text-xs font-semibold">{t.categories.name}</Label>
        <Input
          placeholder={t.categories.newPh}
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          className="mt-1 rounded-xl glass-input"
        />
      </TextField>
      <IconPicker label={t.categories.icon} />
      <ColorPicker label={t.habit.color} defaultValue={defaultColor} />
      {error && (
        <p aria-live="polite" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="pt-2 flex justify-end">
        <Button
          fullWidth
          variant="primary"
          type="submit"
          isDisabled={pending}
          className="rounded-xl shadow-xs font-semibold"
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" color="current" /> {t.categories.saving}
            </span>
          ) : (
            t.categories.add
          )}
        </Button>
      </div>
    </form>
  );
}

function CategoryEditForm({ category, onDone }: { category: HabitCategory; onDone: () => void }) {
  const { t } = useLang();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handle(fd: FormData) {
    startTransition(async () => {
      setError(undefined);
      const res = await updateCategory(category.id, fd);
      if (res?.error) setError(res.error === "catExists" ? t.errors.catExists : t.errors.saveFail);
      else {
        toast.success(t.categories.updated);
        onDone();
      }
    });
  }

  return (
    <form action={handle} className="flex flex-col gap-4">
      <TextField fullWidth isRequired name="name" defaultValue={category.name} autoFocus>
        <Label className="text-xs font-semibold">{t.categories.name}</Label>
        <Input
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          className="mt-1 rounded-xl glass-input"
        />
      </TextField>
      <IconPicker label={t.categories.icon} defaultValue={category.icon} />
      <ColorPicker label={t.habit.color} defaultValue={category.color} />
      {error && (
        <p aria-live="polite" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="pt-2 flex justify-end">
        <Button
          fullWidth
          variant="primary"
          type="submit"
          isDisabled={pending}
          className="rounded-xl shadow-xs font-semibold"
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" color="current" /> {t.categories.saving}
            </span>
          ) : (
            t.categories.save
          )}
        </Button>
      </div>
    </form>
  );
}
