import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/server";
import { LanguageProvider } from "@/components/language";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "@/components/auth-form";
import Link from "next/link";

export default async function LoginPage() {
  const { lang, t } = await getDictionary();
  return (
    <LanguageProvider lang={lang}>
      <main className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" translate="no">
            habits
          </span>
          <ThemeToggle labelLight={t.themeToggle.toLight} labelDark={t.themeToggle.toDark} />
        </div>
        <div className="mx-auto mt-14 w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.login.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.login.subtitle}</p>
          <div className="mt-6">
            <LoginForm />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            {t.login.noAccount}{" "}
            <Link href="/registro" className="font-medium text-accent underline-offset-4 hover:underline">
              {t.login.createOne}
            </Link>
          </p>
        </div>
      </main>
    </LanguageProvider>
  );
}
