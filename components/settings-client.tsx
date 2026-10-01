"use client";

import { useState, useTransition } from "react";
import { Pencil, User } from "lucide-react";
import { Button, Card, Input, Label, Modal, Spinner, TextField, toast, useOverlayState } from "@heroui/react";
import { useLang } from "@/components/language";
import { updateProfile, resetStreaks, deleteAccount } from "@/actions/account";

export function SettingsClient({ name, email }: { name: string | null; email: string | null }) {
  const { t } = useLang();
  const nameModal = useOverlayState();
  const [confirmReset, setConfirmReset] = useState(false);
  const [delText, setDelText] = useState("");

  const canDelete = delText.trim().toLowerCase() === t.settings.deletePhrase.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-2xl border-none bg-surface">
        <Card.Content className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <User size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{name ?? "—"}</p>
              <p className="truncate text-xs text-muted tabular-nums">{email}</p>
            </div>
            <Button isIconOnly variant="ghost" size="sm" aria-label={t.categories.edit} onPress={() => nameModal.open()}>
              <Pencil size={15} />
            </Button>
          </div>
        </Card.Content>
      </Card>

      <Modal state={nameModal}>
        <Modal.Backdrop className="bg-background/40 backdrop-blur-md">
          <Modal.Container placement="center">
            <Modal.Dialog className="sm:max-w-[360px]">
              <NameForm key={name ?? ""} current={name ?? ""} onDone={() => nameModal.close()} />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Card className="rounded-2xl border-none bg-surface">
        <Card.Content className="p-4">
          <p className="text-sm font-semibold text-danger">{t.settings.danger}</p>
          {!confirmReset ? (
            <Button variant="danger-soft" className="mt-3" onPress={() => setConfirmReset(true)}>{t.settings.resetTitle}</Button>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-sm text-muted">{t.settings.resetMsg}</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onPress={() => setConfirmReset(false)}>{t.del.cancel}</Button>
                <Button variant="danger" size="sm" onPress={async () => { await resetStreaks(); setConfirmReset(false); }}>{t.del.confirm}</Button>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">{t.settings.resetHint}</p>
          <div className="mt-4 border-t border-separator pt-4">
            <p className="text-sm font-semibold">{t.settings.deleteTitle}</p>
            <p className="mt-1 text-xs text-muted">{t.settings.deleteHint}</p>
            <TextField fullWidth name="del" value={delText} onChange={(v: string) => setDelText(v)} className="mt-2">
              <Label>{t.settings.deleteType(t.settings.deletePhrase)}</Label>
              <Input placeholder={t.settings.deletePh} spellCheck={false} />
            </TextField>
            <form action={async () => { await deleteAccount(); }} className="mt-2">
              <Button variant="danger" type="submit" isDisabled={!canDelete}>{t.settings.deleteTitle}</Button>
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
    <>
      <Modal.CloseTrigger />
      <Modal.Header>
        <Modal.Heading>{t.settings.profile}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <form action={handle} className="flex flex-col gap-3">
          <TextField fullWidth isRequired name="name" defaultValue={current} autoFocus>
            <Label>{t.settings.name}</Label>
            <Input autoComplete="name" maxLength={40} spellCheck={false} />
          </TextField>
          {error && (
            <p aria-live="polite" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button fullWidth variant="primary" type="submit" isDisabled={pending}>
            {pending ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" color="current" /> {t.settings.saving}
              </span>
            ) : (
              t.settings.save
            )}
          </Button>
        </form>
      </Modal.Body>
    </>
  );
}
