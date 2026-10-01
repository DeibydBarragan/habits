"use client";

import { useState } from "react";
import { Button, Card, Modal, useOverlayState } from "@heroui/react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useLang } from "@/components/language";
import { CategoryIcon } from "@/components/category-icon";
import { HabitForm, CategoryQuickForm } from "@/components/habit-form";
import { Stagger, StaggerItem, FadeIn } from "@/components/animated";
import { StreakBadge } from "@/components/streak-badge";
import type { Habit, HabitCategory } from "@/lib/types";
import type { Streak } from "@/lib/streak";
import { deleteHabit } from "@/actions/habits";
import { deleteCategory } from "@/actions/categories";

export function HabitsClient({
  habits,
  categories,
  streaks,
}: {
  habits: Habit[];
  categories: HabitCategory[];
  streaks: Record<string, Streak>;
}) {
  const { t } = useLang();
  const createState = useOverlayState();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catDeleting, setCatDeleting] = useState<HabitCategory | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <FadeIn className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.habit.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.habit.subtitle}</p>
        </div>
        <Button variant="primary" onPress={() => createState.open()}>
          <span className="flex items-center gap-1.5"><Plus size={16} />{t.habit.new}</span>
        </Button>
      </FadeIn>

      {habits.length === 0 ? (
        <Card>
          <Card.Content className="p-8 text-center">
            <p className="text-4xl" aria-hidden>○</p>
            <p className="mt-2 font-medium">{t.habit.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.habit.emptySub}</p>
          </Card.Content>
        </Card>
      ) : (
        <Stagger key={habits.map((h) => h.id).join(",")} className="flex flex-col gap-2">
          {habits.map((h) => {
            const cat = categories.find((c) => c.id === h.category_id);
            return (
              <StaggerItem key={h.id}>
                <Card>
                  <Card.Content className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: h.color + "40", color: h.color }}>
                        <CategoryIcon icon={cat?.icon ?? "other"} size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">{h.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted">{h.type === "build" ? t.habit.build : t.habit.avoid}</span>
                          {h.tracking_mode === "count" && <span className="text-xs text-muted tabular-nums">· {t.habit.counter} {h.target_count}{h.unit ? ` ${h.unit}` : ""}</span>}
                          {streaks[h.id] && <StreakBadge streak={streaks[h.id]} kind={h.type} />}
                        </div>
                      </div>
                      <Button isIconOnly variant="ghost" size="sm" aria-label={t.categories.edit} onPress={() => setEditing(h)}>
                        <Pencil size={15} />
                      </Button>
                      <Button isIconOnly variant="ghost" size="sm" aria-label={t.del.titleHabit} onPress={() => setDeleting(h)}>
                        <X size={16} />
                      </Button>
                    </div>
                  </Card.Content>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <Card>
        <Card.Content className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t.categories.title}</p>
            <Button size="sm" variant="ghost" onPress={() => setShowCatForm((v) => !v)}>{t.categories.new}</Button>
          </div>
          {showCatForm && <div className="mt-3"><CategoryQuickForm onDone={() => setShowCatForm(false)} /></div>}
          <div className="mt-3 flex flex-col gap-1.5">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: c.color + "40", color: c.color }}>
                  <CategoryIcon icon={c.icon} size={15} />
                </span>
                <span className="flex-1 truncate">{c.name}</span>
                <Button isIconOnly variant="ghost" size="sm" aria-label={t.categories.delLabel(c.name)} onPress={() => setCatDeleting(c)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-muted">{t.categories.empty}</p>}
          </div>
        </Card.Content>
      </Card>

      <Modal state={createState}>
        <Modal.Backdrop />
        <Modal.Container placement="center">
          <Modal.Dialog>
            {({ close }) => (
              <div className="flex flex-col gap-4">
                <Modal.Header><Modal.Heading>{t.habit.new}</Modal.Heading><Modal.CloseTrigger /></Modal.Header>
                <Modal.Body><HabitForm categories={categories} habits={habits} onDone={() => close()} /></Modal.Body>
              </div>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal>

      <Modal state={{ isOpen: !!editing, setOpen: (v: boolean) => { if (!v) setEditing(null); } } as any}>
        <Modal.Backdrop />
        <Modal.Container placement="center">
          <Modal.Dialog>
            {({ close }) => editing ? (
              <div className="flex flex-col gap-4">
                <Modal.Header><Modal.Heading>{t.habit.edit}</Modal.Heading><Modal.CloseTrigger /></Modal.Header>
                <Modal.Body><HabitForm categories={categories} habits={habits} initial={editing} onDone={() => { setEditing(null); close(); }} /></Modal.Body>
              </div>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal>

      <Modal state={{ isOpen: !!deleting, setOpen: (v: boolean) => { if (!v) setDeleting(null); } } as any}>
        <Modal.Backdrop />
        <Modal.Container placement="center">
          <Modal.Dialog>
            {({ close }) => (
              <div className="flex flex-col gap-4">
                <Modal.Header><Modal.Heading>{t.del.titleHabit}</Modal.Heading><Modal.CloseTrigger /></Modal.Header>
                <Modal.Body><p className="text-sm text-muted">{deleting?.name}</p></Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={() => { setDeleting(null); close(); }}>{t.del.cancel}</Button>
                  <Button variant="danger" onPress={async () => { if (deleting) await deleteHabit(deleting.id); setDeleting(null); close(); }}>{t.del.confirm}</Button>
                </Modal.Footer>
              </div>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal>

      <Modal state={{ isOpen: !!catDeleting, setOpen: (v: boolean) => { if (!v) setCatDeleting(null); } } as any}>
        <Modal.Backdrop />
        <Modal.Container placement="center">
          <Modal.Dialog>
            {({ close }) => (
              <div className="flex flex-col gap-4">
                <Modal.Header><Modal.Heading>{t.del.titleCategory}</Modal.Heading><Modal.CloseTrigger /></Modal.Header>
                <Modal.Body><p className="text-sm text-muted">{catDeleting && t.categories.delConfirm(catDeleting.name)}</p></Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={() => { setCatDeleting(null); close(); }}>{t.del.cancel}</Button>
                  <Button variant="danger" onPress={async () => { if (catDeleting) await deleteCategory(catDeleting.id); setCatDeleting(null); close(); }}>{t.del.confirm}</Button>
                </Modal.Footer>
              </div>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </div>
  );
}
