"use client";

import { Button } from "@heroui/react";
import { ArrowRight, Clock, Workflow } from "lucide-react";
import { useLang } from "@/components/language";
import { GlassModal } from "@/components/glass-modal";
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
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={chainName}
      subtitle={`${t.views.readOnlyPreview} · ${habits.length} ${t.views.totalHabits}`}
      icon={<Workflow size={18} className="text-accent" />}
      footer={
        <div className="flex justify-end w-full">
          <Button
            variant="primary"
            size="sm"
            className="px-5 font-semibold text-xs rounded-xl shadow-xs"
            onPress={onClose}
          >
            Entendido
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {timeLabel && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-accent/15 text-accent border border-accent/25">
              <Clock size={12} />
              <span>{timeLabel}</span>
            </span>
          </div>
        )}

        {/* Pipeline Body (Horizontal scroll on desktop, vertical on mobile) */}
        <div className="w-full overflow-x-auto overflow-y-auto py-2 px-1 custom-scrollbar">
          <div className="flex flex-col md:flex-row items-center md:items-stretch gap-3 md:gap-0 min-w-max">
            {habits.map((h, index) => {
              const isLast = index === habits.length - 1;
              const cat = categories.find((c) => c.id === h.category_id);

              return (
                <div key={h.id} className="flex flex-col md:flex-row items-center">
                  {/* Card Node */}
                  <div
                    className="w-64 lg:w-72 rounded-2xl glass-input p-4 flex flex-col gap-3 shadow-md select-none transition-all hover:border-accent/40"
                    style={{
                      borderLeftColor: h.color,
                      borderLeftWidth: "4px",
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 dark:ring-white/10"
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
                                ? "bg-accent/20 text-accent font-semibold"
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
                      <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-surface/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-border/50 text-accent shadow-xs">
                        <ArrowRight size={14} />
                      </div>
                      <div className="flex md:hidden items-center justify-center w-7 h-7 rounded-full bg-surface/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-border/50 text-accent rotate-90 my-1">
                        <ArrowRight size={13} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </GlassModal>
  );
}
