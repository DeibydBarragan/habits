"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label, Spinner, TextField, toast } from "@heroui/react";
import { Clock, Sun, Sunrise, Moon, Sparkles, X } from "lucide-react";
import { useLang } from "@/components/language";
import { GlassModal } from "@/components/glass-modal";
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
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={t.views.editChain}
      icon={<Sparkles size={18} className="text-accent" />}
      maxWidth="md"
      footer={
        <>
          <Button size="sm" variant="secondary" className="rounded-xl font-medium glass-btn" onPress={onClose} isDisabled={isPending}>
            Cancelar
          </Button>

          <Button
            size="sm"
            variant="primary"
            className="rounded-xl font-semibold px-4 shadow-xs"
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
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Chain Name */}
        <TextField fullWidth name="chainName">
          <Label className="text-xs font-semibold">{t.views.chainNameLabel}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.views.chainNamePh}
            spellCheck={false}
            autoFocus
            className="mt-1 rounded-xl glass-input"
          />
        </TextField>

        {/* Time Slot / Moment of day */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted">{t.views.timeSlot}</span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTimeMode("morning")}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                timeMode === "morning"
                  ? "border border-accent bg-accent/20 text-accent shadow-xs"
                  : "glass-btn text-foreground/80"
              }`}
            >
              <Sunrise size={16} className="text-amber-500" />
              <span>{t.views.morning}</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeMode("afternoon")}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                timeMode === "afternoon"
                  ? "border border-accent bg-accent/20 text-accent shadow-xs"
                  : "glass-btn text-foreground/80"
              }`}
            >
              <Sun size={16} className="text-yellow-500" />
              <span>{t.views.afternoon}</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeMode("night")}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                timeMode === "night"
                  ? "border border-accent bg-accent/20 text-accent shadow-xs"
                  : "glass-btn text-foreground/80"
              }`}
            >
              <Moon size={16} className="text-indigo-400" />
              <span>{t.views.night}</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeMode("custom")}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                timeMode === "custom"
                  ? "border border-accent bg-accent/20 text-accent shadow-xs"
                  : "glass-btn text-foreground/80"
              }`}
            >
              <Clock size={16} className="text-accent" />
              <span>{t.views.exactTime}</span>
            </button>
          </div>

          {/* Custom Exact Time Input */}
          {timeMode === "custom" && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl glass-input animate-in fade-in-0 duration-150">
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
    </GlassModal>
  );
}
