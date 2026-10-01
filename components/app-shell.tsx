"use client";

import { AppNav } from "@/components/app-nav";
import { LanguageProvider } from "@/components/language";
import { MotionProvider } from "@/components/animated";
import { signOut } from "@/actions/auth";
import type { Lang, Dictionary } from "@/lib/i18n/dictionaries";

export function AppShell({
  lang,
  name,
  children,
}: {
  lang: Lang;
  t: Dictionary;
  name?: string | null;
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider lang={lang}>
      <MotionProvider>
        <AppNav name={name} onSignOut={() => signOut()} />
        <main id="main-content" className="mx-auto flex max-w-xl flex-col gap-5 px-5 py-6">
          {children}
        </main>
      </MotionProvider>
    </LanguageProvider>
  );
}
