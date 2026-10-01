"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Description,
  Input,
  Label,
  Spinner,
  TextField,
} from "@heroui/react";
import { signIn, signUp, signInWithGoogle } from "@/actions/auth";
import { useLang } from "@/components/language";

export function LoginForm() {
  const { t } = useLang();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handle(fd: FormData) {
    startTransition(async () => {
      setError(undefined);
      const res = await signIn(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={handle} className="flex flex-col gap-4">
        <TextField fullWidth isRequired name="email" type="email">
          <Label>{t.login.email}</Label>
          <Input placeholder="tu@correo.com" autoComplete="email" spellCheck={false} />
        </TextField>
        <TextField fullWidth isRequired name="password" type="password">
          <Label>{t.login.password}</Label>
          <Input placeholder="••••••••" autoComplete="current-password" />
        </TextField>
        {error && (
          <p aria-live="polite" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button fullWidth variant="primary" type="submit" isDisabled={pending}>
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" color="current" /> {t.login.signingIn}
            </span>
          ) : (
            t.login.signIn
          )}
        </Button>
      </form>
      <GoogleButton />
    </div>
  );
}

export function RegisterForm() {
  const { t } = useLang();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handle(fd: FormData) {
    startTransition(async () => {
      setError(undefined);
      const res = await signUp(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={handle} className="flex flex-col gap-4">
        <TextField fullWidth name="name">
          <Label>{t.register.name}</Label>
          <Input placeholder={t.register.namePh} autoComplete="name" />
        </TextField>
        <TextField fullWidth isRequired name="email" type="email">
          <Label>{t.register.email}</Label>
          <Input placeholder="tu@correo.com" autoComplete="email" spellCheck={false} />
        </TextField>
        <TextField fullWidth isRequired name="password" type="password">
          <Label>{t.register.password}</Label>
          <Input placeholder={t.register.passPh} autoComplete="new-password" />
          <Description>{t.register.passHint}</Description>
        </TextField>
        {error && (
          <p aria-live="polite" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button fullWidth variant="primary" type="submit" isDisabled={pending}>
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" color="current" /> {t.register.creating}
            </span>
          ) : (
            t.register.create
          )}
        </Button>
      </form>
      <GoogleButton label={t.login.google} />
    </div>
  );
}

function GoogleButton({ label }: { label?: string }) {
  const { t } = useLang();
  const text = label ?? t.login.google;
  return (
    <form action={signInWithGoogle}>
      <Button fullWidth variant="outline" type="submit">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.4 7.5 24 12 24z" />
          <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.5-2.7-.1.1C.5 8.7 0 10.3 0 12s.5 3.3 1.5 4.8l3.7-2.4z" />
          <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.5 6.8l3.7 2.9c1-2.9 3.7-5 6.8-5z" />
        </svg>
        {text}
      </Button>
    </form>
  );
}
