import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { getUserAndProfile } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { SettingsClient } from "@/components/settings-client";
import { FadeIn } from "@/components/animated";

export default async function AjustesPage() {
  const { lang, t } = await getDictionary();
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect("/login");
  return (
    <AppShell lang={lang} t={t} name={profile?.name}>
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.settings.subtitle}</p>
      </FadeIn>
      <SettingsClient name={profile?.name ?? null} email={user.email ?? null} />
    </AppShell>
  );
}
