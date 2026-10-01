"use client";

import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { Button } from "@heroui/react";
import { dictionaries, LANG_COOKIE, type Dictionary, type Lang } from "@/lib/i18n/dictionaries";

const LangCtx = createContext<{ lang: Lang; t: Dictionary }>({ lang: "es", t: dictionaries.es });

export function LanguageProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return <LangCtx.Provider value={{ lang, t: dictionaries[lang] }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function LanguageToggle() {
  const { lang, t } = useLang();
  const router = useRouter();
  const next: Lang = lang === "es" ? "en" : "es";

  function switchLang() {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000`;
    try {
      localStorage.setItem(LANG_COOKIE, next);
    } catch {
      // almacenamiento no disponible
    }
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      aria-label={t.langToggle}
      onPress={switchLang}
    >
      <span className="flex items-center gap-1 text-xs font-semibold">
        <Globe size={15} />
        {next.toUpperCase()}
      </span>
    </Button>
  );
}
