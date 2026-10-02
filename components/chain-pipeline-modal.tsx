"use client";

import { Button } from "@heroui/react";
import { ArrowRight, Clock, X } from "lucide-react";
import { useLang } from "@/components/language";
import { CategoryIcon } from "@/components/category-icon";
import type { Habit, HabitCategory } from "@/lib/types";

const DAYS_SHORT_ES = ["L", "M", "X", "J", "V", "S", "D"];
const DAYS_SHORT_EN = ["M", "T", "W", "T", "F", "S", "S"];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  chainName: string;
  chainTime?: string | null;
  habits: Habit[];
  categories: HabitCategory[];
};

export function ChainPipelineModal({
  isOpen,
  onClose,
  chainName,
  chainTime,
  habits,
  categories,
}: Props) {
  const { lang, t } = useLang();
  const dayLabels = lang === "es" ? DAYS_SHORT_ES : DAYS_SHORT_EN;

  if (!isOpen) return null;

  function formatTime(timeVal?: string | null) {
    if (!timeVal) return null;
    if (timeVal === "morning") return `🌅 ${t.views.morning}`;
    if (timeVal === "afternoon") return `☀️ ${t.views.afternoon}`;
    if (timeVal === "night") return `🌙 ${t.views.night}`;
    if (timeVal === "anytime") return t.views.anytime;
    return `⏰ ${timeVal}`;
  }

  const timeLabel = formatTime(chainTime);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-3xl border border-border/70 bg-surface/95 dark:bg-zinc-900/95 backdrop-blur-2xl shadow-2xl p-6 flex flex-col gap-6 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pipeline-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 id="pipeline-modal-title" className="text-xl font-bold text-foreground truncate">
                {chainName}
              </h2>
              {timeLabel && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                  <Clock size={11} />
                  <span>{timeLabel}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              {t.views.readOnlyPreview} · {habits.length} {t.views.totalHabits}
            </p>
          </div>

          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Cerrar"
            className="h-8 w-8 text-muted hover:text-foreground"
            onPress={onClose}
          >
            <X size={18} />
          </Button>
        </div>

        {/* Pipeline Body (Horizontal scroll on desktop, vertical on mobile) */}
        <div className="flex-1 overflow-x-auto overflow-y-auto py-4 px-2 custom-scrollbar">
          <div className="flex flex-col md:flex-row items-center md:items-stretch gap-3 md:gap-0 min-w-max">
            {habits.map((h, index) => {
              const isLast = index === habits.length - 1;
              const cat = categories.find((c) => c.id === h.category_id);

              return (
                <div key={h.id} className="flex flex-col md:flex-row items-center">
                  {/* Card Node */}
                  <div
                    className="w-64 lg:w-72 rounded-2xl border border-border/60 bg-surface/90 dark:bg-zinc-900/90 p-4 flex flex-col gap-3 shadow-md select-none transition-all"
                    style={{
                      borderLeftColor: h.color,
                      borderLeftWidth: "4px",
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: h.color + "30", color: h.color }}
                      >
                        <CategoryIcon icon={cat?.icon ?? "other"} size={18} />
                      </span>

                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: h.color + "15", color: h.color }}
                      >
                        Paso {index + 1}
                      </span>
                    </div>

                    {/* Content */}
                    <div>
                      <p className="text-sm font-bold text-foreground truncate">{h.name}</p>
                      {cat && <p className="text-xs text-muted truncate mt-0.5">{cat.name}</p>}
                    </div>

                    {/* Tracking details */}
                    <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs text-muted">
                      <span>
                        {h.tracking_mode === "count"
                          ? h.counters && h.counters.length > 0
                            ? `${h.counters.length} contadores`
                            : `Meta: ${h.target_count} ${h.unit ?? ""}`
                          : h.type === "avoid"
                          ? t.habit.avoid
                          : t.habit.build}
                      </span>

                      {/* Active Days Pills */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5, 6, 7].map((d, dIdx) => (
                          <span
                            key={d}
                            className={`text-[9px] font-bold w-3.5 h-3.5 rounded flex items-center justify-center ${
                              h.days_active.includes(d)
                                ? "bg-accent/20 text-accent"
                                : "text-muted/40"
                            }`}
                          >
                            {dayLabels[dIdx]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Connecting Arrow */}
                  {!isLast && (
                    <div className="flex md:flex-col items-center justify-center py-2 md:py-0 md:px-3 text-muted/60 shrink-0">
                      <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border/50 text-accent shadow-xs">
                        <ArrowRight size={14} />
                      </div>
                      <div className="flex md:hidden items-center justify-center w-7 h-7 rounded-full bg-surface border border-border/50 text-accent rotate-90 my-1">
                        <ArrowRight size={13} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border/40 pt-4">
          <Button variant="primary" size="sm" className="px-5 font-semibold text-xs" onPress={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
}
