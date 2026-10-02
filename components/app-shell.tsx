"use client";

import { AppNav } from "@/components/app-nav";
import { LanguageProvider } from "@/components/language";
import { MotionProvider } from "@/components/animated";
import { signOut } from "@/actions/auth";
import type { Lang } from "@/lib/i18n/dictionaries";

export function AppShell({
  lang,
  name,
  children,
  className,
}: {
  lang: Lang;
  name?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const containerClass = className ?? "max-w-xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1536px]";
  return (
    <LanguageProvider lang={lang}>
      <MotionProvider>
        <AppNav name={name} onSignOut={() => signOut()} containerClass={containerClass} />
        <main
          id="main-content"
          className={`mx-auto flex w-full flex-col gap-5 px-4 sm:px-6 py-6 transition-all duration-300 ${containerClass}`}
        >
          {children}
        </main>
      </MotionProvider>
    </LanguageProvider>
  );
}
