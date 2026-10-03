"use client";

import { useState, useTransition } from "react";
import { Pencil, User } from "lucide-react";
import { Button, Card, Input, Label, Spinner, TextField, toast, useOverlayState } from "@heroui/react";
import { useLang } from "@/components/language";
import { GlassModal } from "@/components/glass-modal";
import { updateProfile, resetStreaks, deleteAccount } from "@/actions/account";

export function SettingsClient({ name, email }: { name: string | null; email: string | null }) {
  const { t } = useLang();
  const nameModal = useOverlayState();
  const [confirmReset, setConfirmReset] = useState(false);
  const [delText, setDelText] = useState("");

  const canDelete = delText.trim().toLowerCase() === t.settings.deletePhrase.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      {/* Profile Card */}
      <Card className="rounded-2xl border border-white/20 dark:border-white/10 bg-surface/80 dark:bg-zinc-900/70 backdrop-blur-md shadow-xs">
        <Card.Content className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-xs">
              <User size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{name ?? "—"}</p>
              <p className="truncate text-xs text-muted tabular-nums">{email}</p>
            </div>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              aria-label={t.categories.edit}
              className="h-9 w-9 rounded-xl text-muted hover:text-foreground hover:bg-white/10 dark:hover:bg-white/5"
              onPress={() => nameModal.open()}
            >
              <Pencil size={15} />
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* Edit Profile Modal */}
      <GlassModal
        state={nameModal}
        title={t.settings.profile}
        icon={<User size={18} className="text-accent" />}
        maxWidth="sm"
      >
        <NameForm key={name ?? ""} current={name ?? ""} onDone={() => nameModal.close()} />
      </GlassModal>

      {/* Danger Zone Card */}
      <Card className="rounded-2xl border border-danger/30 bg-danger/5 backdrop-blur-md shadow-xs">
        <Card.Content className="p-5">
          <p className="text-sm font-semibold text-danger">{t.settings.danger}</p>
          {!confirmReset ? (
            <Button
              variant="danger-soft"
              className="mt-3 rounded-xl"
              onPress={() => setConfirmReset(true)}
            >
              {t.settings.resetTitle}
            </Button>
          ) : (
            <div className="mt-3 flex flex-col gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20">
              <p className="text-xs text-foreground font-medium">{t.settings.resetMsg}</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="rounded-lg" onPress={() => setConfirmReset(false)}>
                  {t.del.cancel}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="rounded-lg"
                  onPress={async () => {
                    await resetStreaks();
                    setConfirmReset(false);
                  }}
                >
                  {t.del.confirm}
                </Button>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">{t.settings.resetHint}</p>
          <div className="mt-4 border-t border-danger/20 pt-4">
            <p className="text-sm font-semibold text-foreground">{t.settings.deleteTitle}</p>
            <p className="mt-1 text-xs text-muted">{t.settings.deleteHint}</p>
            <TextField fullWidth name="del" value={delText} onChange={(v: string) => setDelText(v)} className="mt-3">
              <Label>{t.settings.deleteType(t.settings.deletePhrase)}</Label>
              <Input
                placeholder={t.settings.deletePh}
                spellCheck={false}
                className="mt-1 rounded-xl bg-surface/50 dark:bg-zinc-900/50 border-border/60"
              />
            </TextField>
            <form action={async () => { await deleteAccount(); }} className="mt-3">
              <Button
                variant="danger"
                type="submit"
                className="rounded-xl"
                isDisabled={!canDelete}
              >
                {t.settings.deleteTitle}
              </Button>
            </form>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

function NameForm({ current, onDone }: { current: string; onDone: () => void }) {
  const { t } = useLang();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handle(fd: FormData) {
    startTransition(async () => {
      setError(undefined);
      const res = await updateProfile(fd);
      if (res?.error) setError(res.error === "needName" ? t.errors.needName : t.errors.saveFail);
      else {
        toast.success(t.settings.saved);
        onDone();
      }
    });
  }

  return (
    <form action={handle} className="flex flex-col gap-4">
      <TextField fullWidth isRequired name="name" defaultValue={current} autoFocus>
        <Label className="text-xs font-semibold">{t.settings.name}</Label>
        <Input
          autoComplete="name"
          maxLength={40}
          spellCheck={false}
          className="mt-1 rounded-xl glass-input"
        />
      </TextField>
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
              <Spinner size="sm" color="current" /> {t.settings.saving}
            </span>
          ) : (
            t.settings.save
          )}
        </Button>
      </div>
    </form>
  );
}
