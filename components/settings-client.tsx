"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Label, Spinner, TextField } from "@heroui/react";
import { useLang } from "@/components/language";
import { updateProfile, resetStreaks, deleteAccount } from "@/actions/account";

export function SettingsClient({ name, email }: { name: string | null; email: string | null }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [delText, setDelText] = useState("");

  function save(fd: FormData) {
    startTransition(async () => {
      setSaved(false);
      const res = await updateProfile(fd);
      if (!res?.error) setSaved(true);
    });
  }

  const canDelete = delText.trim().toLowerCase() === t.settings.deletePhrase.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Card.Content className="p-4">
          <p className="mb-3 text-sm font-semibold">{t.settings.profile}</p>
          <form action={save} className="flex flex-col gap-3">
            <TextField fullWidth name="name" defaultValue={name ?? ""}>
              <Label>{t.settings.name}</Label>
              <Input autoComplete="name" spellCheck={false} />
            </TextField>
            <p className="text-xs text-muted tabular-nums">{t.settings.email}: {email}</p>
            {saved && <p aria-live="polite" className="text-sm text-success">{t.settings.saved}</p>}
            <Button variant="primary" type="submit" isDisabled={pending}>
              {pending ? <span className="flex items-center gap-2"><Spinner size="sm" color="current" />{t.settings.saving}</span> : t.settings.save}
            </Button>
          </form>
        </Card.Content>
      </Card>

      <Card>
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
