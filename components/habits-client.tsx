"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Label, Modal, Spinner, TextField, toast, useOverlayState } from "@heroui/react";
import { Pencil, Plus } from "lucide-react";
import { useLang } from "@/components/language";
import { CategoryIcon } from "@/components/category-icon";
import { HabitForm } from "@/components/habit-form";
import { IconPicker } from "@/components/icon-picker";
import { ColorPicker } from "@/components/color-picker";
import { DeleteModal } from "@/components/delete-modal";
import { Stagger, StaggerItem, FadeIn } from "@/components/animated";
import { StreakBadge } from "@/components/streak-badge";
import type { Habit, HabitCategory } from "@/lib/types";
import type { Streak } from "@/lib/streak";
import { deleteHabit } from "@/actions/habits";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";

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
  const createModal = useOverlayState();
  const editModal = useOverlayState();
  const catCreateModal = useOverlayState();
  const catEditModal = useOverlayState();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [editingCat, setEditingCat] = useState<HabitCategory | null>(null);
  const [formKey, setFormKey] = useState(0);

  function openEdit(h: Habit) {
    setEditing(h);
    editModal.open();
  }

  function openCatEdit(c: HabitCategory) {
    setEditingCat(c);
    catEditModal.open();
  }

  return (
    <div className="flex flex-col gap-5">
      <FadeIn className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.habit.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.habit.subtitle}</p>
        </div>
        <Button variant="primary" onPress={() => createModal.open()}>
          <span className="flex items-center gap-1.5"><Plus size={16} />{t.habit.new}</span>
        </Button>
      </FadeIn>

      {habits.length === 0 ? (
        <Card className="rounded-2xl border-none bg-surface">
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
                <Card className="rounded-2xl border-none bg-surface">
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
                  </Card.Content>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <Card className="rounded-2xl border-none bg-surface">
        <Card.Content className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t.categories.title}</p>
            <Button size="sm" variant="ghost" onPress={() => catCreateModal.open()}>
              <span className="flex items-center gap-1"><Plus size={14} />{t.categories.new}</span>
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: c.color + "40", color: c.color }}>
                  <CategoryIcon icon={c.icon} size={15} />
                </span>
                <span className="flex-1 truncate">{c.name}</span>
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

      <Modal state={createModal}>
        <Modal.Backdrop className="bg-background/40 backdrop-blur-md">
          <Modal.Container placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t.habit.new}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <HabitForm
                  key={formKey}
                  categories={categories}
                  habits={habits}
                  onDone={() => {
                    createModal.close();
                    setFormKey((k) => k + 1);
                  }}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={editModal}>
        <Modal.Backdrop className="bg-background/40 backdrop-blur-md">
          <Modal.Container placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t.habit.edit}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {editing && (
                  <HabitForm
                    key={editing.id}
                    categories={categories}
                    habits={habits}
                    initial={editing}
                    onDone={() => editModal.close()}
                  />
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={catCreateModal}>
        <Modal.Backdrop className="bg-background/40 backdrop-blur-md">
          <Modal.Container placement="center">
            <Modal.Dialog className="sm:max-w-[360px]">
              <CategoryCreateForm
                key={formKey}
                defaultColor={categories[0]?.color ?? "#64748B"}
                onDone={() => {
                  catCreateModal.close();
                  setFormKey((k) => k + 1);
                }}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={catEditModal}>
        <Modal.Backdrop className="bg-background/40 backdrop-blur-md">
          <Modal.Container placement="center">
            <Modal.Dialog className="sm:max-w-[360px]">
              {editingCat && (
                <CategoryEditForm
                  key={editingCat.id}
                  category={editingCat}
                  onDone={() => catEditModal.close()}
                />
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
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
    <>
      <Modal.CloseTrigger />
      <Modal.Header>
        <Modal.Heading>{t.categories.new}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <form action={handle} className="flex flex-col gap-3">
          <TextField fullWidth isRequired name="name" autoFocus>
            <Label>{t.categories.name}</Label>
            <Input placeholder={t.categories.newPh} maxLength={30} autoComplete="off" spellCheck={false} />
          </TextField>
          <IconPicker label={t.categories.icon} />
          <ColorPicker label={t.habit.color} defaultValue={defaultColor} />
          {error && (
            <p aria-live="polite" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button fullWidth variant="primary" type="submit" isDisabled={pending}>
            {pending ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" color="current" /> {t.categories.saving}
              </span>
            ) : (
              t.categories.add
            )}
          </Button>
        </form>
      </Modal.Body>
    </>
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
    <>
      <Modal.CloseTrigger />
      <Modal.Header>
        <Modal.Heading>
          {t.categories.edit} “{category.name}”
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <form action={handle} className="flex flex-col gap-3">
          <TextField fullWidth isRequired name="name" defaultValue={category.name} autoFocus>
            <Label>{t.categories.name}</Label>
            <Input maxLength={30} autoComplete="off" spellCheck={false} />
          </TextField>
          <IconPicker label={t.categories.icon} defaultValue={category.icon} />
          <ColorPicker label={t.habit.color} defaultValue={category.color} />
          {error && (
            <p aria-live="polite" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button fullWidth variant="primary" type="submit" isDisabled={pending}>
            {pending ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" color="current" /> {t.categories.saving}
              </span>
            ) : (
              t.categories.save
            )}
          </Button>
        </form>
      </Modal.Body>
    </>
  );
}
