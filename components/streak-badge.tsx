"use client";

import { Flame, Snowflake } from "lucide-react";
import type { Streak } from "@/lib/streak";
import { useLang } from "@/components/language";

export function StreakBadge({ streak, kind }: { streak: Streak; kind: "build" | "avoid" }) {
  const { t } = useLang();
  const unit = kind === "avoid" ? t.streak.cleanDays : streak.current === 1 ? t.streak.oneDay : t.streak.times;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted tabular-nums">
      <Flame size={14} className="text-accent" aria-hidden />
      <strong className="text-foreground">{streak.current}</strong> {unit}
      <span aria-hidden>·</span>
      <span>{t.streak.best} {streak.best}</span>
      {streak.freeze
        ? <Snowflake size={13} aria-label={t.streak.freezeReady} className="text-accent" />
        : null}
    </span>
  );
}
