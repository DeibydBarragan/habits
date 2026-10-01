import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LanguageProvider, LanguageToggle } from "@/components/language";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDictionary } from "@/lib/i18n/server";

const base =
  "flex w-full items-center justify-center rounded-(--radius) px-4 py-3 text-[15px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/hoy");

  const { lang, t } = await getDictionary();

  return (
    <LanguageProvider lang={lang}>
      <main className="relative flex min-h-screen items-center justify-center px-6">
        <div className="absolute right-4 top-4 flex gap-1">
          <LanguageToggle />
          <ThemeToggle labelLight={t.themeToggle.toLight} labelDark={t.themeToggle.toDark} />
        </div>
        <div className="w-full max-w-sm text-center">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted" translate="no">
            habits
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight">{t.landing.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{t.landing.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/registro" className={`${base} bg-accent text-accent-foreground hover:opacity-90`}>
              {t.landing.start}
            </Link>
            <Link
              href="/login"
              className={`${base} border border-border bg-surface text-foreground hover:bg-default`}
            >
              {t.landing.haveAccount}
            </Link>
          </div>
          <p className="mt-8 text-xs text-muted">{t.landing.footnote}</p>
        </div>
      </main>
    </LanguageProvider>
  );
}
