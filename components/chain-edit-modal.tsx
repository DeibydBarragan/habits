"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label, Spinner, TextField, toast } from "@heroui/react";
import { Clock, Sun, Sunrise, Moon, Sparkles, X } from "lucide-react";
import { useLang } from "@/components/language";
import { updateChainMetadata } from "@/actions/habits";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  headHabitId: string;
  initialName?: string | null;
  initialTime?: string | null;
  onSuccess?: () => void;
};

export function ChainEditModal({
  isOpen,
  onClose,
  headHabitId,
  initialName = "",
  initialTime = null,
  onSuccess,
}: Props) {
  const { t } = useLang();
  const [name, setName] = useState(initialName ?? "");
  const [isPending, startTransition] = useTransition();

  // Mode: "morning" | "afternoon" | "night" | "custom" | "anytime"
  const [timeMode, setTimeMode] = useState<string>(() => {
    if (!initialTime || initialTime === "anytime") return "anytime";
    if (["morning", "afternoon", "night"].includes(initialTime)) return initialTime;
    return "custom";
  });
  const [customTime, setCustomTime] = useState(() => {
    if (initialTime && !["morning", "afternoon", "night", "anytime"].includes(initialTime)) {
      return initialTime;
    }
    return "20:00";
  });

  if (!isOpen) return null;

  function handleSave() {
    startTransition(async () => {
      let finalTime: string | null = null;
      if (timeMode === "custom") {
        finalTime = customTime.trim() || null;
      } else if (timeMode !== "anytime") {
        finalTime = timeMode;
      }

      const res = await updateChainMetadata(headHabitId, name.trim() || null, finalTime);
      if (res?.error) {
        toast.danger(t.errors.saveFail);
      } else {
        toast.success("Cadena guardada ✓");
        onSuccess?.();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div
        className="w-full max-w-md rounded-3xl border border-border/70 bg-surface/95 dark:bg-zinc-900/95 backdrop-blur-2xl shadow-2xl p-6 flex flex-col gap-5 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-chain-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-accent/15 text-accent">
              <Sparkles size={18} />
            </span>
            <h2 id="edit-chain-modal-title" className="text-base font-bold text-foreground">
              {t.views.editChain}
            </h2>
          </div>

          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Cerrar"
            className="h-8 w-8 text-muted hover:text-foreground"
            onPress={onClose}
          >
            <X size={17} />
          </Button>
        </div>

        {/* Form Body */}
        <div className="flex flex-col gap-4">
          {/* Chain Name */}
          <TextField fullWidth name="chainName">
            <Label>{t.views.chainNameLabel}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.views.chainNamePh}
              spellCheck={false}
              autoFocus
            />
          </TextField>

          {/* Time Slot / Moment of day */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">{t.views.timeSlot}</span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTimeMode("morning")}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  timeMode === "morning"
                    ? "border-accent bg-accent/15 text-accent shadow-xs"
                    : "border-border/50 bg-surface/60 hover:border-border text-foreground/80"
                }`}
              >
                <Sunrise size={16} className="text-amber-500" />
                <span>{t.views.morning}</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeMode("afternoon")}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  timeMode === "afternoon"
                    ? "border-accent bg-accent/15 text-accent shadow-xs"
                    : "border-border/50 bg-surface/60 hover:border-border text-foreground/80"
                }`}
              >
                <Sun size={16} className="text-yellow-500" />
                <span>{t.views.afternoon}</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeMode("night")}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  timeMode === "night"
                    ? "border-accent bg-accent/15 text-accent shadow-xs"
                    : "border-border/50 bg-surface/60 hover:border-border text-foreground/80"
                }`}
              >
                <Moon size={16} className="text-indigo-400" />
                <span>{t.views.night}</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeMode("custom")}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  timeMode === "custom"
                    ? "border-accent bg-accent/15 text-accent shadow-xs"
                    : "border-border/50 bg-surface/60 hover:border-border text-foreground/80"
                }`}
              >
                <Clock size={16} className="text-accent" />
                <span>{t.views.exactTime}</span>
              </button>
            </div>

            {/* Custom Exact Time Input */}
            {timeMode === "custom" && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface border border-border/60 animate-in fade-in-0 duration-150">
                <Clock size={15} className="text-muted shrink-0" />
                <span className="text-xs text-muted font-medium">Hora:</span>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer tabular-nums"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setTimeMode("anytime")}
              className={`text-left text-xs py-1 transition-colors ${
                timeMode === "anytime"
                  ? "text-accent font-semibold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              • {t.views.anytime}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
          <Button size="sm" variant="ghost" className="text-xs" onPress={onClose} isDisabled={isPending}>
            Cancelar
          </Button>

          <Button
            size="sm"
            variant="primary"
            className="text-xs font-semibold px-4"
            onPress={handleSave}
            isDisabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <Spinner size="sm" color="current" />
                <span>Guardando…</span>
              </span>
            ) : (
              t.views.saveChain
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
